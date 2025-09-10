import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs";
import PDFDocument from "pdfkit";
import fetch from "node-fetch";
import cron from "node-cron";
import dotenv from "dotenv";
import { google } from "googleapis";
import Database from "better-sqlite3";
import nodemailer from "nodemailer";
import { parse } from "csv-parse/sync";
import archiver from "archiver";
import path from "path";



dotenv.config();

console.log("SHEET_ID carregado do .env:", process.env.SHEET_ID);

// ======================
// 💾 Banco SQLite
// ======================
const db = new Database("inscricoes.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS inscricoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    telefone TEXT,
    evento_nome TEXT,
    local TEXT,
    ensaio_inicio TEXT,
    ensaio_fim TEXT,
    montagem_inicio TEXT,
    montagem_fim TEXT,
    desmontagem_inicio TEXT,
    desmontagem_fim TEXT,
    eventos_json TEXT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ======================
// 🔧 Função utilitária para normalizar cabeçalhos
// ======================
function normalizeKey(key = "") {
  return key
    .normalize("NFD")                // remove acentos
    .replace(/[\u0300-\u036f]/g, "") // remove marcas de acento
    .replace(/\s+/g, " ")            // normaliza espaços múltiplos
    .trim()
    .toLowerCase();
}

// ======================
// Função utilitária etapas
// ======================
function mapEtapasParaCampos(etapas = []) {
  let ensaio_inicio = null, ensaio_fim = null;
  let montagem_inicio = null, montagem_fim = null;
  let desmontagem_inicio = null, desmontagem_fim = null;
  const eventosExtras = [];

  for (const e of etapas) {
    const nome = (e.nome || "").toLowerCase();
    if (nome === "ensaio") {
      ensaio_inicio = e.inicio || null;
      ensaio_fim = e.fim || null;
    } else if (nome === "montagem") {
      montagem_inicio = e.inicio || null;
      montagem_fim = e.fim || null;
    } else if (nome === "desmontagem") {
      desmontagem_inicio = e.inicio || null;
      desmontagem_fim = e.fim || null;
    } else if (nome === "evento") {
      eventosExtras.push({ inicio: e.inicio, fim: e.fim });
    }
  }

  return {
    ensaio_inicio,
    ensaio_fim,
    montagem_inicio,
    montagem_fim,
    desmontagem_inicio,
    desmontagem_fim,
    eventos_json: JSON.stringify(eventosExtras),
  };
}

const insertInscricao = db.prepare(`
  INSERT INTO inscricoes (
    nome, email, telefone, evento_nome, local,
    ensaio_inicio, ensaio_fim,
    montagem_inicio, montagem_fim,
    desmontagem_inicio, desmontagem_fim,
    eventos_json
  ) VALUES (
    @nome, @email, @telefone, @evento_nome, @local,
    @ensaio_inicio, @ensaio_fim,
    @montagem_inicio, @montagem_fim,
    @desmontagem_inicio, @desmontagem_fim,
    @eventos_json
  );
`);

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ======================
// 📌 Autenticação Google
// ======================
const credentials = JSON.parse(fs.readFileSync("./credentials.json", "utf-8"));

const auth = new google.auth.JWT({
  email: credentials.client_email,
  key: credentials.private_key,
  scopes: [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
  ],
});

const calendar = google.calendar({ version: "v3", auth });
const drive = google.drive({ version: "v3", auth });
const sheets = google.sheets({ version: "v4", auth });

// ======================
// 📧 Enviar e-mail
// ======================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function enviarEmail(destinatario, assunto, mensagem) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: destinatario,
      subject: assunto,
      text: mensagem,
    });
    console.log("📧 E-mail enviado para:", destinatario);
  } catch (err) {
    console.error("❌ Erro ao enviar e-mail:", err.message);
  }
}

