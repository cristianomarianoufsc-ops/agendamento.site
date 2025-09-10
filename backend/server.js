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
import { PassThrough } from "stream";



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
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// ======================
// Função utilitária etapas
// ======================
function mapEtapasParaCampos(etapas = []) {
  let ensaio_inicio = null,
    ensaio_fim = null;
  let montagem_inicio = null,
    montagem_fim = null;
  let desmontagem_inicio = null,
    desmontagem_fim = null;
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
      eventosExtras.push({
        inicio: e.inicio,
        fim: e.fim
      });
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
app.use(bodyParser.urlencoded({
  extended: true
}));

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

const calendar = google.calendar({
  version: "v3",
  auth
});
const drive = google.drive({
  version: "v3",
  auth
});
const sheets = google.sheets({
  version: "v4",
  auth
});

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
  teatro: "cristianomariano.ufsc@gmail.com",
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

// 🔹 Download de um arquivo individual do Google Drive
app.get("/api/download-drive/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;
    const drive = google.drive({ version: "v3", auth });

    // Obter metadados para nome do arquivo
    const meta = await drive.files.get({
      fileId,
      fields: "name",
    });

    const fileName = meta.data.name || `${fileId}.bin`;

    // Fazer download do arquivo
    const response = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" }
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(fileName)}"`
    );

    response.data
      .on("error", (err) => {
        console.error("Erro no stream do Drive:", err);
        res.status(500).send("Erro ao baixar arquivo do Google Drive.");
      })
      .pipe(res);
  } catch (err) {
    console.error("Erro ao baixar do Drive:", err.message);
    res.status(500).send("Erro ao baixar arquivo do Google Drive.");
  }
});