// ======================
// IDs das agendas
// ======================
const calendarIds = {
  teatro: "testecris.0001@gmail.com",
  igrejinha:
    "c_e19d30c40d4de176bc7d4e11ada96bfaffd130b3ed499d9807c88785e2c71c05@group.calendar.google.com",
};

// Cache em memória
let cacheEventos = {};
let lastUpdated = null;

async function atualizarCache() {
  try {
    const agora = new Date();
    const start = agora.toISOString();

    const fim = new Date(agora.getTime());
    fim.setMonth(fim.getMonth() + 2);
    const end = fim.toISOString();

    for (const [local, calendarId] of Object.entries(calendarIds)) {
      const res = await calendar.events.list({
        calendarId,
        timeMin: start,
        timeMax: end,
        singleEvents: true,
        orderBy: "startTime",
      });

      cacheEventos[local] = (res.data.items || []).map((event) => ({
        id: event.id,
        summary: event.summary,
        start: event.start.dateTime || `${event.start.date}T00:00:00`,
        end: event.end.dateTime || `${event.end.date}T23:59:59`,
      }));
    }

    lastUpdated = new Date();
    console.log("✅ Cache atualizado em", lastUpdated.toISOString());
  } catch (err) {
    console.error("❌ Erro ao atualizar cache:", err);
  }
}

// atualiza a cada 5 min e também na subida
cron.schedule("*/5 * * * *", atualizarCache);
atualizarCache();

app.get("/api/download-zip/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const outputPath = path.join(process.cwd(), `temp-zip-${id}.zip`);
    const output = fs.createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      res.download(outputPath, `inscricao-${id}.zip`, () => {
        fs.unlinkSync(outputPath); // apaga o zip temporário
      });
    });

    archive.on("error", (err) => {
      throw err;
    });

    archive.pipe(output);

    // Adicionar PDF
    const pdfPath = path.join(process.cwd(), "pdfs", `inscricao-${id}.pdf`);
    if (fs.existsSync(pdfPath)) {
      archive.file(pdfPath, { name: `inscricao-${id}.pdf` });
    }

    // 🔹 Buscar inscrição no banco
    const inscricao = db.prepare("SELECT * FROM inscricoes WHERE id = ?").get(id);
    if (!inscricao) {
      return res.status(404).send("Inscrição não encontrada");
    }

    // 🔹 Buscar respostas do Forms para achar anexos
    const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
      range: process.env.SHEET_RANGE || "A:ZZ",
    });

    const rows = response.data.values || [];
    const headers = rows[0] || [];
    const formsData = rows.slice(1).map((row) =>
      headers.reduce((acc, h, i) => {
        const val = row[i] || "";
        if (typeof val === "string" && val.includes("drive.google.com")) {
          const match = val.match(/[-\w]{25,}/);
          const fileId = match ? match[0] : null;
          if (fileId) acc.anexos = [...(acc.anexos || []), fileId];
        }
        return acc;
      }, {})
    );

    // 🔹 Pega o último match da inscrição
    const resposta = formsData.find((f) =>
      (f.email || "").toLowerCase() === (inscricao.email || "").toLowerCase()
    );

    if (resposta?.anexos) {
      for (let fileId of resposta.anexos) {
        const dest = path.join(process.cwd(), "uploads", `${fileId}.tmp`);
        const destStream = fs.createWriteStream(dest);

        await drive.files.get(
          { fileId, alt: "media" },
          { responseType: "stream" }
        ).then((driveRes) =>
          new Promise((resolve, reject) => {
            driveRes.data
              .on("end", () => {
                archive.file(dest, { name: `${fileId}.pdf` });
                resolve();
              })
              .on("error", reject)
              .pipe(destStream);
          })
        );
      }
    }

    await archive.finalize();
  } catch (err) {
    console.error("Erro ao gerar ZIP:", err);
    res.status(500).send("Erro ao gerar o ZIP");
  }
});

// Horários por local
app.get("/ical/:local/horarios", (req, res) => {
  const { local } = req.params;
  if (!cacheEventos[local]) {
    return res.status(503).json({ error: "Cache ainda não carregado" });
  }
  res.json({ lastUpdated, eventos: cacheEventos[local] });
});