// ======================
// 📌 Endpoint para baixar ZIP de uma inscrição (PDF + anexos do Forms)
// ======================
app.get("/api/download-zip/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // 1) Buscar inscrição no banco
    const inscricao = db.prepare("SELECT * FROM inscricoes WHERE id = ?").get(id);
    if (!inscricao) {
      if (!res.headersSent) {
        res.status(404).send("Inscrição não encontrada.");
      }
      return;
    }

    // ✅ Gerar nome personalizado do ZIP
    const primeiroNome = inscricao.nome ? inscricao.nome.split(" ")[0] : "Inscricao";
    const zipFileName = `${primeiroNome} - inscricao - ${String(inscricao.id).padStart(2, "0")}.zip`;

    // ✅ Criar o ZIP **só uma vez**
    const archive = archiver("zip", { zlib: { level: 9 } });
    res.attachment(zipFileName);
    archive.pipe(res);


    // 2) Buscar e processar os dados do Forms (Etapa 2)
    const cfg = JSON.parse(fs.readFileSync("config.json", "utf-8"));
    const sheetId = cfg.sheetId;

    let records = [];
    try {
      // Tenta exportar o CSV via Drive API (método mais confiável)
      const csvExport = await drive.files.export({
        fileId: sheetId,
        mimeType: "text/csv"
      }, {
        responseType: "arraybuffer"
      });
      let csv = Buffer.from(csvExport.data).toString("utf8");
      csv = csv.replace(/^\uFEFF/, "");
      const commaCount = (csv.match(/,/g) || []).length;
      const semicolonCount = (csv.match(/;/g) || []).length;
      const delimiter = semicolonCount > commaCount ? ";" : ",";
      records = parse(csv, {
        columns: true,
        skip_empty_lines: true,
        delimiter
      });
    } catch (errDrive) {
      console.warn("⚠️ Erro exportando CSV via Drive API, tentando Sheets API:", errDrive?.message || errDrive);
      // Se falhar, volta para o método da Sheets API (menos completo)
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
      const telKey = Object.keys(f).find((k) => k.toLowerCase().includes("fone") || k.toLowerCase().includes("telefone") || k.toLowerCase().includes("celular"));
      const telefoneForms = telKey ? (f[telKey] || "").replace(/\D/g, "") : null;
      const emailEtapa1 = (inscricao.email || "").trim().toLowerCase();
      const telefoneEtapa1 = (inscricao.telefone || "").replace(/\D/g, "");
      return (emailForms && emailForms === emailEtapa1) || (telefoneForms && telefoneForms === telefoneEtapa1);
    });

    // Array para armazenar as promises de download dos arquivos
    const downloadPromises = [];

    // 3) Gerar PDF com dados mesclados
    const pdfStream = new PassThrough();
    archive.append(pdfStream, {
  name: `${primeiroNome} - inscricao - ${String(inscricao.id).padStart(2, "0")}.pdf`
});

    const doc = new PDFDocument({
      margin: 50
    });
    doc.pipe(pdfStream);
    doc.fontSize(20).text("Detalhes da Inscrição", {
      align: "center"
    }).moveDown();
    doc.fontSize(14).text(`Título do Evento: ${inscricao.evento_nome || "N/A"}`);
    doc.text(`Local: ${inscricao.local || "N/A"}`).moveDown();
    doc.fontSize(16).text("Etapas Agendadas").moveDown(0.5);
    const linhaEtapa = (rotulo, inicio, fim) => {
      if (!inicio || !fim) return;
      const data = new Date(inicio).toLocaleDateString("pt-BR");
      const hIni = new Date(inicio).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
      const hFim = new Date(fim).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
      doc.text(`• ${rotulo}: ${data} das ${hIni} às ${hFim}`);
    };
    linhaEtapa("Ensaio", inscricao.ensaio_inicio, inscricao.ensaio_fim);
    linhaEtapa("Montagem", inscricao.montagem_inicio, inscricao.montagem_fim);
    if (inscricao.eventos_json) {
      JSON.parse(inscricao.eventos_json).forEach((ev, i) => linhaEtapa(`Evento ${i + 1}`, ev.inicio, ev.fim));
    }
    linhaEtapa("Desmontagem", inscricao.desmontagem_inicio, inscricao.desmontagem_fim);

    // 4) Incluir Informações do Forms e anexos no ZIP
    if (respostaForms) {
      doc.moveDown().fontSize(16).text("Informações do Forms").moveDown(0.5);
      for (const [key, valorRaw] of Object.entries(respostaForms)) {
        if (!valorRaw || (typeof valorRaw === 'string' && valorRaw.trim() === '')) continue;
        const label = String(key || "").replace(/\s+/g, " ").trim();
        if (!label) continue;
        let valor = valorRaw;
        if (Array.isArray(valorRaw)) {
          valor = valorRaw.join(", ");
        } else if (typeof valorRaw === "object" && 'url' in valorRaw) {
          valor = valorRaw.url;
        } else {
          valor = String(valorRaw).trim();
        }

        doc.fontSize(12).text(`• ${label}:`, {
          width: 500
        });
        doc.text(`   ${valor}`).moveDown(0.5);

        // Verifica se é um link do Google Drive para baixar o arquivo
        if (typeof valor === "string" && valor.includes("drive.google.com")) {
          let fileId = null;

// Caso 1: formato https://drive.google.com/file/d/<ID>/view
let match = valor.match(/\/d\/([-\w]{25,})/);
if (match) fileId = match[1];

// Caso 2: formato https://drive.google.com/open?id=<ID>
if (!fileId) {
  match = valor.match(/open\?id=([-\w]{25,})/);
  if (match) fileId = match[1];
}


          if (fileId) {
            // Cria uma promise para o download e adiciona ao array
            const downloadPromise = new Promise(async (resolve, reject) => {
              try {
                const driveRes = await drive.files.get({
                  fileId,
                  alt: "media"
                }, {
                  responseType: "stream"
                });
                const fileMetadata = await drive.files.get({
                  fileId,
                  fields: 'name'
                });
                const fileName = fileMetadata.data.name;
                archive.append(driveRes.data, {
                  name: `inscricao-${id}/anexos/${fileName}`
                });
                resolve();
              } catch (err) {
                console.warn(`⚠️ Erro ao baixar anexo ${fileId} para a inscrição ${id}:`, err.message);
                resolve(); // Resolve para não travar o Promise.all mesmo que falhe
              }
            });
            downloadPromises.push(downloadPromise);
          }
        }
      }
    }

    doc.end();

    // 5) Finaliza o ZIP depois que todos os arquivos foram adicionados
    await Promise.all(downloadPromises);
    archive.finalize();

  } catch (err) {
    console.error("❌ Erro ao gerar ZIP:", err);
    if (!res.headersSent) {
      res.status(500).send("Erro ao gerar ZIP");
    } else {
      res.end();
    }
  }
});

// ======================
// 📌 Endpoint para baixar ZIP com todas as inscrições (PDFs com Etapa 1 + Etapa 2)
// ======================
app.get("/api/download-all-zips", async (req, res) => {
  try {
    const inscricoes = db.prepare("SELECT * FROM inscricoes").all();
    if (!inscricoes || inscricoes.length === 0) {
      return res.status(404).send("Nenhuma inscrição encontrada.");
    }

    // Lê config e prepara acesso ao Forms (Etapa 2)
    const cfg = JSON.parse(fs.readFileSync("config.json", "utf-8"));
    const sheetId = cfg.sheetId;

    // Exporta CSV do Forms (igual ao download individual)
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
      records = parse(csv, { columns: true, skip_empty_lines: true, delimiter });
    } catch (errDrive) {
      console.warn("⚠️ Erro exportando CSV via Drive API, tentando Sheets API:", errDrive?.message || errDrive);
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

    const archive = archiver("zip", { zlib: { level: 9 } });
    const primeiroNome = inscricao.nome ? inscricao.nome.split(" ")[0] : "Inscricao";
const zipFileName = `${primeiroNome} - inscricao - ${String(inscricao.id).padStart(2, "0")}.zip`;

res.attachment(zipFileName);

    archive.pipe(res);

    for (const inscricao of inscricoes) {
      // Tenta casar com o Forms (mesmo critério do individual: email ou telefone)
      const respostaForms = records.find((f) => {
        const emailKey = Object.keys(f).find((k) => k.toLowerCase().includes("mail"));
        const emailForms = emailKey ? (f[emailKey] || "").trim().toLowerCase() : null;
        const telKey = Object.keys(f).find((k) =>
          k.toLowerCase().includes("fone") || k.toLowerCase().includes("telefone") || k.toLowerCase().includes("celular")
        );
        const telefoneForms = telKey ? (f[telKey] || "").replace(/\D/g, "") : null;
        const emailEtapa1 = (inscricao.email || "").trim().toLowerCase();
        const telefoneEtapa1 = (inscricao.telefone || "").replace(/\D/g, "");
        return (emailForms && emailForms === emailEtapa1) || (telefoneForms && telefoneForms === telefoneEtapa1);
      });

      // PDF para cada inscrição
      const pdfStream = new PassThrough();
      archive.append(pdfStream, { name: `inscricao-${inscricao.id}/inscricao-${inscricao.id}.pdf` });

      const doc = new PDFDocument({ margin: 50 });
      doc.pipe(pdfStream);

      // Cabeçalho
      doc.fontSize(20).text("Detalhes da Inscrição", { align: "center" }).moveDown();
      doc.fontSize(14).text(`Título do Evento: ${inscricao.evento_nome || "N/A"}`);
      doc.text(`Local: ${inscricao.local || "N/A"}`);
      doc.text(`Nome: ${inscricao.nome}`);
      doc.text(`Email: ${inscricao.email}`);
      doc.text(`Telefone: ${inscricao.telefone}`).moveDown();

      // Etapas (Etapa 1)
      const linhaEtapa = (rotulo, inicio, fim) => {
        if (!inicio || !fim) return;
        const data = new Date(inicio).toLocaleDateString("pt-BR");
        const hIni = new Date(inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        const hFim = new Date(fim).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
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

      // Etapa 2 (Forms)
      if (respostaForms) {
        doc.moveDown().fontSize(16).text("Informações do Forms").moveDown(0.5);
        for (const [key, valorRaw] of Object.entries(respostaForms)) {
          if (!valorRaw || (typeof valorRaw === "string" && valorRaw.trim() === "")) continue;
          const label = String(key || "").replace(/\s+/g, " ").trim();
          if (!label) continue;
          let valor = valorRaw;
          if (Array.isArray(valorRaw)) valor = valorRaw.join(", ");
          else if (typeof valorRaw === "object" && "url" in valorRaw) valor = valorRaw.url;
          else valor = String(valorRaw).trim();

          doc.fontSize(12).text(`• ${label}:`, { width: 500 });
          doc.text(`   ${valor}`).moveDown(0.5);
        }
      }

      doc.end();
    }

    await archive.finalize();
  } catch (err) {
    console.error("❌ Erro ao gerar ZIP de todas inscrições:", err);
    if (!res.headersSent) res.status(500).send("Erro ao gerar ZIP de todas inscrições.");
    else res.end();
  }
});


// ======================
// 📄 Gerar PDF via CSV do Sheets
// ======================
app.get("/api/gerar-pdf/:inscricaoId", async (req, res) => {
  const {
    inscricaoId
  } = req.params;

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
      const csvExport = await drive.files.export({
        fileId: sheetId,
        mimeType: "text/csv"
      }, {
        responseType: "arraybuffer"
      });

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

    const doc = new PDFDocument({
      margin: 50
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `${req.query.download === "true" ? "attachment" : "inline"}; filename="inscricao-${inscricaoId}.pdf"`
    );
    doc.pipe(res);

    doc.fontSize(20).text("Detalhes da Inscrição", {
      align: "center"
    }).moveDown();
    doc.fontSize(14).text(`Título do Evento: ${inscricao.evento_nome || "N/A"}`);
    doc.text(`Local: ${inscricao.local || "N/A"}`).moveDown();

    doc.fontSize(16).text("Etapas Agendadas").moveDown(0.5);
    const linhaEtapa = (rotulo, inicio, fim) => {
      if (!inicio || !fim) return;
      const data = new Date(inicio).toLocaleDateString("pt-BR");
      const hIni = new Date(inicio).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
      const hFim = new Date(fim).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
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
        doc.fontSize(12).text(`• ${key}:`, {
          width: 500
        });
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
// 🔧 Função utilitária: gerar PDF em Buffer (para download)
// ======================
async function gerarPdfBuffer(inscricaoId) {
  return new Promise(async (resolve, reject) => {
    try {
      // Etapa 1 (SQLite)
      const inscricao = db.prepare("SELECT * FROM inscricoes WHERE id = ?").get(inscricaoId);
      if (!inscricao) return reject(new Error("Inscrição não encontrada."));

      // Etapa 2 (Forms - CSV do Google Sheets)
      const cfg = JSON.parse(fs.readFileSync("config.json", "utf-8"));
      const sheetId = cfg.sheetId;

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
      } catch (errDrive) {
        console.warn("⚠️ Erro exportando CSV via Drive API:", errDrive?.message || errDrive);
      }

      // Match com Forms
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

      // Criar PDF
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      // Cabeçalho
      doc.fontSize(20).text("Detalhes da Inscrição", { align: "center" }).moveDown();
      doc.fontSize(14).text(`Título do Evento: ${inscricao.evento_nome || "N/A"}`);
      doc.text(`Local: ${inscricao.local || "N/A"}`).moveDown();

      // Etapas da Etapa 1
      const linhaEtapa = (rotulo, inicio, fim) => {
        if (!inicio || !fim) return;
        const data = new Date(inicio).toLocaleDateString("pt-BR");
        const hIni = new Date(inicio).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        });
        const hFim = new Date(fim).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        });
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

      // Etapa 2 (Forms)
      if (respostaForms) {
        doc.moveDown().fontSize(16).text("Informações do Forms").moveDown(0.5);
        Object.entries(respostaForms).forEach(([key, valor]) => {
          if (!valor || valor.toString().trim() === "") return;
          doc.fontSize(12).text(`• ${key}: ${valor}`).moveDown(0.5);
        });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ======================
// 📥 Baixar PDF (forçar download)
// ======================
app.get("/api/download-pdf/:inscricaoId", async (req, res) => {
  try {
    const buffer = await gerarPdfBuffer(req.params.inscricaoId);
    res.setHeader("Content-Type", "application/pdf");
    const inscricao = db.prepare("SELECT * FROM inscricoes WHERE id = ?").get(req.params.inscricaoId);
const primeiroNome = inscricao?.nome ? inscricao.nome.split(" ")[0] : "Inscricao";
const pdfFileName = `${primeiroNome} - inscricao - ${String(req.params.inscricaoId).padStart(2, "0")}.pdf`;

res.setHeader(
  "Content-Disposition",
  `attachment; filename="${pdfFileName}"`
);

    res.send(buffer);
  } catch (err) {
    console.error("❌ Erro ao baixar PDF:", err.message);
    res.status(500).send("Erro ao baixar PDF.");
  }
});

// ======================
// 📌 Forms - salvar/ler config.json
// ======================
app.get("/api/forms-link", (req, res) => {
  try {
    let cfg = {
      formsLink: "",
      sheetLink: "",
      sheetId: ""
    };
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
    res.json({
      formsLink: "",
      sheetLink: "",
      sheetId: ""
    });
  }
});

app.post("/api/forms-link", (req, res) => {
  try {
    const {
      formsLink,
      sheetLink
    } = req.body;
    let sheetId = "";
    if (sheetLink) {
      const m = sheetLink.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (m) sheetId = m[1];
    }
    const config = {
      formsLink,
      sheetLink,
      sheetId
    };
    fs.writeFileSync("config.json", JSON.stringify(config, null, 2));
    res.json({
      success: true,
      ...config
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
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
    const val = row[i] || "";
    if (typeof val === "string" && val.includes("drive.google.com")) {
      const links = val.split(/,\s*/).filter(Boolean);
      acc[normalizeKey(h)] = links.map(link => {
        let fileId = null;
        let match = link.match(/\/d\/([-\w]{25,})/);
        if (match) fileId = match[1];
        if (!fileId) {
          match = link.match(/open\?id=([-\w]{25,})/);
          if (match) fileId = match[1];
        }
        return { url: link, fileId: fileId || null };

      });
    } else {
      acc[normalizeKey(h)] = val;
    }
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
    res.status(500).json({
      error: err.message
    });
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
  const links = val.split(/,\s*/).filter(Boolean);
  acc[h] = links.map(link => {
    let fileId = null;
    let match = link.match(/\/d\/([-\w]{25,})/);
    if (match) fileId = match[1];
    if (!fileId) {
      match = link.match(/open\?id=([-\w]{25,})/);
      if (match) fileId = match[1];
    }
    return fileId ? { url: link, fileId } : { url: link };
  });
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



// ======================
// 📌 Horários por local
// ======================
app.get("/ical/:local/horarios", (req, res) => {
  const {
    local
  } = req.params;
  if (!cacheEventos[local]) {
    return res.status(503).json({
      error: "Cache ainda não carregado"
    });
  }
  res.json({
    lastUpdated,
    eventos: cacheEventos[local]
  });
});

// ======================
// 📌 Criar eventos no Google Calendar (Etapa 1 – Confirmar)
// ======================
app.post("/api/create-events", async (req, res) => {
  const {
    local,
    resumo,
    etapas,
    userData
  } = req.body;

  if (!calendarIds[local]) {
    return res.status(400).json({
      error: "Calendário não encontrado"
    });
  }

  try {
    const resultados = [];
    let contadorEventos = 1;

    for (const etapa of etapas) {
      const etapaNome = etapa.nome === "evento" ? `Evento ${contadorEventos++}` : etapa.nome;

      const event = {
        summary: `${resumo || userData?.eventName || "Evento"} - ${etapaNome}`,
        description: `Agendado por ${userData.name} (${userData.email}, ${userData.phone})`,
        start: {
          dateTime: etapa.inicio,
          timeZone: "America/Sao_Paulo"
        },
        end: {
          dateTime: etapa.fim,
          timeZone: "America/Sao_Paulo"
        },
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
    res.json({
      success: true,
      eventosCriados: resultados
    });
  } catch (err) {
    console.error("❌ Erro ao criar eventos:", err);
    res.status(500).json({
      error: "Erro ao criar eventos"
    });
  }
});

// ======================
// 📌 Cancelar múltiplos eventos no Google Calendar (com log detalhado)
// ======================
app.delete("/api/cancel-events/:local", async (req, res) => {
  const { local } = req.params;
  const { eventIds } = req.body;

  if (!calendarIds[local]) {
    console.warn(`⚠️ Local inválido recebido: ${local}`);
    return res.status(400).json({ error: "Calendário não encontrado para o local informado." });
  }

  if (!Array.isArray(eventIds) || eventIds.length === 0) {
    console.warn("⚠️ Nenhum eventId recebido no body da requisição.");
    return res.status(400).json({ error: "Nenhum ID de evento informado." });
  }

  console.log(`🗑️ Iniciando cancelamento de ${eventIds.length} evento(s) no calendário "${local}"...`);

  const resultados = [];
  for (const eventId of eventIds) {
    try {
      // 🔎 Buscar o evento para mostrar o nome no log
      let nomeEvento = "(desconhecido)";
      try {
        const ev = await calendar.events.get({
          calendarId: calendarIds[local],
          eventId,
        });
        nomeEvento = ev.data.summary || "(sem nome)";
      } catch (fetchErr) {
        console.warn(`⚠️ Não foi possível obter detalhes do evento ${eventId} antes de excluir:`, fetchErr.message);
      }

      console.log(`🗑️ Excluindo evento "${nomeEvento}" (ID: ${eventId})...`);

      await calendar.events.delete({
        calendarId: calendarIds[local],
        eventId,
      });

      console.log(`✅ Evento "${nomeEvento}" removido com sucesso!`);
      resultados.push({ eventId, nome: nomeEvento, status: "deleted" });
    } catch (err) {
      console.error(`❌ Falha ao remover evento ${eventId}:`, err?.message || err);
      resultados.push({ eventId, status: "error", error: err?.message || "Erro desconhecido" });
    }
  }

  // Atualiza o cache de uma vez só
  if (cacheEventos[local]) {
    cacheEventos[local] = cacheEventos[local].filter((e) => !eventIds.includes(e.id));
    console.log(`♻️ Cache atualizado: ${cacheEventos[local].length} eventos restantes no local "${local}"`);
  }

  res.json({ success: true, resultados });
});



// ======================
// 📌 Cancelar evento no Google Calendar
// ======================
app.delete("/api/cancel-event/:local/:eventId", async (req, res) => {
  const { local, eventId } = req.params;

  if (!calendarIds[local]) {
    return res.status(400).json({ error: "Calendário não encontrado para o local informado." });
  }

  try {
    await calendar.events.delete({
      calendarId: calendarIds[local],
      eventId,
    });

    // Remove também do cache
    if (cacheEventos[local]) {
      cacheEventos[local] = cacheEventos[local].filter(e => e.id !== eventId);
    }

    res.json({ success: true, message: "Evento cancelado com sucesso." });
  } catch (err) {
    console.error("❌ Erro ao cancelar evento:", err.message);
    res.status(500).json({ error: "Erro ao cancelar evento no Google Calendar." });
  }
});


// 🧹 Limpeza de anexos antigos (mais de 18 meses)
cron.schedule("0 0 1 * *", async () => {
  const modo = process.env.CLEANUP_MODE || "simulate";
  console.log(`🧹 Iniciando limpeza automática de anexos (modo: ${modo})...`);

  const limiteMeses = 18; // 1,5 ano
  const dataLimite = new Date();
  dataLimite.setMonth(dataLimite.getMonth() - limiteMeses);

  const inscricoesAntigas = db.prepare(`
    SELECT id, email, telefone, criado_em
    FROM inscricoes
    WHERE DATE(criado_em) < DATE(?)
  `).all(dataLimite.toISOString());

  console.log(`📌 Encontradas ${inscricoesAntigas.length} inscrições com mais de ${limiteMeses} meses.`);

  for (const inscricao of inscricoesAntigas) {
    try {
      const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));
      const sheetId = config.sheetId;

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: process.env.SHEET_RANGE || "A:ZZ",
      });

      const rows = response.data.values || [];
      const headers = rows[0] || [];
      const respostas = rows.slice(1).map((row) =>
        headers.reduce((acc, h, i) => {
          acc[h] = row[i] || "";
          return acc;
        }, {})
      );

      const resposta = respostas.find((f) =>
        (f["Email"] && f["Email"].toLowerCase() === inscricao.email.toLowerCase()) ||
        (f["Telefone"] && f["Telefone"].replace(/\D/g, "") === inscricao.telefone.replace(/\D/g, ""))
      );

      if (resposta) {
        for (const valor of Object.values(resposta)) {
          if (typeof valor === "string" && valor.includes("drive.google.com")) {
            let fileId = null;

// Caso 1: formato https://drive.google.com/file/d/<ID>/view
let match = valor.match(/\/d\/([-\w]{25,})/);
if (match) fileId = match[1];

// Caso 2: formato https://drive.google.com/open?id=<ID>
if (!fileId) {
  match = valor.match(/open\?id=([-\w]{25,})/);
  if (match) fileId = match[1];
}


            if (fileId) {
              if (modo === "delete") {
                try {
                  await drive.files.delete({ fileId });
                  console.log(`🗑️ Arquivo ${fileId} da inscrição ${inscricao.id} deletado do Drive.`);
                } catch (err) {
                  console.warn(`⚠️ Erro ao deletar arquivo ${fileId}:`, err.message);
                }
              } else {
                console.log(`🟡 [SIMULAÇÃO] Arquivo ${fileId} da inscrição ${inscricao.id} seria deletado.`);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("❌ Erro na limpeza de anexos:", err.message);
    }
  }
});

// ======================
// 📌 Endpoint manual para limpeza sob demanda
// ======================
app.post("/api/cleanup", async (req, res) => {
  const modo = process.env.CLEANUP_MODE || "simulate";
  console.log(`🧹 Iniciando limpeza sob demanda (modo: ${modo})...`);

  const limiteMeses = 18; // 1,5 ano
  const dataLimite = new Date();
  dataLimite.setMonth(dataLimite.getMonth() - limiteMeses);

  const inscricoesAntigas = db.prepare(`
    SELECT id, email, telefone, criado_em
    FROM inscricoes
    WHERE DATE(criado_em) < DATE(?)
  `).all(dataLimite.toISOString());

  console.log(`📌 Encontradas ${inscricoesAntigas.length} inscrições com mais de ${limiteMeses} meses.`);

  const resultados = [];

  for (const inscricao of inscricoesAntigas) {
    try {
      const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));
      const sheetId = config.sheetId;

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: process.env.SHEET_RANGE || "A:ZZ",
      });

      const rows = response.data.values || [];
      const headers = rows[0] || [];
      const respostas = rows.slice(1).map((row) =>
        headers.reduce((acc, h, i) => {
          acc[h] = row[i] || "";
          return acc;
        }, {})
      );

      const resposta = respostas.find((f) =>
        (f["Email"] && f["Email"].toLowerCase() === inscricao.email.toLowerCase()) ||
        (f["Telefone"] && f["Telefone"].replace(/\D/g, "") === inscricao.telefone.replace(/\D/g, ""))
      );

      if (resposta) {
        for (const valor of Object.values(resposta)) {
          if (typeof valor === "string" && valor.includes("drive.google.com")) {
            let fileId = null;

// Caso 1: formato https://drive.google.com/file/d/<ID>/view
let match = valor.match(/\/d\/([-\w]{25,})/);
if (match) fileId = match[1];

// Caso 2: formato https://drive.google.com/open?id=<ID>
if (!fileId) {
  match = valor.match(/open\?id=([-\w]{25,})/);
  if (match) fileId = match[1];
}


            if (fileId) {
              if (modo === "delete") {
                try {
                  await drive.files.delete({ fileId });
                  console.log(`🗑️ Arquivo ${fileId} da inscrição ${inscricao.id} deletado do Drive.`);
                  resultados.push({ inscricaoId: inscricao.id, fileId, status: "deletado" });
                } catch (err) {
                  console.warn(`⚠️ Erro ao deletar arquivo ${fileId}:`, err.message);
                  resultados.push({ inscricaoId: inscricao.id, fileId, status: "erro", erro: err.message });
                }
              } else {
                console.log(`🟡 [SIMULAÇÃO] Arquivo ${fileId} da inscrição ${inscricao.id} seria deletado.`);
                resultados.push({ inscricaoId: inscricao.id, fileId, status: "simulado" });
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("❌ Erro na limpeza de anexos:", err.message);
      resultados.push({ inscricaoId: inscricao.id, status: "erro", erro: err.message });
    }
  }

  res.json({
    sucesso: true,
    modo,
    encontrados: inscricoesAntigas.length,
    resultados,
  });
});

// ======================
// 📌 Endpoint manual de limpeza forçada (apaga todas as inscrições)
// ======================
app.post("/api/cleanup/force", async (req, res) => {
  const modo = process.env.CLEANUP_MODE || "simulate";
  console.log(`🧹 [FORÇADO] Iniciando limpeza de TODOS os anexos (modo: ${modo})...`);

  const inscricoes = db.prepare(`
    SELECT id, email, telefone, criado_em
    FROM inscricoes
  `).all();

  const resultados = [];

  for (const inscricao of inscricoes) {
    try {
      const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));
      const sheetId = config.sheetId;

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: process.env.SHEET_RANGE || "A:ZZ",
      });

      const rows = response.data.values || [];
      const headers = rows[0] || [];
      const respostas = rows.slice(1).map((row) =>
        headers.reduce((acc, h, i) => {
          acc[h] = row[i] || "";
          return acc;
        }, {})
      );

      const resposta = respostas.find((f) =>
        (f["Email"] && f["Email"].toLowerCase() === inscricao.email.toLowerCase()) ||
        (f["Telefone"] && f["Telefone"].replace(/\D/g, "") === inscricao.telefone.replace(/\D/g, ""))
      );

      if (resposta) {
        for (const valor of Object.values(resposta)) {
          if (typeof valor === "string" && valor.includes("drive.google.com")) {
            let fileId = null;

            // Caso 1: formato https://drive.google.com/file/d/<ID>/view
            let match = valor.match(/\/d\/([-\w]{25,})/);
            if (match) fileId = match[1];

            // Caso 2: formato https://drive.google.com/open?id=<ID>
            if (!fileId) {
              match = valor.match(/open\?id=([-\w]{25,})/);
              if (match) fileId = match[1];
            }

            if (fileId) {
              if (modo === "delete") {
                try {
                  await drive.files.delete({ fileId });
                  console.log(`🗑️ [FORÇADO] Arquivo ${fileId} da inscrição ${inscricao.id} deletado do Drive.`);
                  resultados.push({ inscricaoId: inscricao.id, fileId, status: "deletado" });
                } catch (err) {
                  console.warn(`⚠️ Erro ao deletar arquivo ${fileId}:`, err.message);
                  resultados.push({ inscricaoId: inscricao.id, fileId, status: "erro", erro: err.message });
                }
              } else {
                console.log(`🟡 [FORÇADO - SIMULAÇÃO] Arquivo ${fileId} da inscrição ${inscricao.id} seria deletado.`);
                resultados.push({ inscricaoId: inscricao.id, fileId, status: "simulado" });
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("❌ Erro na limpeza forçada:", err.message);
      resultados.push({ inscricaoId: inscricao.id, status: "erro", erro: err.message });
    }
  }

  // 🔴 Remove todas as inscrições do banco
  db.prepare("DELETE FROM inscricoes").run();

  // 🔴 Zera também o contador de AUTOINCREMENT
  db.prepare("DELETE FROM sqlite_sequence WHERE name='inscricoes'").run();

  res.json({
    sucesso: true,
    modo,
    encontrados: inscricoes.length,
    resultados,
  });
});



// ======================
// 🚀 Iniciar servidor
// ======================
app.use("/uploads", express.static("uploads"));

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});