// Criar eventos no Google Calendar (Etapa 1 – Confirmar)
app.post("/api/create-events", async (req, res) => {
  const { local, resumo, etapas, userData } = req.body;

  if (!calendarIds[local]) {
    return res.status(400).json({ error: "Calendário não encontrado" });
  }

  try {
    const resultados = [];
    let contadorEventos = 1;

    for (const etapa of etapas) {
      const etapaNome = etapa.nome === "evento" ? `Evento ${contadorEventos++}` : etapa.nome;

      const event = {
        summary: `${resumo || userData?.eventName || "Evento"} - ${etapaNome}`,
        description: `Agendado por ${userData.name} (${userData.email}, ${userData.phone})`,
        start: { dateTime: etapa.inicio, timeZone: "America/Sao_Paulo" },
        end:   { dateTime: etapa.fim,    timeZone: "America/Sao_Paulo" },
      };

      const response = await calendar.events.insert({
        calendarId: calendarIds[local],
        resource: event,
      });

      resultados.push({
        id: response.data.id,
        summary: response.data.summary,
        start: response.data.start,
        end: response.data.end,
      });
    }

    // salva a inscrição (Etapa 1)
    const campos = mapEtapasParaCampos(etapas);
    insertInscricao.run({
      nome: userData.name,
      email: userData.email,
      telefone: userData.phone,
      evento_nome: userData.eventName,
      local,
      ...campos,
    });

    await atualizarCache(); 
    res.json({ success: true, eventosCriados: resultados });
  } catch (err) {
    console.error("❌ Erro ao criar eventos:", err);
    res.status(500).json({ error: "Erro ao criar eventos" });
  }
});


// ======================
// 📄 Gerar PDF via CSV do Sheets
// ======================
app.get("/api/gerar-pdf/:inscricaoId", async (req, res) => {
  const { inscricaoId } = req.params;

  try {
    // Etapa 1
    const inscricao = db.prepare("SELECT * FROM inscricoes WHERE id = ?").get(inscricaoId);
    if (!inscricao) return res.status(404).send("Inscrição não encontrada.");

    // Lê sheetId
    const cfg = JSON.parse(fs.readFileSync("config.json", "utf-8"));
    const sheetId = cfg.sheetId;
    if (!sheetId) {
      console.error("❌ sheetId não encontrado em config.json");
      return res.status(500).send("Configuração do Forms/Sheets não encontrada.");
    }

    try {
      await auth.authorize();
    } catch (e) {
      console.warn("⚠️ auth.authorize() falhou", e?.message || e);
    }

    // Exporta CSV
    let records = [];
    try {
      const csvExport = await drive.files.export(
        { fileId: sheetId, mimeType: "text/csv" },
        { responseType: "arraybuffer" }
      );

      let csv = Buffer.from(csvExport.data).toString("utf8");
      csv = csv.replace(/^\uFEFF/, "");

      const commaCount = (csv.match(/,/g) || []).length;
      const semicolonCount = (csv.match(/;/g) || []).length;
      const delimiter = semicolonCount > commaCount ? ";" : ",";

      records = parse(csv, {
        columns: true,
        skip_empty_lines: true,
        delimiter,
      });

      console.log(`✅ CSV exportado (${records.length} registros).`);
    } catch (errDrive) {
      console.warn("⚠️ Erro exportando CSV via Drive API:", errDrive?.message || errDrive);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: process.env.SHEET_RANGE || "A:ZZ",
      });
      const rows = response.data.values || [];
      if (rows.length > 0) {
        const headers = rows[0];
        records = rows.slice(1).map((row) =>
          headers.reduce((acc, h, i) => {
            acc[h] = row[i] ?? "";
            return acc;
          }, {})
        );
      }
    }

    // Match robusto
    const respostaForms = records.find((f) => {
      const emailKey = Object.keys(f).find((k) => k.toLowerCase().includes("mail"));
      const emailForms = emailKey ? (f[emailKey] || "").trim().toLowerCase() : null;

      const telKey = Object.keys(f).find((k) =>
        k.toLowerCase().includes("fone") ||
        k.toLowerCase().includes("telefone") ||
        k.toLowerCase().includes("celular")
      );
      const telefoneForms = telKey ? (f[telKey] || "").replace(/\D/g, "") : null;

      const emailEtapa1 = (inscricao.email || "").trim().toLowerCase();
      const telefoneEtapa1 = (inscricao.telefone || "").replace(/\D/g, "");

      return (
        (emailForms && emailForms === emailEtapa1) ||
        (telefoneForms && telefoneForms === telefoneEtapa1)
      );
    });

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `${req.query.download === "true" ? "attachment" : "inline"}; filename="inscricao-${inscricaoId}.pdf"`
    );
    doc.pipe(res);

    doc.fontSize(20).text("Detalhes da Inscrição", { align: "center" }).moveDown();
    doc.fontSize(14).text(`Título do Evento: ${inscricao.evento_nome || "N/A"}`);
    doc.text(`Local: ${inscricao.local || "N/A"}`).moveDown();

    doc.fontSize(16).text("Etapas Agendadas").moveDown(0.5);
    const linhaEtapa = (rotulo, inicio, fim) => {
      if (!inicio || !fim) return;
      const data = new Date(inicio).toLocaleDateString("pt-BR");
      const hIni = new Date(inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });
      const hFim = new Date(fim).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });
      doc.text(`• ${rotulo}: ${data} das ${hIni} às ${hFim}`);
    };
    linhaEtapa("Ensaio", inscricao.ensaio_inicio, inscricao.ensaio_fim);
    linhaEtapa("Montagem", inscricao.montagem_inicio, inscricao.montagem_fim);
    if (inscricao.eventos_json) {
      JSON.parse(inscricao.eventos_json).forEach((ev, i) =>
        linhaEtapa(`Evento ${i + 1}`, ev.inicio, ev.fim)
      );
    }
    linhaEtapa("Desmontagem", inscricao.desmontagem_inicio, inscricao.desmontagem_fim);

    if (respostaForms) {
      doc.moveDown().fontSize(16).text("Informações do Forms").moveDown(0.5);
      Object.entries(respostaForms).forEach(([key, valor]) => {
        if (!valor || valor.toString().trim() === "") return;
        doc.fontSize(12).text(`• ${key}:`, { width: 500 });
        doc.text(`   ${valor}`).moveDown(0.5);
      });
    }

    doc.end();
  } catch (err) {
    console.error("❌ Erro ao gerar PDF via CSV:", err?.message || err);
    res.status(500).send("Erro ao gerar PDF.");
  }
});

// ======================
// 📌 Forms - salvar/ler config.json
// ======================
app.get("/api/forms-link", (req, res) => {
  try {
    let cfg = { formsLink: "", sheetLink: "", sheetId: "" };
    if (fs.existsSync("config.json")) {
      const c = JSON.parse(fs.readFileSync("config.json", "utf-8"));
      cfg = {
        formsLink: c.formsLink || "",
        sheetLink: c.sheetLink || "",
        sheetId: c.sheetId || "",
      };
    }
    res.json(cfg);
  } catch (e) {
    res.json({ formsLink: "", sheetLink: "", sheetId: "" });
  }
});

app.post("/api/forms-link", (req, res) => {
  try {
    const { formsLink, sheetLink } = req.body;
    let sheetId = "";
    if (sheetLink) {
      const m = sheetLink.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (m) sheetId = m[1];
    }
    const config = { formsLink, sheetLink, sheetId };
    fs.writeFileSync("config.json", JSON.stringify(config, null, 2));
    res.json({ success: true, ...config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ======================
// 📌 Inscrições (lista)
// ======================
app.get("/api/inscricoes", async (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM inscricoes").all();

    const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
      range: process.env.SHEET_RANGE || "A:ZZ",
    });

    const rowsForms = response.data.values || [];
    const headers = rowsForms[0] || [];

    const formsData = rowsForms.slice(1).map((row) =>
      headers.reduce((acc, h, i) => {
        acc[normalizeKey(h)] = row[i] || "";
        return acc;
      }, {})
    );

    const inscricoesComStatus = rows.map((inscricao) => {
      const matches = formsData.filter((f) => {
        const emailKey = Object.keys(f).find((k) => k.toLowerCase().includes("mail"));
        const emailForms = emailKey ? (f[emailKey] || "").trim().toLowerCase() : null;

        const telKey = Object.keys(f).find((k) =>
          k.toLowerCase().includes("fone") ||
          k.toLowerCase().includes("telefone") ||
          k.toLowerCase().includes("celular")
        );
        const telForms = telKey ? (f[telKey] || "").replace(/\D/g, "") : null;

        const emailEtapa1 = (inscricao.email || "").trim().toLowerCase();
        const telEtapa1 = (inscricao.telefone || "").replace(/\D/g, "");

        return (
          (emailForms && emailForms === emailEtapa1) ||
          (telForms && telForms === telEtapa1)
        );
      });

      const emailsUnicos = new Set([
        inscricao.email,
        ...matches.map(f => {
          const emailKey = Object.keys(f).find((k) => k.toLowerCase().includes("mail"));
          return emailKey ? (f[emailKey] || "").trim().toLowerCase() : null;
        }),
      ].filter(Boolean));

      const telefonesUnicos = new Set([
        inscricao.telefone,
        ...matches.map(f => {
          const telKey = Object.keys(f).find((k) =>
            k.toLowerCase().includes("fone") ||
            k.toLowerCase().includes("telefone") ||
            k.toLowerCase().includes("celular")
          );
          return telKey ? (f[telKey] || "").replace(/\D/g, "") : null;
        }),
      ].filter(Boolean));

      return {
        ...inscricao,
        etapa2_ok: matches.length > 0,
        emails: Array.from(emailsUnicos),
        telefones: Array.from(telefonesUnicos),
        formsData: matches[matches.length - 1] || null,
      };
    });

    res.json(inscricoesComStatus);
  } catch (err) {
    console.error("❌ Erro ao carregar inscrições:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ======================
// 📌 Respostas do Forms (Etapa 2)
// ======================
app.get("/api/forms-respostas", async (req, res) => {
  try {
    const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
      range: process.env.SHEET_RANGE || "A:ZZ",
    });

    const rows = response.data.values || [];
    const headers = rows[0] || [];

    const respostas = rows.slice(1).map((row) =>
      headers.reduce((acc, h, i) => {
        const val = row[i] || "";

        if (typeof val === "string" && val.includes("drive.google.com")) {
          const match = val.match(/[-\w]{25,}/);
          const fileId = match ? match[0] : null;

          acc[h] = fileId ? { url: val, fileId } : { url: val };
        } else {
          acc[h] = val;
        }
        return acc;
      }, {})
    );

    res.json({ respostas });
  } catch (err) {
    console.error("❌ Erro ao buscar respostas do Forms:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// 📌 Excluir inscrição
app.delete("/api/inscricoes/:id", (req, res) => {
  const { id } = req.params;
  try {
    const stmt = db.prepare("DELETE FROM inscricoes WHERE id = ?");
    const result = stmt.run(id);

    if (result.changes > 0) {
      res.json({ success: true, message: "Inscrição excluída com sucesso!" });
    } else {
      res.status(404).json({ success: false, message: "Inscrição não encontrada." });
    }
  } catch (err) {
    console.error("❌ Erro ao excluir inscrição:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});


// ======================
// 🚀 Iniciar servidor
// ======================
app.use("/uploads", express.static("uploads"));

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
