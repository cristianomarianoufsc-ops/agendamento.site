// ===================================================================
//                  ✅ SERVER.JS - VERSÃO COM CRITÉRIOS DINÂMICOS ✅
// ===================================================================

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs";
import PDFDocument from "pdfkit";
import cron from "node-cron";
import dotenv from "dotenv";
import { google } from "googleapis";
import Database from "better-sqlite3";
import nodemailer from "nodemailer";
import { parse } from "csv-parse/sync";
import archiver from "archiver";
import { PassThrough } from "stream";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

// --- 1. CONFIGURAÇÕES GERAIS E BANCO DE DADOS ---
const db = new Database("inscricoes.db");

// Tabela principal de inscrições (sem a coluna de avaliação)
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
    ensaio_eventId TEXT,
    montagem_inicio TEXT,
    montagem_fim TEXT,
    montagem_eventId TEXT,
    desmontagem_inicio TEXT,
    desmontagem_fim TEXT,
    desmontagem_eventId TEXT,
    eventos_json TEXT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ✅ NOVA TABELA: Para armazenar os e-mails dos avaliadores autorizados
db.exec(`
  CREATE TABLE IF NOT EXISTS evaluators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ✅ MIGRAÇÃO: Adiciona coluna password_hash se ela não existir
try {
  db.prepare("SELECT password_hash FROM evaluators LIMIT 1").get();
  console.log("✅ Coluna 'password_hash' já existe na tabela evaluators.");
} catch (error) {
  console.log("⚠️ Coluna 'password_hash' não encontrada. Adicionando...");
  try {
    db.exec(`ALTER TABLE evaluators ADD COLUMN password_hash TEXT;`);
    db.exec(`ALTER TABLE evaluators ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;`);
    console.log("✅ Colunas adicionadas com sucesso na tabela evaluators.");
  } catch (alterError) {
    console.error("❌ Erro ao adicionar colunas na tabela evaluators:", alterError);
  }
}

// ✅ NOVA TABELA: Para armazenar cada avaliação individual
db.exec(`
  CREATE TABLE IF NOT EXISTS assessments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inscription_id INTEGER NOT NULL,
    evaluator_email TEXT NOT NULL,
    scores_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inscription_id) REFERENCES inscricoes(id) ON DELETE CASCADE
  );
`);



// Adiciona um índice para garantir que um avaliador só possa ter uma avaliação por inscrição
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_inscription_evaluator ON assessments (inscription_id, evaluator_email);`);


// Tabela de critérios (sem alterações)
db.exec(`
  CREATE TABLE IF NOT EXISTS evaluation_criteria (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
    weight REAL NOT NULL, sort_order INTEGER NOT NULL
  );
`);

console.log("✅ Bancos de dados para múltiplos avaliadores verificados e prontos.");

// Migração de dados: Adiciona a coluna assessments_json se ela não existir
try {
  db.prepare("SELECT assessments_json FROM inscricoes LIMIT 1").get();
  console.log("✅ Coluna 'assessments_json' já existe.");
} catch (error) {
  console.log("⚠️ Coluna 'assessments_json' não encontrada. Adicionando...");
  try {
    db.exec(`ALTER TABLE inscricoes ADD COLUMN assessments_json TEXT;`);
    console.log("✅ Coluna 'assessments_json' adicionada com sucesso.");
  } catch (alterError) {
    console.error("❌ Erro crítico ao adicionar coluna 'assessments_json':", alterError);
  }
}

// ===================================================================
// ✅ FUNÇÃO AUXILIAR PARA PEGAR O NÚMERO DE AVALIAÇÕES REQUERIDAS
// ===================================================================
function getRequiredAssessments() {
  try {
    const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));
    if (config.requiredAssessments) {
      return parseInt(config.requiredAssessments, 10);
    }
  } catch (e) { /* ignora */ }
  return 3; // Valor padrão
}

// ===================================================================
// ✅ SCRIPT DE MIGRAÇÃO DE DADOS (Executa uma vez ao iniciar)
// ===================================================================
try {
  console.log("🚀 [MIGRAÇÃO] Verificando dados de avaliação antigos para migrar...");

  // 1. Pega os IDs dos critérios padrão que tínhamos antes (A, B, C, D)
  //    Isso é uma simulação, pois não temos os IDs reais. Vamos usar 'A', 'B', 'C', 'D' como IDs temporários.
  //    IMPORTANTE: Se você já salvou novos critérios dinâmicos, esta parte pode precisar de ajuste.
  //    Por agora, vamos assumir que os critérios antigos correspondem a IDs 'A', 'B', 'C', 'D'.
  const defaultCriteriaIds = {
    assessment_A: 'A',
    assessment_B: 'B',
    assessment_C: 'C',
    assessment_D: 'D'
  };

  // 2. Encontra todas as inscrições que foram avaliadas no sistema antigo mas não no novo
  const legacyAssessments = db.prepare(`
    SELECT id, assessment_A, assessment_B, assessment_C, assessment_D 
    FROM inscricoes 
    WHERE (assessment_A IS NOT NULL OR assessment_B IS NOT NULL) AND (assessments_json IS NULL OR assessments_json = '{}')
  `).all();

  if (legacyAssessments.length > 0) {
    console.log(`[MIGRAÇÃO] Encontradas ${legacyAssessments.length} inscrições com avaliações antigas. Migrando agora...`);
    
    const updateStmt = db.prepare('UPDATE inscricoes SET assessments_json = ? WHERE id = ?');

    for (const inscricao of legacyAssessments) {
      const newJson = {};
      // Constrói o novo objeto JSON
      if (inscricao.assessment_A !== null) newJson[defaultCriteriaIds.assessment_A] = inscricao.assessment_A;
      if (inscricao.assessment_B !== null) newJson[defaultCriteriaIds.assessment_B] = inscricao.assessment_B;
      if (inscricao.assessment_C !== null) newJson[defaultCriteriaIds.assessment_C] = inscricao.assessment_C;
      if (inscricao.assessment_D !== null) newJson[defaultCriteriaIds.assessment_D] = inscricao.assessment_D;
      
      // Salva o JSON na nova coluna
      updateStmt.run(JSON.stringify(newJson), inscricao.id);
      console.log(`[MIGRAÇÃO] ✅ Inscrição #${inscricao.id} migrada com sucesso.`);
    }
    console.log("[MIGRAÇÃO] Processo de migração concluído!");
  } else {
    console.log("[MIGRAÇÃO] Nenhuma avaliação antiga encontrada para migrar. Tudo certo!");
  }

} catch (migrationError) {
  // Se a migração falhar (ex: as colunas assessment_A não existem mais), apenas loga o erro sem quebrar o servidor.
  console.error("⚠️ Erro durante o script de migração de dados. Isso pode ser normal se as colunas antigas já foram removidas.", migrationError.message);
}
const app = express();
const port = process.env.PORT || 4000;
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- 2. AUTENTICAÇÃO E CLIENTES GOOGLE ---
const credentials = JSON.parse(fs.readFileSync("./credentials.json", "utf-8"));
const auth = new google.auth.JWT({
  email: credentials.client_email,
  key: credentials.private_key,
  scopes: [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
  ],
}  );

const calendar = google.calendar({ version: "v3", auth });
const drive = google.drive({ version: "v3", auth });
const sheets = google.sheets({ version: "v4", auth });
const calendarIds = {
  teatro: "cristianomariano.ufsc@gmail.com",
  igrejinha: "c_e19d30c40d4de176bc7d4e11ada96bfaffd130b3ed499d9807c88785e2c71c05@group.calendar.google.com",
};

// --- 3. CONFIGURACAO DO NODEMAILER ---
let transporter = null;

if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  transporter.verify((error, success) => {
    if (error) {
      console.error('❌ Erro ao conectar com o servidor de e-mail:', error.message);
      console.error('   -> Verifique se EMAIL_USER e EMAIL_PASSWORD estão corretos no .env.');
      console.error('   -> Se estiver usando Gmail, certifique-se de que a senha é uma "Senha de App".');
    } else {
      console.log('✅ Servidor de e-mail conectado com sucesso.');
    }
  });
} else {
  console.warn('⚠️ Variáveis de ambiente de e-mail (EMAIL_USER/EMAIL_PASSWORD) não encontradas. O envio de e-mails está desabilitado.');
}

// FUNCOES PARA GERAÇÃO DE SENHA E ENVIO DE EMAIL
function generateRandomPassword(length = 6) {
  const chars = '0123456789'; // Apenas dígitos
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function sendEvaluatorCredentials(email, password) {
  if (!transporter) {
    console.error('❌ Erro: Transporter de e-mail não configurado. Verifique EMAIL_USER e EMAIL_PASSWORD no .env');
    return false;
  }

  const mailOptions = {
    from: process.env.EMAIL_USER || 'seu-email@gmail.com',
    to: email,
    subject: 'Credenciais de Acesso - Sistema de Avaliação UFSC',
    html: `
      <h2>Bem-vindo ao Sistema de Avaliação</h2>
      <p>Você foi adicionado como avaliador no sistema de agendamento de espaços culturais da UFSC.</p>
      <p><strong>Suas credenciais de acesso:</strong></p>
      <ul>
        <li><strong>E-mail:</strong> ${email}</li>
        <li><strong>Senha:</strong> ${password}</li>
      </ul>
      <p>Acesse o sistema em: <a href="http://localhost:5173/admin-viewer">http://localhost:5173/admin-viewer</a></p>
      <p><strong>Importante:</strong> Guarde suas credenciais em local seguro. Você poderá alterar sua senha após o primeiro acesso.</p>
      <p>Atenciosamente,<br>Sistema de Agendamento UFSC</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email enviado com sucesso para:', email);
    return true;
  } catch (error) {
    console.error('Erro ao enviar email para', email, ':', error);
    return false;
  }
}

// --- 4. FUNCOES UTILITARIAS ---
function normalizeKey(key = "") {
  return key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

// ✅ FUNÇÃO ATUALIZADA para buscar pesos do novo banco de dados
async function getEvaluationCriteria() {
  try {
    const criteria = db.prepare('SELECT * FROM evaluation_criteria ORDER BY sort_order ASC').all();
    // Se não houver critérios, retorna um array vazio para não quebrar o frontend
    if (criteria.length === 0) {
        console.log("⚠️ Nenhum critério de avaliação encontrado no banco de dados.");
        return [];
    }
    return criteria;
  } catch (error) {
    console.error('Erro ao buscar critérios:', error);
    return []; // Retorna vazio em caso de erro
  }
}

// --- 4. CACHE DE EVENTOS DO CALENDÁRIO ---
let cacheEventos = {};
async function atualizarCache() {
  try {
    const agora = new Date();
    const start = agora.toISOString();
    const fim = new Date(agora.getTime());
    fim.setMonth(fim.getMonth() + 6);
    const end = fim.toISOString();
    for (const [local, calendarId] of Object.entries(calendarIds)) {
      try {
        // ... dentro de atualizarCache()
// ✅ PEDIMOS PARA A API RETORNAR AS PROPRIEDADES ESTENDIDAS
const res = await calendar.events.list({ 
  calendarId, 
  timeMin: start, 
  timeMax: end, 
  singleEvents: true, 
  orderBy: "startTime",
  fields: "items(id,summary,start,end,extendedProperties)" // Otimiza a resposta
});

cacheEventos[local] = (res.data.items || []).map((event) => {
  const props = event.extendedProperties?.private || {};
  const isManaged = props.managedBy === 'sistema-edital-dac';
  
  // ✅ LÓGICA DE CLASSIFICAÇÃO
  // Um evento é "disputável" (contestable) APENAS se for gerenciado pelo nosso sistema
  // e seu status ainda for 'pending_evaluation'.
  const isContestable = isManaged && props.status === 'pending_evaluation';

  return {
    id: event.id, 
    summary: event.summary,
    start: event.start.dateTime || `${event.start.date}T00:00:00`,
    end: event.end.dateTime || `${event.end.date}T23:59:59`,
    // ✅ NOVO CAMPO ENVIADO PARA O FRONTEND
    isContestable: isContestable 
  };
});
// ...

        console.log(`✅ Cache do ${local} atualizado.`);
      } catch (err) {
        console.error(`❌ Erro ao atualizar cache para ${local}:`, err.message);
      }
    }
  } catch (err) {
    console.error("❌ Erro geral na função atualizarCache:", err);
  }
}

// ===================================================================
// ✅ SEÇÃO DE SINCRONIZAÇÃO DA PLANILHA - VERSÃO FINAL E CORRIGIDA
// ===================================================================

const MASTER_SHEET_CONFIG_PATH = 'masterSheet.json';
const OWNER_EMAIL = 'cristianomariano.ufsc@gmail.com';
const ORIGINAL_FORMS_SHEET_ID = '1Fh8G2vQ1Tu4_qXghW6q5X2noxvUAuJA0m70pAwxka-s';

const COLUNAS_A_IGNORAR_KEYWORDS = [
  'carimbo de data/hora', 'endereco de e-mail', 'nome completo', 'celular (ddd + numero)',
  'cpf', 'cnpj', 'data e horario para montagem', 'data e horario para ensaio',
  'data e horario para realizacao do evento', 'data e horario para desmontagem', 'nome do evento'
];

// ===================================================================
// ✅ VERSÃO 22 - CORREÇÃO FINAL DO CICLO DE ATUALIZAÇÃO
//    (Substitua a função getOrCreateMasterSheet inteira por esta)
// ===================================================================

// ✅ SUBSTITUA A FUNÇÃO getOrCreateMasterSheet INTEIRA POR ESTA
async function getOrCreateMasterSheet() {
  const masterSheetId = '139ElhiQPcF91DDCjUk74tyRCfH8x2zZKaNESbrnl8tY';

  try {
    const headerCheck = await sheets.spreadsheets.values.get({
      spreadsheetId: masterSheetId,
      range: 'A1:A1',
    });

    // Se o cabeçalho não existir, cria um novo com a estrutura exata e final.
    if (!headerCheck.data.values || headerCheck.data.values.length === 0) {
      console.log('[MASTER-SHEET] Cabeçalho não encontrado. Criando a estrutura final...');

      const masterHeaders = [
        ['MÊS', 'ID INSCRIÇÃO', 'NOME DO EVENTO', 'NOME DO PROPONENTE', 'EMAIL', 
        'NECESSIDADE DE PAGAMENTO DE TAXA DE LOCAÇÃO',
        'NÚMERO DE PERÍODOS PARA LOCAÇÃO',
        'PROJETO EXTENSÃO DAC',
        'PONTUAÇÃO EDITAL EXTERNO',
        'LOCAL',
        'AGENDAMENTO DE ENSAIO', 'AGENDAMENTO DE MONTAGEM', 'AGENDAMENTOS DE EVENTO(S)', 'AGENDAMENTO DE DESMONTAGEM',
        'CONFLITO DE DATA',
        'ALTERAÇÃO DE DATA',
        'ENTREGA DO TERMO DE AUTORIZAÇÃO OCUPAÇÃO DO ESPAÇO',
        'OBSERVAÇÕES']
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId: masterSheetId, range: 'A1', valueInputOption: 'USER_ENTERED',
        resource: { values: masterHeaders },
      });
      
      console.log('[MASTER-SHEET] ✅ Estrutura final do cabeçalho criada com sucesso.');
    } else {
      console.log('[MASTER-SHEET] Cabeçalho já existe. Nenhuma ação necessária.');
    }

    return masterSheetId;

  } catch (error) {
      console.error('[MASTER-SHEET] ❌ Erro crítico ao criar/verificar cabeçalho:', error.message);
      return null;
  }
}





// ✅ SUBSTITUA A FUNÇÃO applyMasterSheetFormatting INTEIRA POR ESTA
async function applyMasterSheetFormatting(spreadsheetId) {
    try {
        console.log('[FORMATTING-V17] Aplicando formatação estrutural mínima...');
        const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets(properties,merges)' });
        const sheet = sheetInfo.data.sheets[0];
        const sheetId = sheet.properties.sheetId;
        let requests = [];

        // 1. Limpa APENAS as mesclagens antigas para evitar sobreposição
        if (sheet.merges) {
            requests.push(...sheet.merges.map(merge => ({ unmergeCells: { range: merge } })));
        }
        
        // 2. Garante que a primeira linha esteja sempre congelada
        requests.push({ 
            updateSheetProperties: { 
                properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, 
                fields: 'gridProperties.frozenRowCount' 
            } 
        });

        // 3. Lógica para mesclar as células dos meses (essencial para a estrutura)
        const data = (await sheets.spreadsheets.values.get({ spreadsheetId, range: 'A:A' })).data.values || [];
        const meses = data.slice(1).map(row => row[0]);
        let startRow = 1;

        for (let i = 0; i < meses.length; i++) {
            if (meses[i] && i > 0) {
                const endRow = i + 1;
                requests.push({ mergeCells: { range: { sheetId, startRowIndex: startRow, endRowIndex: endRow, startColumnIndex: 0, endColumnIndex: 1 }, mergeType: 'MERGE_ALL' } });
                startRow = endRow;
            }
        }
        if (meses.length > 0) {
            const endRow = meses.length + 1;
            requests.push({ mergeCells: { range: { sheetId, startRowIndex: startRow, endRowIndex: endRow, startColumnIndex: 0, endColumnIndex: 1 }, mergeType: 'MERGE_ALL' } });
        }

        // 4. Executa as requisições se houver alguma
        if (requests.length > 0) {
            await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
            console.log('[FORMATTING-V17] ✅ Formatação estrutural aplicada.');
        }
    } catch (error) {
        console.error('[FORMATTING-V17] ❌ Erro ao aplicar formatação estrutural:', error.message, error.stack);
    }
}



// --- FUNÇÃO 3: POPULAR A PLANILHA (VERSÃO FINAL COM ÍNDICES CORRIGIDOS) ---
let isJobRunning = false;

// ✅ SUBSTITUA A FUNÇÃO popularPlanilhaMestre INTEIRA POR ESTA
async function popularPlanilhaMestre() {
  if (isJobRunning) {
    console.log('[SYNC-JOB] ⚠️ Job anterior ainda em execução. Pulando este ciclo.');
    return;
  }
  isJobRunning = true;
  console.log('[SYNC-JOB-V30] 🚀 Iniciando job (MODO ASSISTENTE - APENAS DADOS)...');
  
  try {
    const masterSheetId = await getOrCreateMasterSheet(); 
    if (!masterSheetId) {
        isJobRunning = false;
        return;
    };

    const idsNaPlanilhaResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: masterSheetId,
        range: 'B:B',
    });
    const idsNaPlanilha = new Set(idsNaPlanilhaResponse.data.values?.slice(1).flat() || []);
    console.log(`[SYNC-JOB-V30] Encontrados ${idsNaPlanilha.size} IDs na planilha.`);

    const inscricoesDB = db.prepare("SELECT * FROM inscricoes ORDER BY id ASC").all();
    const csvExport = await drive.files.export({ fileId: ORIGINAL_FORMS_SHEET_ID, mimeType: 'text/csv' });
    const csv = Buffer.from(csvExport.data).toString('utf8').replace(/^\uFEFF/, "");
    const delimiter = (csv.match(/;/g) || []).length > (csv.match(/,/g) || []).length ? ";" : ",";
    const recordsForms = parse(csv, { columns: true, skip_empty_lines: true, delimiter });

    const inscricoesCompletas = inscricoesDB.map(inscricao => {
      const emailEtapa1 = (inscricao.email || "").trim().toLowerCase();
      const telEtapa1 = (inscricao.telefone || "").replace(/\D/g, "");
      const respostaForms = recordsForms.find(f => {
        const emailKey = Object.keys(f).find(k => normalizeKey(k).includes('mail'));
        const telKey = Object.keys(f).find(k => normalizeKey(k).includes('fone'));
        const emailForms = emailKey ? (f[emailKey] || "").trim().toLowerCase() : null;
        const telForms = telKey ? (f[telKey] || "").replace(/\D/g, "") : null;
        return (emailForms && emailEtapa1 && emailForms === emailEtapa1) || (telForms && telEtapa1 && telForms === telEtapa1);
      });
      const eventos = JSON.parse(inscricao.eventos_json || '[]');
      const dataPrincipal = eventos.length > 0 ? eventos[0].inicio : (inscricao.ensaio_inicio || inscricao.criado_em);
      return { ...inscricao, formsData: respostaForms || {}, dataPrincipal: new Date(dataPrincipal) };
    });

    inscricoesCompletas.sort((a, b) => a.dataPrincipal - b.dataPrincipal);

    const novasLinhasParaAdicionar = [];
    let mesAnterior = null;
    
    const formatarEtapa = (inicio, fim) => {
        if (!inicio || !fim) return '';
        const opcoesData = { day: '2-digit', month: '2-digit' };
        const data = new Date(inicio).toLocaleDateString('pt-BR', opcoesData);
        const hIni = new Date(inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const hFim = new Date(fim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return `${data} (${hIni} - ${hFim})`;
    };

    for (const inscricao of inscricoesCompletas) {
        if (idsNaPlanilha.has(String(inscricao.id))) {
            continue;
        }

        const mesAtual = inscricao.dataPrincipal.toLocaleString('pt-BR', { month: 'long' }).toUpperCase();
        const nomeMesParaExibir = mesAnterior !== mesAtual ? mesAtual : '';
        mesAnterior = mesAtual;

        const { formsData } = inscricao;
        
        const gratuitoKey = Object.keys(formsData).find(k => normalizeKey(k).includes('o evento sera gratuito?'));
        const projetoDacKey = Object.keys(formsData).find(k => normalizeKey(k).includes('tem interesse em inserir a proposta'));

        const nomeLocal = inscricao.local === 'teatro' ? 'Teatro' : 'Igrejinha';
        const eventoGratuito = (gratuitoKey && formsData[gratuitoKey]) || '';
        const projetoDac = (projetoDacKey && formsData[projetoDacKey]) || '';
        
        const eventosFormatados = JSON.parse(inscricao.eventos_json || '[]').map(ev => formatarEtapa(ev.inicio, ev.fim)).join('\n');

        const novaLinha = [
            nomeMesParaExibir, inscricao.id, inscricao.evento_nome, inscricao.nome, inscricao.email,
            eventoGratuito, '', projetoDac, '', nomeLocal,
            formatarEtapa(inscricao.ensaio_inicio, inscricao.ensaio_fim),
            formatarEtapa(inscricao.montagem_inicio, inscricao.montagem_fim),
            eventosFormatados,
            formatarEtapa(inscricao.desmontagem_inicio, inscricao.desmontagem_fim),
            '', '', '', ''
        ];
        novasLinhasParaAdicionar.push(novaLinha);
    }
    
    if (novasLinhasParaAdicionar.length > 0) {
        await sheets.spreadsheets.values.append({
            spreadsheetId: masterSheetId,
            range: 'A1',
            valueInputOption: 'USER_ENTERED',
            resource: { values: novasLinhasParaAdicionar },
        });
        console.log(`[SYNC-JOB-V30] ✅ ${novasLinhasParaAdicionar.length} nova(s) linha(s) de dados adicionada(s).`);
    } else {
        console.log('[SYNC-JOB-V30] Nenhuma nova inscrição para adicionar.');
    }

    await applyMasterSheetFormatting(masterSheetId);

  } catch (error) {
    console.error('[SYNC-JOB-V30] ❌ Erro durante a execução do job:', error.message, error.stack);
  } finally {
    isJobRunning = false;
    console.log('[SYNC-JOB-V30] 🏁 Job finalizado. Trava liberada.');
  }
}



// --- AGENDADOR DO CRON ---
cron.schedule("*/30 * * * * *", popularPlanilhaMestre);

// ===================================================================
// ✅ VERSÃO 2 - CORRIGIDA PARA NÃO MOSTRAR ETAPA 2 EM ENSAIOS
// ===================================================================
async function gerarPdfCompleto(inscricaoId) {
  return new Promise(async (resolve, reject) => {
    try {
      // Etapa 1: Buscar dados da inscrição no banco
      const inscricao = db.prepare("SELECT * FROM inscricoes WHERE id = ?").get(inscricaoId);
      if (!inscricao) return reject(new Error(`Inscrição ${inscricaoId} não encontrada.`));

      // --- Conteúdo do PDF ---
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];
      doc.on("data", chunk => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      doc.fontSize(18).font('Helvetica-Bold').text("Formulário de Inscrição", { align: "center" });
      doc.fontSize(12).font('Helvetica').text(`Inscrição #${inscricao.id}`, { align: "center" }).moveDown(2);
      
      doc.font('Helvetica-Bold').fontSize(14).text("1. DADOS DO PROPONENTE (Etapa 1)");
      doc.font('Helvetica').fontSize(10)
        .text(`Nome: ${inscricao.nome || "N/A"}`)
        .text(`Email: ${inscricao.email || "N/A"}`)
        .text(`Telefone: ${inscricao.telefone || "N/A"}`)
        .text(`Nome do Evento: ${inscricao.evento_nome || "N/A"}`)
        .text(`Local: ${inscricao.local || "N/A"}`).moveDown(1.5);

      doc.font('Helvetica-Bold').fontSize(14).text("2. AGENDAMENTOS REALIZADOS");
      const linhaEtapa = (rotulo, inicio, fim) => {
        if (!inicio || !fim) return;
        const data = new Date(inicio).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit', year: 'numeric' });
        const hIni = new Date(inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        const hFim = new Date(fim).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        doc.font('Helvetica').fontSize(10).text(`• ${rotulo}: ${data}, das ${hIni} às ${hFim}`);
      };
      linhaEtapa("Ensaio", inscricao.ensaio_inicio, inscricao.ensaio_fim);
      if (inscricao.eventos_json && inscricao.eventos_json !== '[]') {
        JSON.parse(inscricao.eventos_json).forEach((ev, i) => linhaEtapa(`Evento ${i + 1}`, ev.inicio, ev.fim));
      }
      linhaEtapa("Montagem", inscricao.montagem_inicio, inscricao.montagem_fim);
      linhaEtapa("Desmontagem", inscricao.desmontagem_inicio, inscricao.desmontagem_fim);
      doc.moveDown(1.5);

      // ✅ AQUI ESTÁ A LÓGICA DE VERIFICAÇÃO
      // Define se a inscrição é um evento completo ou apenas um ensaio
      const isEventoCompleto = inscricao.eventos_json !== '[]' || inscricao.montagem_inicio || inscricao.desmontagem_inicio;

      // Só tenta buscar e mostrar a Etapa 2 se for um evento completo
      if (isEventoCompleto) {
        let respostaForms = null;
        try {
          const cfg = JSON.parse(fs.readFileSync("config.json", "utf-8"));
          const sheetId = cfg.sheetId;

          if (sheetId) {
            const csvExport = await drive.files.export({ fileId: sheetId, mimeType: "text/csv" });
            let csv = Buffer.from(csvExport.data).toString("utf8").replace(/^\uFEFF/, "");
            const delimiter = (csv.match(/;/g) || []).length > (csv.match(/,/g) || []).length ? ";" : ",";
            const records = parse(csv, { columns: true, skip_empty_lines: true, delimiter });

            respostaForms = records.find(f => {
              const emailKey = Object.keys(f).find(k => k.toLowerCase().includes("mail"));
              const telKey = Object.keys(f).find(k => k.toLowerCase().includes("fone") || k.toLowerCase().includes("telefone"));
              const emailForms = emailKey ? (f[emailKey] || "").trim().toLowerCase() : null;
              const telForms = telKey ? (f[telKey] || "").replace(/\D/g, "") : null;
              const emailEtapa1 = (inscricao.email || "").trim().toLowerCase();
              const telEtapa1 = (inscricao.telefone || "").replace(/\D/g, "");
              return (emailForms && emailEtapa1 && emailForms === emailEtapa1) || (telForms && telEtapa1 && telForms === telEtapa1);
            });
          }
        } catch (e) {
          console.error("Erro ao buscar dados do Forms para o PDF:", e.message);
        }

        doc.font('Helvetica-Bold').fontSize(14).text("3. DETALHAMENTO DO EVENTO (Etapa 2)");
        if (respostaForms) {
          doc.font('Helvetica').fontSize(10);
          for (const [key, value] of Object.entries(respostaForms)) {
            if (normalizeKey(key).includes('carimbo de data/hora') || !value || String(value).trim() === "") continue;
            doc.font('Helvetica-Bold').text(key, { continued: true }).font('Helvetica').text(`: ${value}`);
          }
        } else {
          doc.font('Helvetica-Oblique').fontSize(10).text("O proponente ainda não preencheu o formulário da Etapa 2.");
        }
      }
      // Se não for um evento completo (ou seja, for um ensaio puro), o código simplesmente não faz nada e finaliza o PDF.

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ✅ 1. ADICIONE ESTA NOVA FUNÇÃO UTILITÁRIA
async function getInscricaoCompleta(inscricaoId) {
  const inscricao = db.prepare("SELECT * FROM inscricoes WHERE id = ?").get(inscricaoId);
  if (!inscricao) return null;

  try {
    const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));
    // Garante que os novos campos existam, caso o arquivo config.json seja antigo
    if (!config.buttonExternalEditalText) {
        config.buttonExternalEditalText = defaultConfig.buttonExternalEditalText;
    }
    if (!config.blockedDates) {
        config.blockedDates = defaultConfig.blockedDates;
    }
    if (!config.stageTimes) {
        config.stageTimes = defaultConfig.stageTimes;
    }
    if (!config.sheetId) {
      return { ...inscricao, etapa2_ok: false, formsData: null };
    }

    const response = await sheets.spreadsheets.values.get({ spreadsheetId: config.sheetId, range: "A:ZZ" });
    const rowsForms = response.data.values || [];
    if (rowsForms.length < 2) {
      return { ...inscricao, etapa2_ok: false, formsData: null };
    }

    const headers = rowsForms[0].map(h => normalizeKey(h));
    const formsData = rowsForms.slice(1).map(row =>
      headers.reduce((acc, h, i) => ({ ...acc, [h]: row[i] || "" }), {})
    );

    const emailEtapa1 = (inscricao.email || "").trim().toLowerCase();
    const telEtapa1 = (inscricao.telefone || "").replace(/\D/g, "");

    const match = formsData.find(f => {
      const emailKey = Object.keys(f).find(k => k.includes('mail'));
      const telKey = Object.keys(f).find(k => k.includes('fone') || k.includes('telefone'));
      const emailForms = emailKey ? (f[emailKey] || "").trim().toLowerCase() : null;
      const telForms = telKey ? (f[telKey] || "").replace(/\D/g, "") : null;
      return (emailForms && emailEtapa1 && emailForms === emailEtapa1) || (telForms && telEtapa1 && telForms === telEtapa1);
    });

    return { ...inscricao, etapa2_ok: !!match, formsData: match || null };
  } catch (error) {
    console.error("Erro ao buscar dados da planilha para unificação:", error.message);
    return { ...inscricao, etapa2_ok: false, formsData: null, erro_api: true };
  }
}

// ✅ 1. ADICIONE ESTA NOVA FUNÇÃO PARA GERAR O PDF
function gerarPdfParaInscricao(doc, inscricaoCompleta) {
  // --- CABEÇALHO ---
  doc.fontSize(18).font('Helvetica-Bold').text("Formulário de Inscrição", { align: "center" });
  doc.fontSize(12).font('Helvetica').text(`Inscrição #${inscricaoCompleta.id}`, { align: "center" }).moveDown(2);

  // --- DADOS DA ETAPA 1 ---
  doc.font('Helvetica-Bold').fontSize(14).text("1. DADOS DO PROPONENTE (Etapa 1)");
  doc.font('Helvetica').fontSize(10)
    .text(`Nome: ${inscricaoCompleta.nome || "N/A"}`)
    .text(`Email: ${inscricaoCompleta.email || "N/A"}`)
    .text(`Telefone: ${inscricaoCompleta.telefone || "N/A"}`)
    .text(`Nome do Evento: ${inscricaoCompleta.evento_nome || "N/A"}`)
    .text(`Local: ${inscricaoCompleta.local || "N/A"}`).moveDown(1.5);

  // --- ETAPAS AGENDADAS ---
  doc.font('Helvetica-Bold').fontSize(14).text("2. AGENDAMENTOS REALIZADOS");
  const linhaEtapa = (rotulo, inicio, fim) => {
    if (!inicio || !fim) return;
    const data = new Date(inicio).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hIni = new Date(inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const hFim = new Date(fim).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    doc.font('Helvetica').fontSize(10).text(`• ${rotulo}: ${data}, das ${hIni} às ${hFim}`);
  };
  linhaEtapa("Ensaio", inscricaoCompleta.ensaio_inicio, inscricaoCompleta.ensaio_fim);
  linhaEtapa("Montagem", inscricaoCompleta.montagem_inicio, inscricaoCompleta.montagem_fim);
  if (inscricaoCompleta.eventos_json && inscricaoCompleta.eventos_json !== '[]') {
    JSON.parse(inscricaoCompleta.eventos_json).forEach((ev, i) => linhaEtapa(`Evento ${i + 1}`, ev.inicio, ev.fim));
  }
  linhaEtapa("Desmontagem", inscricaoCompleta.desmontagem_inicio, inscricaoCompleta.desmontagem_fim);
  doc.moveDown(1.5);

  // --- DADOS DA ETAPA 2 (GOOGLE FORMS) ---
  doc.font('Helvetica-Bold').fontSize(14).text("3. DETALHAMENTO DO EVENTO (Etapa 2)");
  if (inscricaoCompleta.etapa2_ok && inscricaoCompleta.formsData) {
    doc.font('Helvetica').fontSize(10);
    for (const [key, value] of Object.entries(inscricaoCompleta.formsData)) {
      if (normalizeKey(key).includes('carimbo de data/hora')) continue;
      if (value && String(value).trim() !== "") {
        doc.font('Helvetica-Bold').text(key, { continued: true }).font('Helvetica').text(`: ${value}`);
      }
    }
  } else {
    doc.font('Helvetica-Oblique').fontSize(10).text("O proponente ainda não preencheu o formulário da Etapa 2.");
  }
}


// ===================================================================
// 🏁 ENDPOINTS DA API (TODOS COM LÓGICA COMPLETA)
// ===================================================================

// Rota para buscar horários
app.get("/ical/:local/horarios", (req, res) => res.json({ eventos: cacheEventos[req.params.local] || [] }));

// ===================================================================
// 🏁 ENDPOINTS DA API (SEÇÃO DE CONFIGURAÇÃO ATUALIZADA)
// ===================================================================

// CÓDIGO CORRIGIDO em server.js
app.get("/api/config", (req, res) => {
  try {
    // Define todos os valores padrão em um único lugar
    const defaultConfig = {
  // Configurações de Horário e Data
  blockedDates: [], // Datas bloqueadas no formato YYYY-MM-DD
  stageTimes: {
    ensaio: { start: "08:00", end: "21:00" },
    montagem: { start: "08:00", end: "21:00" },
    evento: { start: "08:00", end: "21:00" },
    desmontagem: { start: "08:00", end: "21:00" },
  },
  buttonExternalEditalText: "Edital Externo",
      formsLink: "",
      sheetLink: "",
      sheetId: "",
      weights: { A: 1, B: 1, C: 1, D: 1 },
      pageTitle: "Sistema de Agendamento de Espaços",
      allowBookingOverlap: false,
      // ✅ NOVOS CAMPOS COM VALORES PADRÃO
      enableInternalEdital: false, // Começa desativado
      enableExternalEdital: true,  // Começa ativado
      enableRehearsal: true,     // Começa ativado
	  requiredAssessments: 3, // Valor padrão, pode ser qualquer número
    };

    if (fs.existsSync("config.json")) {
      const savedConfig = JSON.parse(fs.readFileSync("config.json", "utf-8"));
      // Mescla o padrão com o que foi salvo, garantindo que os novos campos sempre existam
      const fullConfig = { ...defaultConfig, ...savedConfig };
      res.json(fullConfig);
    } else {
      // Se o arquivo não existe, envia a configuração padrão
      res.json(defaultConfig);
    }
  } catch (e) {
    res.status(500).json({ error: "Erro ao ler arquivo de configuração." });
  }
});

// ===================================================================
// ✅ NOVOS ENDPOINTS PARA GERENCIAR AVALIADORES E AUTENTICAÇÃO
// ===================================================================

// Endpoint para buscar a lista de avaliadores
app.get('/api/evaluators', (req, res) => {
  try {
    const evaluators = db.prepare('SELECT * FROM evaluators ORDER BY email ASC').all();
    res.json(evaluators);
  } catch (error) {
    console.error('Erro ao buscar avaliadores:', error);
    res.status(500).json({ error: 'Erro ao buscar lista de avaliadores.' });
  }
});

app.post('/api/evaluators', async (req, res) => {
  const { emails } = req.body;
  if (!Array.isArray(emails)) {
    return res.status(400).json({ error: 'O corpo da requisição deve ser um array de e-mails.' });
  }

  const results = [];
  const errors = [];

  try {
    // 1. Buscar avaliadores existentes para comparação
    const existingEvaluators = db.prepare('SELECT email FROM evaluators').all().map(e => e.email);
    const emailsToKeep = new Set(emails.map(e => e.trim().toLowerCase()).filter(e => e !== ''));
    const emailsToRemove = existingEvaluators.filter(email => !emailsToKeep.has(email));
    
    // 2. Remover avaliadores que não estão na nova lista
    if (emailsToRemove.length > 0) {
        const placeholders = emailsToRemove.map(() => '?').join(',');
        db.prepare(`DELETE FROM evaluators WHERE email IN (${placeholders})`).run(...emailsToRemove);
    }

    for (const email of emails) {
      if (!email || email.trim() === '') continue;

      const normalizedEmail = email.trim().toLowerCase();
      const isNewEvaluator = !existingEvaluators.includes(normalizedEmail);

      if (isNewEvaluator) {
        // Apenas para novos avaliadores: gerar senha, hash e enviar e-mail
        const password = generateRandomPassword(6);
        const passwordHash = await bcrypt.hash(password, 10);

        try {
          // Usar REPLACE INTO para garantir que, se por algum motivo o e-mail já existir, ele seja atualizado
          db.prepare('REPLACE INTO evaluators (email, password_hash) VALUES (?, ?)').run(normalizedEmail, passwordHash);
          const emailSent = await sendEvaluatorCredentials(normalizedEmail, password);

          results.push({
            email: normalizedEmail,
            success: emailSent,
            message: emailSent ? 'Avaliador adicionado e e-mail enviado com sucesso.' : 'Avaliador adicionado, mas houve erro ao enviar e-mail.'
          });
        } catch (insertError) {
          errors.push({
            email: normalizedEmail,
            error: insertError.message
          });
        }
      } else {
        // Avaliador existente: apenas confirma que foi mantido
        results.push({
            email: normalizedEmail,
            success: true,
            message: 'Avaliador existente mantido. Nenhuma alteração de senha ou e-mail enviada.'
        });
      }
    }

    res.status(200).json({
      success: errors.length === 0,
      message: 'Processamento de avaliadores concluído.',
      results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Erro ao salvar avaliadores:', error);
    res.status(500).json({ error: 'Erro ao salvar a lista de avaliadores.' });
  }
});

app.post('/api/auth/viewer', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }
    try {
        const evaluator = db.prepare('SELECT * FROM evaluators WHERE email = ?').get(email.trim().toLowerCase());
        if (!evaluator) {
            return res.status(403).json({ success: false, message: 'Acesso negado. E-mail não encontrado.' });
        }

        // 1. Verifica se o avaliador tem um hash de senha
        if (!evaluator.password_hash) {
            // Se não tiver hash, significa que é um avaliador antigo ou houve um erro.
            // Para manter a compatibilidade, podemos permitir o login apenas por e-mail se não houver hash,
            // mas a intenção é forçar a senha. Vamos forçar a senha.
            return res.status(403).json({ success: false, message: 'Acesso negado. Senha não configurada. Tente adicionar o avaliador novamente.' });
        }

        // 2. Compara a senha fornecida com o hash armazenado
        const match = await bcrypt.compare(password, evaluator.password_hash);

        if (match) {
            res.json({ success: true, message: 'Acesso autorizado.' });
        } else {
            res.status(403).json({ success: false, message: 'Acesso negado. Senha incorreta.' });
        }
    } catch (error) {
        console.error('Erro na autenticação do avaliador:', error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
});


// NOVO: Endpoint unificado para SALVAR a configuração
app.post("/api/config", (req, res) => {
  try {
    const newConfigData = req.body;
    let currentConfig = {};

    // 1. Lê a configuração atual, se existir
    if (fs.existsSync("config.json")) {
      try {
        currentConfig = JSON.parse(fs.readFileSync("config.json", "utf-8"));
      } catch (e) {
        console.warn("config.json estava corrompido, criando um novo.");
        currentConfig = {};
      }
    }

    // 2. Mescla a configuração atual com os novos dados recebidos
    const updatedConfig = { ...currentConfig, ...newConfigData };

    // Validação e limpeza para o novo campo
    if (updatedConfig.buttonExternalEditalText && updatedConfig.buttonExternalEditalText.length > 50) {
        updatedConfig.buttonExternalEditalText = updatedConfig.buttonExternalEditalText.substring(0, 50);
    }

    // ✅ ALTERAÇÃO CRUCIAL: Sempre recalcula o sheetId se o sheetLink existir
    if (updatedConfig.sheetLink) {
      const match = updatedConfig.sheetLink.match(/\/d\/([a-zA-Z0-9-_]+)/);
      updatedConfig.sheetId = match ? match[1] : ""; // Se não encontrar, define como vazio
    }

    // 5. Salva o arquivo completo
    fs.writeFileSync("config.json", JSON.stringify(updatedConfig, null, 2));
    res.json({ success: true, ...updatedConfig });
    
  } catch (err) {
    console.error("Erro em POST /api/config:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
// ✅ NOVOS ENDPOINTS PARA CRITÉRIOS DINÂMICOS
app.get('/api/criteria', (req, res) => {
  try {
    const criteria = db.prepare('SELECT * FROM evaluation_criteria ORDER BY sort_order ASC').all();
    res.json(criteria);
  } catch (error) {
    console.error('Erro ao buscar critérios:', error);
    res.status(500).json({ error: 'Erro ao buscar critérios de avaliação.' });
  }
});

app.post('/api/criteria', (req, res) => {
  const criteriaList = req.body; // Espera um array de objetos

  if (!Array.isArray(criteriaList)) {
    return res.status(400).json({ error: 'O corpo da requisição deve ser um array de critérios.' });
  }

  const insert = db.prepare('INSERT OR REPLACE INTO evaluation_criteria (id, title, description, weight, sort_order) VALUES (@id, @title, @description, @weight, @sort_order)');
  
  const transaction = db.transaction((criteria) => {
    // Primeiro, limpa a tabela para garantir que apenas os novos critérios existam
    db.exec('DELETE FROM evaluation_criteria');
    // Depois, insere todos os novos critérios
    for (const criterion of criteria) {
      insert.run(criterion);
    }
  });

  try {
    transaction(criteriaList);
    res.status(200).json({ success: true, message: 'Critérios de avaliação salvos com sucesso.' });
  } catch (error) {
    console.error('Erro ao salvar critérios:', error);
    res.status(500).json({ error: 'Erro ao salvar os critérios no banco de dados.' });
  }
});


app.get("/api/inscricoes", async (req, res) => {
  try {
    const criteria = await getEvaluationCriteria();
    const inscriptions = db.prepare("SELECT * FROM inscricoes ORDER BY criado_em DESC").all();
    const allAssessments = db.prepare("SELECT * FROM assessments").all();
    const totalEvaluators = db.prepare('SELECT COUNT(*) as count FROM evaluators').get().count;

    // ✅ LÓGICA DE DETECÇÃO DE CONFLITO (GARANTIDA QUE ESTÁ AQUI)
    const allSlots = [];
    inscriptions.forEach(insc => {
      const addSlot = (start, end, id) => {
        if (start && end) {
          allSlots.push({ start: new Date(start), end: new Date(end), id, local: insc.local });
        }
      };
      addSlot(insc.ensaio_inicio, insc.ensaio_fim, insc.id);
      addSlot(insc.montagem_inicio, insc.montagem_fim, insc.id);
      addSlot(insc.desmontagem_inicio, insc.desmontagem_fim, insc.id);
      if (insc.eventos_json) {
        JSON.parse(insc.eventos_json).forEach(ev => addSlot(ev.inicio, ev.fim, insc.id));
      }
    });

    const inscriptionsWithScores = inscriptions.map(inscription => {
      const relatedAssessments = allAssessments.filter(a => a.inscription_id === inscription.id);
      let finalScore = null;
      
      let requiredAssessmentsForScore = 3;
      try {
        const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));
    // Garante que os novos campos existam, caso o arquivo config.json seja antigo
    if (!config.buttonExternalEditalText) {
        config.buttonExternalEditalText = defaultConfig.buttonExternalEditalText;
    }
    if (!config.blockedDates) {
        config.blockedDates = defaultConfig.blockedDates;
    }
    if (!config.stageTimes) {
        config.stageTimes = defaultConfig.stageTimes;
    }
        if (config.requiredAssessments) {
          requiredAssessmentsForScore = parseInt(config.requiredAssessments, 10);
        }
      } catch (e) { /* ignora */ }

      if (relatedAssessments.length >= requiredAssessmentsForScore && requiredAssessmentsForScore > 0) {
        let totalScoreSum = 0;
        const assessmentsForScore = relatedAssessments.slice(0, requiredAssessmentsForScore);
        assessmentsForScore.forEach(assessment => {
          const scores = JSON.parse(assessment.scores_json);
          let singleEvaluationScore = 0;
          criteria.forEach(crit => {
            const scoreValue = scores[crit.id] || 0;
            const weightValue = crit.weight || 1;
            singleEvaluationScore += scoreValue * weightValue;
          });
          totalScoreSum += singleEvaluationScore;
        });
        finalScore = totalScoreSum / assessmentsForScore.length;
      }
      
      // ✅ LÓGICA DE VERIFICAÇÃO DE CONFLITO (GARANTIDA QUE ESTÁ AQUI)
      const inscriptionSlots = allSlots.filter(s => s.id === inscription.id);
      let hasConflict = false;
      for (const mySlot of inscriptionSlots) {
        const conflictingSlot = allSlots.find(otherSlot => 
          mySlot.id !== otherSlot.id &&
          mySlot.local === otherSlot.local &&
          mySlot.start < otherSlot.end &&
          mySlot.end > otherSlot.start
        );
        if (conflictingSlot) {
          hasConflict = true;
          break;
        }
      }

      return { 
        ...inscription, 
        finalScore, 
        allAssessments: relatedAssessments, 
        assessmentsCount: relatedAssessments.length, 
        evaluatorsWhoAssessed: relatedAssessments.map(a => a.evaluator_email), 
        totalEvaluators,
        hasConflict // A flag de conflito é adicionada aqui
      };
    });

    // O resto da rota para unificar com o Google Forms...
    let formsDataRows = [];
    try {
      const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));
    // Garante que os novos campos existam, caso o arquivo config.json seja antigo
    if (!config.buttonExternalEditalText) {
        config.buttonExternalEditalText = defaultConfig.buttonExternalEditalText;
    }
    if (!config.blockedDates) {
        config.blockedDates = defaultConfig.blockedDates;
    }
    if (!config.stageTimes) {
        config.stageTimes = defaultConfig.stageTimes;
    }
      if (config.sheetId) {
        const response = await sheets.spreadsheets.values.get({ spreadsheetId: config.sheetId, range: "A:ZZ" });
        const rows = (response.data.values || []);
        if (rows.length > 1) {
          const headers = rows[0];
          formsDataRows = rows.slice(1).map(row => headers.reduce((acc, header, index) => ({ ...acc, [header]: row[index] || "" }), {}));
        }
      }
    } catch (e) {
      console.warn("⚠️ [UNIFY] Aviso: Não foi possível buscar dados da planilha.", e.message);
    }

    const inscricoesCompletas = inscriptionsWithScores.map(inscricao => {
      const emailEtapa1 = (inscricao.email || "").trim().toLowerCase();
      const telEtapa1 = (inscricao.telefone || "").replace(/\D/g, "");
      
      const match = formsDataRows.find(rowData => {
        let emailForms = '', telForms = '';
        for (const key in rowData) {
            const normalizedKey = normalizeKey(key);
            if (normalizedKey.includes('mail')) emailForms = (rowData[key] || "").trim().toLowerCase();
            if (normalizedKey.includes('fone') || normalizedKey.includes('telefone')) telForms = (rowData[key] || "").replace(/\D/g, "");
        }
        return (emailForms && emailEtapa1 && emailForms === emailEtapa1) || (telForms && telEtapa1 && telForms === telEtapa1);
      });

      let proponenteTipo = 'Não identificado';
      if (match) {
        const tipoKey = Object.keys(match).find(key => {
          const normalized = normalizeKey(key);
          return normalized.includes('inscreve') || normalized.includes('inscrevera');
        });
        if (tipoKey && match[tipoKey]) {
          proponenteTipo = match[tipoKey];
        }
      }

      return { 
        ...inscricao, 
        etapa2_ok: !!match, 
        formsData: match || null,
        proponenteTipo: proponenteTipo 
      };
    });

    let requiredAssessments = 3;
    try {
      const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));
    // Garante que os novos campos existam, caso o arquivo config.json seja antigo
    if (!config.buttonExternalEditalText) {
        config.buttonExternalEditalText = defaultConfig.buttonExternalEditalText;
    }
    if (!config.blockedDates) {
        config.blockedDates = defaultConfig.blockedDates;
    }
    if (!config.stageTimes) {
        config.stageTimes = defaultConfig.stageTimes;
    }
      if (config.requiredAssessments) {
        requiredAssessments = parseInt(config.requiredAssessments, 10);
      }
    } catch (e) {
      console.warn("Aviso: Não foi possível ler 'requiredAssessments' do config.json. Usando valor padrão.");
    }

    const inscricoesCompletasComTarget = inscricoesCompletas.map(inscricao => ({
      ...inscricao,
      requiredAssessments: requiredAssessments,
    }));

    res.json({ inscricoes: inscricoesCompletasComTarget, criteria });

  } catch (err) {
    console.error("❌ Erro em /api/inscricoes:", err.message, err.stack);
    res.status(500).json({ error: "Erro crítico ao processar inscrições.", details: err.message });
  }
});

// ===================================================================
// ✅ FUNÇÕES AUXILIARES PARA CONSOLIDAÇÃO DE AGENDA
// ===================================================================

/**
 * Calcula a pontuação final de uma inscrição com base nas avaliações e critérios.
 * @param {number} inscriptionId - ID da inscrição.
 * @param {Array<Object>} criteria - Lista de critérios de avaliação com pesos.
 * @returns {number|null} Pontuação final ou null se não houver avaliações suficientes.
 */
function calculateFinalScore(inscriptionId, criteria) {
  const requiredAssessments = getRequiredAssessments(); // Assume que esta função existe ou usa um valor padrão
  const relatedAssessments = db.prepare("SELECT scores_json FROM assessments WHERE inscription_id = ?").all(inscriptionId);

  if (relatedAssessments.length < requiredAssessments || requiredAssessments === 0) {
    return null;
  }

  let totalScoreSum = 0;
  const assessmentsForScore = relatedAssessments.slice(0, requiredAssessments);

  assessmentsForScore.forEach(assessment => {
    const scores = JSON.parse(assessment.scores_json);
    let singleEvaluationScore = 0;
    let totalWeight = 0;

    criteria.forEach(crit => {
      const scoreValue = scores[crit.id] || 0;
      const weightValue = crit.weight || 1;
      singleEvaluationScore += scoreValue * weightValue;
      totalWeight += weightValue;
    });

    // Calcula a média ponderada da avaliação individual
    const weightedAverage = totalWeight > 0 ? singleEvaluationScore / totalWeight : 0;
    totalScoreSum += weightedAverage;
  });

  // Retorna a média das médias ponderadas
  return totalScoreSum / assessmentsForScore.length;
}

/**
 * Remove um evento do Google Calendar e limpa o eventId no banco de dados.
 * @param {string} local - 'teatro' ou 'igrejinha'.
 * @param {number} inscriptionId - ID da inscrição.
 * @param {string} eventType - 'ensaio', 'montagem', 'desmontagem', ou 'evento'.
 * @param {string} eventId - ID do evento no Google Calendar.
 */
async function deleteCalendarEvent(local, inscriptionId, eventType, eventId) {
  if (!eventId) return;

  try {
    await calendar.events.delete({
      calendarId: calendarIds[local],
      eventId: eventId,
    });
    console.log(`✅ Evento ${eventId} (${eventType}) deletado do Google Calendar.`);

    // Limpa o eventId no banco de dados
    if (eventType === 'evento') {
      // Lógica mais complexa para eventos_json
      const inscricao = db.prepare("SELECT eventos_json FROM inscricoes WHERE id = ?").get(inscriptionId);
      if (inscricao && inscricao.eventos_json) {
        const eventos = JSON.parse(inscricao.eventos_json);
        const newEventos = eventos.filter(ev => ev.eventId !== eventId);
        db.prepare("UPDATE inscricoes SET eventos_json = ? WHERE id = ?").run(JSON.stringify(newEventos), inscriptionId);
      }
    } else {
      db.prepare(`UPDATE inscricoes SET ${eventType}_eventId = NULL, ${eventType}_inicio = NULL, ${eventType}_fim = NULL WHERE id = ?`).run(inscriptionId);
    }
  } catch (error) {
    console.error(`❌ Erro ao deletar evento ${eventId} (${eventType}) do Google Calendar:`, error.message);
  }
}

/**
 * Cria um evento no Google Calendar e salva o eventId no banco de dados.
 * @param {string} local - 'teatro' ou 'igrejinha'.
 * @param {number} inscriptionId - ID da inscrição.
 * @param {string} eventType - 'ensaio', 'montagem', 'desmontagem', ou 'evento'.
 * @param {string} start - Data/hora de início (ISO string).
 * @param {string} end - Data/hora de fim (ISO string).
 * @param {string} summary - Título do evento.
 * @returns {string|null} O novo eventId ou null em caso de falha.
 */
async function createCalendarEvent(local, inscriptionId, eventType, start, end, summary) {
  try {
    const nomeEtapaCapitalizado = eventType.charAt(0).toUpperCase() + eventType.slice(1);
    const event = {
      summary: `${nomeEtapaCapitalizado} - ${summary}`,
      start: { dateTime: start, timeZone: "America/Sao_Paulo" },
      end: { dateTime: end, timeZone: "America/Sao_Paulo" },
      description: "AGENDAMENTO CONFIRMADO - Resultado da consolidação do edital.",
      extendedProperties: {
        private: {
          managedBy: "sistema-edital-dac",
          status: "confirmed"
        }
      }
    };

    const response = await calendar.events.insert({ calendarId: calendarIds[local], resource: event });
    const newEventId = response.data.id;

    // Salva o eventId no banco de dados
    if (eventType === 'evento') {
      // Lógica mais complexa para eventos_json
      const inscricao = db.prepare("SELECT eventos_json FROM inscricoes WHERE id = ?").get(inscriptionId);
      if (inscricao && inscricao.eventos_json) {
        const eventos = JSON.parse(inscricao.eventos_json);
        const eventoIndex = eventos.findIndex(ev => ev.inicio === start && ev.fim === end);
        if (eventoIndex !== -1) {
          eventos[eventoIndex].eventId = newEventId;
          db.prepare("UPDATE inscricoes SET eventos_json = ? WHERE id = ?").run(JSON.stringify(eventos), inscriptionId);
        }
      }
    } else {
      db.prepare(`UPDATE inscricoes SET ${eventType}_eventId = ? WHERE id = ?`).run(newEventId, inscriptionId);
    }

    console.log(`✅ Evento ${newEventId} (${eventType}) criado no Google Calendar.`);
    return newEventId;
  } catch (error) {
    console.error(`❌ Erro ao criar evento (${eventType}) no Google Calendar:`, error.message);
    return null;
  }
}

/**
 * Envia e-mail de notificação de resultado da consolidação.
 * @param {string} email - E-mail do proponente.
 * @param {string} nome - Nome do proponente.
 * @param {boolean} isWinner - true se venceu, false se perdeu.
 */
async function sendConsolidationEmail(email, nome, isWinner) {
  if (!transporter) {
    console.error('❌ Erro: Transporter de e-mail não configurado.');
    return false;
  }

  const subject = isWinner ? '✅ Agendamento Confirmado - Edital UFSC' : '❌ Agendamento Cancelado - Edital UFSC';
  const body = isWinner ? `
    <h2>Parabéns, ${nome}! Seu agendamento foi confirmado.</h2>
    <p>Após a consolidação da agenda, sua proposta obteve a maior pontuação e seu agendamento foi confirmado no calendário oficial.</p>
    <p>Você pode verificar os detalhes do seu agendamento no sistema.</p>
    <p>Atenciosamente,<br>Sistema de Agendamento UFSC</p>
  ` : `
    <h2>Atenção, ${nome}. Seu agendamento foi cancelado.</h2>
    <p>Após a consolidação da agenda, sua proposta não obteve a maior pontuação para o horário solicitado, e o agendamento foi cancelado.</p>
    <p>Você pode acessar o sistema para verificar a possibilidade de reagendamento em outras datas ou horários.</p>
    <p>Atenciosamente,<br>Sistema de Agendamento UFSC</p>
  `;

  const mailOptions = {
    from: process.env.EMAIL_USER || 'seu-email@gmail.com',
    to: email,
    subject: subject,
    html: body
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email de consolidação (${isWinner ? 'Vencedor' : 'Perdedor'}) enviado para:`, email);
    return true;
  } catch (error) {
    console.error('Erro ao enviar email de consolidação para', email, ':', error);
    return false;
  }
}

/**
 * Função principal para consolidar a agenda.
 */
async function consolidateSchedule() {
  console.log("🚀 Iniciando consolidação de agenda...");
  const criteria = await getEvaluationCriteria();
  const conflictingInscriptions = db.prepare("SELECT * FROM inscricoes WHERE hasConflict = 1").all();

  if (conflictingInscriptions.length === 0) {
    console.log("✅ Nenhuma inscrição em conflito encontrada. Consolidação finalizada.");
    return { success: true, message: "Nenhuma inscrição em conflito encontrada." };
  }

  // 1. Calcular a pontuação final para todas as inscrições em conflito
  const inscriptionsWithScores = conflictingInscriptions.map(insc => ({
    ...insc,
    finalScore: calculateFinalScore(insc.id, criteria)
  }));

  // 2. Agrupar todos os slots de agendamento por local, data e hora
  const allSlots = [];
  inscriptionsWithScores.forEach(insc => {
    const addSlot = (type, start, end, eventId) => {
      if (start && end) {
        allSlots.push({
          type,
          start: new Date(start),
          end: new Date(end),
          inscriptionId: insc.id,
          local: insc.local,
          eventId,
          score: insc.finalScore
        });
      }
    };

    addSlot('ensaio', insc.ensaio_inicio, insc.ensaio_fim, insc.ensaio_eventId);
    addSlot('montagem', insc.montagem_inicio, insc.montagem_fim, insc.montagem_eventId);
    addSlot('desmontagem', insc.desmontagem_inicio, insc.desmontagem_fim, insc.desmontagem_eventId);

    if (insc.eventos_json) {
      JSON.parse(insc.eventos_json).forEach(ev => addSlot('evento', ev.inicio, ev.fim, ev.eventId));
    }
  });

  // 3. Identificar os slots de tempo que estão em conflito
  const conflictingTimeSlots = {}; // Key: local|start_time|end_time

  for (let i = 0; i < allSlots.length; i++) {
    for (let j = i + 1; j < allSlots.length; j++) {
      const slotA = allSlots[i];
      const slotB = allSlots[j];

      // Verifica se há sobreposição de tempo no mesmo local
      if (slotA.local === slotB.local && slotA.start < slotB.end && slotA.end > slotB.start) {
        // Conflito encontrado. Cria uma chave única para o slot de tempo
        const key = `${slotA.local}|${slotA.start.toISOString()}|${slotA.end.toISOString()}`;
        
        if (!conflictingTimeSlots[key]) {
          conflictingTimeSlots[key] = new Set();
        }
        conflictingTimeSlots[key].add(slotA.inscriptionId);
        conflictingTimeSlots[key].add(slotB.inscriptionId);
      }
    }
  }

  // 4. Resolver conflitos
  const winningInscriptions = new Set();
  const losingInscriptions = new Set();
  const updatedInscriptions = new Set();

  for (const key in conflictingTimeSlots) {
    const inscriptionIds = Array.from(conflictingTimeSlots[key]);
    
    // Filtra os slots que fazem parte deste conflito
    const slotsInConflict = allSlots.filter(slot => inscriptionIds.includes(slot.inscriptionId) && key.includes(slot.start.toISOString()) && key.includes(slot.end.toISOString()));

    // Encontra o vencedor: maior pontuação
    let winnerSlot = null;
    let maxScore = -Infinity;

    slotsInConflict.forEach(slot => {
      if (slot.score !== null && slot.score > maxScore) {
        maxScore = slot.score;
        winnerSlot = slot;
      }
    });

    if (winnerSlot) {
      winningInscriptions.add(winnerSlot.inscriptionId);
      updatedInscriptions.add(winnerSlot.inscriptionId);

      // Os perdedores são todos os outros que solicitaram este slot
      slotsInConflict.forEach(slot => {
        if (slot.inscriptionId !== winnerSlot.inscriptionId) {
          losingInscriptions.add(slot.inscriptionId);
          updatedInscriptions.add(slot.inscriptionId);
          
          // Remove o agendamento perdedor do banco de dados e do Google Calendar
          deleteCalendarEvent(slot.local, slot.inscriptionId, slot.type, slot.eventId);
        } else {
          // O vencedor precisa ter o evento confirmado no Google Calendar
          if (!slot.eventId) {
            const inscricaoVencedora = inscriptionsWithScores.find(i => i.id === slot.inscriptionId);
            createCalendarEvent(slot.local, slot.inscriptionId, slot.type, slot.start.toISOString(), slot.end.toISOString(), inscricaoVencedora.evento_nome);
          }
        }
      });
    }
  }

  // 5. Atualizar a flag hasConflict e enviar e-mails
  const updateHasConflictStmt = db.prepare("UPDATE inscricoes SET hasConflict = 0 WHERE id = ?");
  const getEmailAndNameStmt = db.prepare("SELECT email, nome FROM inscricoes WHERE id = ?");

  for (const id of updatedInscriptions) {
    updateHasConflictStmt.run(id);
    const { email, nome } = getEmailAndNameStmt.get(id);
    
    const isWinner = winningInscriptions.has(id);
    sendConsolidationEmail(email, nome, isWinner);
  }

  console.log(`✅ Consolidação concluída. Vencedores: ${winningInscriptions.size}, Perdedores: ${losingInscriptions.size}.`);
  return { success: true, message: `Consolidação concluída. ${winningInscriptions.size} vencedores e ${losingInscriptions.size} perdedores.` };
}
// ===================================================================
// ✅ ROTA PARA OBTER DADOS BRUTOS PARA ANÁLISE (GERAR SLIDES)
// ===================================================================
app.get("/api/admin/data-for-analysis", async (req, res) => {
  try {
    // Reutiliza a lógica de /api/inscricoes para obter os dados processados
    const criteria = await getEvaluationCriteria();
    const inscriptions = db.prepare("SELECT * FROM inscricoes ORDER BY criado_em DESC").all();
    const allAssessments = db.prepare("SELECT * FROM assessments").all();
    const totalEvaluators = db.prepare('SELECT COUNT(*) as count FROM evaluators').get().count;

    // Lógica de cálculo de score e conflito (simplificada para o endpoint de análise)
    const inscriptionsWithScores = inscriptions.map(inscription => {
      const relatedAssessments = allAssessments.filter(a => a.inscription_id === inscription.id);
      let finalScore = null;
      
      let requiredAssessmentsForScore = 3;
      try {
        const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));
        if (config.requiredAssessments) {
          requiredAssessmentsForScore = parseInt(config.requiredAssessments, 10);
        }
      } catch (e) { /* ignora */ }

      if (relatedAssessments.length >= requiredAssessmentsForScore && requiredAssessmentsForScore > 0) {
        let totalScoreSum = 0;
        const assessmentsForScore = relatedAssessments.slice(0, requiredAssessmentsForScore);
        assessmentsForScore.forEach(assessment => {
          const scores = JSON.parse(assessment.scores_json);
          let singleEvaluationScore = 0;
          criteria.forEach(crit => {
            const scoreValue = scores[crit.id] || 0;
            const weightValue = crit.weight || 1;
            singleEvaluationScore += scoreValue * weightValue;
          });
          totalScoreSum += singleEvaluationScore;
        });
        finalScore = totalScoreSum / assessmentsForScore.length;
      }
      
      // Simplificando a lógica de conflito para apenas a flag
      const hasConflict = inscription.hasConflict === 1; // Assumindo que a coluna hasConflict existe ou é calculada em outro lugar

      return { 
        ...inscription, 
        finalScore: finalScore ? parseFloat(finalScore.toFixed(2)) : null, 
        assessmentsCount: relatedAssessments.length, 
        requiredAssessments: requiredAssessmentsForScore,
        hasConflict,
        isFullyAssessed: relatedAssessments.length >= requiredAssessmentsForScore,
        allAssessments: relatedAssessments.map(a => ({
            evaluator: a.evaluator_email,
            scores: JSON.parse(a.scores_json)
        }))
      };
    });

    res.json({
      inscriptions: inscriptionsWithScores,
      criteria: criteria,
      totalEvaluators: totalEvaluators,
      // Adicionar aqui qualquer outra informação relevante para a análise (ex: configurações)
    });

  } catch (error) {
    console.error("❌ Erro ao obter dados para análise:", error);
    res.status(500).json({ error: "Erro interno ao obter dados para análise." });
  }
});

// ===================================================================
// ✅ ROTA PARA CONSOLIDAR AGENDA
// ===================================================================
app.post("/api/admin/consolidate", async (req, res) => {
  try {
    const result = await consolidateSchedule();
    res.json(result);
  } catch (error) {
    console.error("❌ Erro na consolidação de agenda:", error);
    res.status(500).json({ success: false, error: "Erro interno ao consolidar a agenda." });
  }
});

// ===================================================================
// ✅ ROTA PARA FORNECER O LINK DA PLANILHA MESTRE
// ===================================================================
app.get("/api/master-sheet-link", (req, res) => {
  try {
    // O caminho para o arquivo onde salvamos o ID da Planilha Mestre
    const MASTER_SHEET_CONFIG_PATH = 'masterSheet.json';

    if (fs.existsSync(MASTER_SHEET_CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(MASTER_SHEET_CONFIG_PATH, 'utf-8'));
      if (config.sheetId) {
        // Monta o link completo para o frontend
        const link = `https://docs.google.com/spreadsheets/d/${config.sheetId}/edit`;
        return res.json({ masterSheetLink: link } );
      }
    }
    // Se o arquivo ou o ID não existirem, retorna um link vazio.
    res.json({ masterSheetLink: "" });
  } catch (error) {
    console.error("Erro ao ler o link da Planilha Mestre:", error.message);
    res.status(500).json({ error: "Erro ao obter o link da Planilha Mestre." });
  }
});


// ✅✅✅ CÓDIGO PARA ADICIONAR AO SERVER.JS ✅✅✅

// Rota para criar eventos (usada na Etapa 1)
app.post("/api/create-events", async (req, res) => {
  try {
    const { local, resumo, etapas, userData } = req.body;
    if (!calendarIds[local]) {
      return res.status(400).json({ success: false, error: "Calendário não encontrado." });
    }
    const eventosCriados = [];
    const etapasComId = [];
    for (const etapa of etapas) {
  const nomeEtapaCapitalizado = etapa.nome.charAt(0).toUpperCase() + etapa.nome.slice(1);
  const event = {
    summary: `${nomeEtapaCapitalizado} - ${resumo}`,
    start: { dateTime: etapa.inicio, timeZone: "America/Sao_Paulo" },
    end: { dateTime: etapa.fim, timeZone: "America/Sao_Paulo" },
    description: "EM ANÁLISE - Horário sujeito a alteração conforme resultado do edital.",
    // ✅ ADIÇÃO DOS METADADOS
    extendedProperties: {
      private: {
        managedBy: "sistema-edital-dac",
        status: "pending_evaluation"
        // Futuramente, podemos adicionar o ID da inscrição aqui
      }
    }
  };
      try {
        const response = await calendar.events.insert({ calendarId: calendarIds[local], resource: event });
        etapasComId.push({ ...etapa, eventId: response.data.id });
        eventosCriados.push({ etapa: etapa.nome, id: response.data.id, summary: response.data.summary, inicio: etapa.inicio });
      } catch (err) {
        console.error(`❌ Falha ao criar evento "${event.summary}":`, err.message);
      }
    }
    try {
      const dbPayload = {
        nome: userData.name, email: userData.email, telefone: userData.phone,
        evento_nome: userData.eventName || resumo, local,
        ensaio_inicio: null, ensaio_fim: null, ensaio_eventId: null,
        montagem_inicio: null, montagem_fim: null, montagem_eventId: null,
        desmontagem_inicio: null, desmontagem_fim: null, desmontagem_eventId: null,
        eventos_json: '[]'
      };
      const eventosExtras = [];
      etapasComId.forEach(e => {
        const nome = e.nome.toLowerCase();
        if (dbPayload.hasOwnProperty(`${nome}_inicio`)) {
          dbPayload[`${nome}_inicio`] = e.inicio;
          dbPayload[`${nome}_fim`] = e.fim;
          dbPayload[`${nome}_eventId`] = e.eventId;
        } else if (nome === 'evento') {
          eventosExtras.push({ inicio: e.inicio, fim: e.fim, eventId: e.eventId });
        }
      });
      dbPayload.eventos_json = JSON.stringify(eventosExtras);
      db.prepare(`INSERT INTO inscricoes (nome, email, telefone, evento_nome, local, ensaio_inicio, ensaio_fim, ensaio_eventId, montagem_inicio, montagem_fim, montagem_eventId, desmontagem_inicio, desmontagem_fim, desmontagem_eventId, eventos_json) VALUES (@nome, @email, @telefone, @evento_nome, @local, @ensaio_inicio, @ensaio_fim, @ensaio_eventId, @montagem_inicio, @montagem_fim, @montagem_eventId, @desmontagem_inicio, @desmontagem_fim, @desmontagem_eventId, @eventos_json)`).run(dbPayload);
      console.log("💾 Inscrição salva no banco com sucesso!");
    } catch (err) {
      console.error("❌ Erro ao salvar inscrição no banco:", err.message);
    }
          // Envia o e-mail de confirmação da Etapa 1
      sendStep1ConfirmationEmail(userData.email, userData.name, (userData.eventName || resumo), local, etapasComId.map(e => ({ nome: e.nome, inicio: e.inicio, fim: e.fim })));

      res.json({ success: true, message: "Eventos criados e inscrição salva com sucesso!", eventos: eventosCriados });
  } catch (err) {
    console.error("❌ Erro no endpoint /api/create-events:", err.message);
    res.status(500).json({ success: false, error: "Erro interno ao criar eventos." });
  }
});

// Rota para cancelar múltiplos eventos (usada na Etapa 1 após confirmação)
app.delete("/api/cancel-events/:local", async (req, res) => {
    const { local } = req.params;
    const { eventIds } = req.body;
    if (!calendarIds[local]) return res.status(400).json({ error: "Calendário não encontrado." });
    if (!Array.isArray(eventIds) || eventIds.length === 0) return res.status(400).json({ error: "Nenhum ID de evento informado." });

    const resultados = [];
    for (const eventId of eventIds) {
        if (!eventId) continue;
        try {
            await calendar.events.delete({ calendarId: calendarIds[local], eventId });
            resultados.push({ eventId, status: "deleted" });
        } catch (err) {
            resultados.push({ eventId, status: "error", error: err.message || "Erro" });
        }
    }
    if (cacheEventos[local]) {
        cacheEventos[local] = cacheEventos[local].filter(e => !eventIds.includes(e.id));
    }
    res.json({ success: true, resultados });
});

// Rota para excluir uma inscrição inteira (usada no painel admin)
app.delete("/api/inscricao/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const inscricao = db.prepare("SELECT * FROM inscricoes WHERE id = ?").get(id);
        if (!inscricao) {
            return res.status(404).json({ success: false, error: "Inscrição não encontrada." });
        }
        const eventosParaExcluir = [
            inscricao.ensaio_eventId,
            inscricao.montagem_eventId,
            inscricao.desmontagem_eventId,
            ...(JSON.parse(inscricao.eventos_json || '[]').map(ev => ev.eventId))
        ].filter(Boolean);

        if (eventosParaExcluir.length > 0) {
            await Promise.all(eventosParaExcluir.map(eventId =>
                calendar.events.delete({ calendarId: calendarIds[inscricao.local], eventId }).catch(err => console.error(`Falha ao deletar evento ${eventId}:`, err.message))
            ));
        }
        db.prepare("DELETE FROM inscricoes WHERE id = ?").run(id);
        res.json({ success: true, message: "Inscrição e eventos associados foram excluídos." });
    } catch (err) {
        console.error(`❌ Erro ao excluir inscrição ${id}:`, err.message);
        res.status(500).json({ success: false, error: "Erro interno ao excluir inscrição." });
    }
});

// ===================================================================
// ✅ ENDPOINT PLACEHOLDER PARA CONSOLIDAÇÃO FUTURA
// ===================================================================
app.post("/api/schedule/consolidate", async (req, res) => {
  console.log("⚠️ [CONSOLIDATE] Rota de consolidação chamada, mas a lógica ainda não foi implementada.");
  
  // Quando a lógica for implementada, ela virá aqui:
  // 1. Buscar todas as inscrições com notas.
  // 2. Agrupar inscrições que disputam os mesmos horários.
  // 3. Para cada disputa, determinar o vencedor (maior nota).
  // 4. Chamar a API do Google para ATUALIZAR o evento do vencedor (status: 'confirmed').
  // 5. Chamar a API do Google para DELETAR os eventos dos perdedores.

  res.status(501).json({ 
    message: "Funcionalidade em desenvolvimento.",
    description: "Este endpoint será responsável por finalizar a agenda do edital com base na pontuação dos proponentes." 
  });
});


// ✅✅✅ CÓDIGO PARA ADICIONAR AO SERVER.JS ✅✅✅

// Rota para gerar PDF de uma inscrição
// ✅ 2. SUBSTITUA A ROTA DE GERAR PDF
// ✅ 2. SUBSTITUA A ROTA DE GERAR PDF INDIVIDUAL
app.get("/api/gerar-pdf/:inscricaoId", async (req, res) => {
  try {
    const { inscricaoId } = req.params;
    const pdfBuffer = await gerarPdfCompleto(inscricaoId);
    
    const inscricao = db.prepare("SELECT evento_nome FROM inscricoes WHERE id = ?").get(inscricaoId);
    const filename = `inscricao-${inscricaoId}-${(inscricao.evento_nome || 'evento').replace(/\s+/g, '_')}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error("❌ Erro ao gerar PDF individual:", err.message);
    res.status(500).send(err.message);
  }
});


// ✅ 3. SUBSTITUA A ROTA DE DOWNLOAD ZIP
app.get("/api/download-zip/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const inscricaoCompleta = await getInscricaoCompleta(id);
    if (!inscricaoCompleta || !inscricaoCompleta.etapa2_ok || !inscricaoCompleta.formsData) {
      return res.status(404).send("Inscrição não encontrada ou Etapa 2 não preenchida.");
    }

    const zipFileName = `anexos-inscricao-${id}.zip`;
    res.attachment(zipFileName);
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(res);

    const fileIdRegex = /id=([a-zA-Z0-9_-]+)/;
    const filePromises = [];

    for (const [key, value] of Object.entries(inscricaoCompleta.formsData)) {
      if (typeof value === 'string' && value.includes('drive.google.com')) {
        const urls = value.split(', '); // O Forms separa múltiplos arquivos com ", "
        for (const url of urls) {
          const match = url.match(fileIdRegex);
          if (match && match[1]) {
            const fileId = match[1];
            console.log(`🔎 Encontrado anexo com ID: ${fileId}`);
            
            const promise = drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' })
              .then(response => {
                // Precisamos do nome do arquivo, então fazemos outra chamada rápida
                return drive.files.get({ fileId, fields: 'name' }).then(meta => {
                  const fileName = meta.data.name || `${fileId}-anexo`;
                  console.log(`➕ Adicionando "${fileName}" ao ZIP.`);
                  archive.append(response.data, { name: fileName });
                });
              })
              .catch(err => console.error(`❌ Falha ao baixar arquivo ${fileId}:`, err.message));
            filePromises.push(promise);
          }
        }
      }
    }

    if (filePromises.length === 0) {
      console.log(`⚠️ Nenhum anexo encontrado para a inscrição ${id}. Finalizando ZIP vazio.`);
      archive.finalize();
      return;
    }

    // Espera todas as promessas de download terminarem antes de finalizar o ZIP
    await Promise.all(filePromises);
    
    console.log(`✅ Finalizando o arquivo ZIP para a inscrição ${id}.`);
    archive.finalize();

  } catch (err) {
    console.error(`❌ Erro fatal ao gerar ZIP para inscrição ${id}:`, err);
    res.status(500).send("Erro interno ao gerar o arquivo ZIP.");
  }
});


// Rota para baixar todos os ZIPs
// ✅ 3. SUBSTITUA A ROTA DE DOWNLOAD DE TODOS OS ZIPS
app.get("/api/download-all-zips", async (req, res) => {
  console.log("📥 [ZIP] Requisição recebida para baixar TODOS os PDFs em ZIP...");
  try {
    const inscricoes = db.prepare("SELECT id, evento_nome FROM inscricoes").all();
    if (inscricoes.length === 0) {
      return res.status(404).send("Nenhuma inscrição encontrada.");
    }

    const archive = archiver("zip", { zlib: { level: 9 } });
    res.attachment(`todas-inscricoes-${new Date().toISOString().split("T")[0]}.zip`);
    archive.pipe(res);

    console.log(`📦 [ZIP] Iniciando geração de ${inscricoes.length} PDFs completos...`);

    for (const inscricao of inscricoes) {
      try {
        const pdfBuffer = await gerarPdfCompleto(inscricao.id);
        const pdfFileName = `inscricao-${inscricao.id}-${(inscricao.evento_nome || 'evento').replace(/\s+/g, '_')}.pdf`;
        archive.append(pdfBuffer, { name: pdfFileName });
        console.log(`📄 [ZIP] PDF para inscrição #${inscricao.id} adicionado ao arquivo.`);
      } catch (err) {
        console.error(`❌ [ZIP] Falha ao gerar PDF para inscrição #${inscricao.id}:`, err.message);
        // Opcional: Adicionar um arquivo de erro ao ZIP
        archive.append(`Falha ao gerar PDF para inscrição #${inscricao.id}. Erro: ${err.message}`, { name: `ERRO-inscricao-${inscricao.id}.txt` });
      }
    }

    console.log("📦 [ZIP] Finalizando o arquivo ZIP e enviando...");
    await archive.finalize();
    console.log("📤 [ZIP] ZIP enviado com sucesso.");

  } catch (err) {
    console.error("❌ [ZIP] Erro fatal na rota /api/download-all-zips:", err);
    if (!res.headersSent) {
      res.status(500).send("Erro ao gerar o arquivo ZIP de todas as inscrições.");
    }
  }
});

// Rota para limpeza geral
app.post("/api/cleanup/force", async (req, res) => {
    try {
        // Adicionar aqui a lógica para apagar arquivos do Drive antes de limpar o banco
        db.prepare("DELETE FROM inscricoes").run();
        db.prepare("DELETE FROM sqlite_sequence WHERE name='inscricoes'").run();
        console.log("🧹 Limpeza geral executada com sucesso.");
        res.json({ success: true, message: "Limpeza geral concluída." });
    } catch (err) {
        console.error("❌ Erro na limpeza geral:", err.message);
        res.status(500).json({ success: false, error: "Erro ao executar limpeza." });
    }
});

// No server.js, SUBSTITUA o endpoint de salvar avaliação por este:

app.post('/api/assessment/:id', async (req, res) => {
  const { id } = req.params;
  // ✅ 1. Captura os dados corretos que o frontend está enviando
  const { evaluatorEmail, scores } = req.body;

  // ✅ 2. Validação robusta
  if (!evaluatorEmail || !scores || typeof scores !== 'object') {
    return res.status(400).json({ error: 'E-mail do avaliador e um objeto de notas são obrigatórios.' });
  }

  try {
    const scores_json = JSON.stringify(scores);
    
    // ✅ 3. Lógica de INSERT ou UPDATE na tabela 'assessments'
    const stmt = db.prepare(`
      INSERT INTO assessments (inscription_id, evaluator_email, scores_json) 
      VALUES (?, ?, ?)
      ON CONFLICT(inscription_id, evaluator_email) DO UPDATE SET
      scores_json = excluded.scores_json;
    `);
    
    stmt.run(id, evaluatorEmail.trim().toLowerCase(), scores_json);
    
    console.log(`✅ Avaliação da inscrição #${id} pelo avaliador ${evaluatorEmail} foi salva/atualizada.`);
    res.status(200).json({ success: true, message: 'Avaliação salva com sucesso.' });

  } catch (error) {
    console.error('❌ Erro ao salvar avaliação:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao salvar a avaliação.' });
  }
});






// ===================================================================
// ✅ ROTA PARA GERAR SLIDES COM BASE NOS DADOS DE ANÁLISE
// ===================================================================
app.post("/api/admin/generate-slides", async (req, res) => {
  try {
    const analysisData = req.body;
    
    // Validar se os dados foram recebidos
    if (!analysisData || !analysisData.inscriptions) {
      return res.status(400).json({ error: "Dados de análise inválidos." });
    }
    
    // Gerar um ID único para esta sessão de slides
    const slidesSessionId = uuidv4();
    
    // Armazenar os dados em memória
    const slidesUrl = `http://localhost:${port}/slides-viewer?session=${slidesSessionId}`;
    
    // Armazenar os dados em um mapa global
    if (!global.slidesCache) {
      global.slidesCache = {};
    }
    global.slidesCache[slidesSessionId] = analysisData;
    
    console.log(`✅ Slides gerados com ID de sessão: ${slidesSessionId}`);
    
    res.json({
      success: true,
      slidesUrl: slidesUrl,
      message: "Slides gerados com sucesso."
    });
    
  } catch (error) {
    console.error("❌ Erro ao gerar slides:", error);
    res.status(500).json({ error: "Erro interno ao gerar slides." });
  }
});

// ===================================================================
// ✅ ROTA PARA VISUALIZAR OS SLIDES
// ===================================================================
app.get("/slides-viewer", (req, res) => {
  try {
    const { session } = req.query;
    
    if (!session || !global.slidesCache || !global.slidesCache[session]) {
      return res.status(404).send("Sessão de slides não encontrada.");
    }
    
    const analysisData = global.slidesCache[session];
    
    // Gerar HTML com os slides
    const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Visualizador de Slides - Análise do Edital</title>
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
      <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&family=Montserrat:wght@700;800&display=swap" rel="stylesheet">
      <style>
        body { margin: 0; padding: 0; font-family: 'Roboto', sans-serif; background: #f5f5f5; }
        .viewer-container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .slide-frame { width: 100%; height: 720px; border: 1px solid #ddd; background: white; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .controls { margin-bottom: 20px; display: flex; gap: 10px; align-items: center; }
        .controls button { padding: 10px 20px; background: #003366; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 700; }
        .controls button:hover { background: #002244; }
        .slide-info { padding: 20px; background: white; border-radius: 4px; margin-bottom: 20px; }
        .slide-info h2 { margin: 0 0 10px 0; color: #003366; }
        .slide-info p { margin: 0; color: #2C3E50; }
      </style>
    </head>
    <body>
      <div class="viewer-container">
        <div class="slide-info">
          <h2>📊 Visualizador de Slides - Análise do Edital de Agendamento UFSC</h2>
          <p>Total de Inscrições: <strong>${analysisData.inscriptions.length}</strong> | Total de Avaliadores: <strong>${analysisData.totalEvaluators}</strong></p>
        </div>
        <div class="controls">
          <button onclick="previousSlide()">← Anterior</button>
          <span id="slide-counter">Slide 1 de 5</span>
          <button onclick="nextSlide()">Próximo →</button>
          <button onclick="downloadSlides()" style="background: #E74C3C;">Baixar Slides</button>
        </div>
        <div id="slide-container" class="slide-frame"></div>
      </div>
      <script>
        let currentSlide = 1;
        const totalSlides = 5;
        const analysisData = ${JSON.stringify(analysisData)};
        
        function generateSlideContent(slideNumber) {
          const totalInscricoes = analysisData.inscriptions.length;
          const avaliadasCount = analysisData.inscriptions.filter(i => i.finalScore !== null && i.finalScore !== undefined).length;
          const emConflito = analysisData.inscriptions.filter(i => i.hasConflict).length;
          
          if (slideNumber === 1) {
            return '<div style="padding: 40px; background: linear-gradient(135deg, #003366 0%, #004d99 100%); color: white; height: 100%; display: flex; flex-direction: column; justify-content: center;"><h1 style="font-size: 48px; margin: 0 0 20px 0; font-family: Montserrat;">Análise do Edital</h1><h2 style="font-size: 32px; margin: 0 0 40px 0; font-weight: 400;">Agendamento de Espaços - UFSC</h2><div style="font-size: 20px; line-height: 1.8;"><p><strong>Total de Inscrições:</strong> ' + totalInscricoes + '</p><p><strong>Avaliadas:</strong> ' + avaliadasCount + '</p><p><strong>Em Conflito:</strong> ' + emConflito + '</p></div></div>';
          } else if (slideNumber === 2) {
            const percentualAvaliadas = totalInscricoes > 0 ? ((avaliadasCount / totalInscricoes) * 100).toFixed(1) : 0;
            return '<div style="padding: 40px; background: white; height: 100%; display: flex; flex-direction: column; justify-content: center;"><h2 style="font-size: 36px; color: #003366; margin: 0 0 30px 0; font-family: Montserrat;">Status da Avaliação</h2><div style="font-size: 20px; line-height: 2;"><p><strong style="color: #003366;">Avaliações Concluídas:</strong> ' + avaliadasCount + ' de ' + totalInscricoes + ' (' + percentualAvaliadas + '%)</p><p><strong style="color: #003366;">Total de Avaliadores:</strong> ' + analysisData.totalEvaluators + '</p><p><strong style="color: #E74C3C;">Pendentes:</strong> ' + (totalInscricoes - avaliadasCount) + '</p></div></div>';
          } else if (slideNumber === 3) {
            const topProposals = analysisData.inscriptions.filter(i => i.finalScore !== null && i.finalScore !== undefined).sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0)).slice(0, 3);
            let proposalsHtml = topProposals.map((p, idx) => '<div style="margin-bottom: 15px; padding: 15px; background: #f0f0f0; border-left: 4px solid #003366;"><p style="margin: 0; font-weight: bold;">' + (idx + 1) + '. ' + p.nome + '</p><p style="margin: 5px 0 0 0; color: #666;">Nota: ' + (p.finalScore ? p.finalScore.toFixed(2) : 'N/A') + '</p></div>').join('');
            return '<div style="padding: 40px; background: white; height: 100%; display: flex; flex-direction: column; justify-content: center;"><h2 style="font-size: 36px; color: #003366; margin: 0 0 30px 0; font-family: Montserrat;">Top Propostas</h2>' + proposalsHtml + '</div>';
          } else if (slideNumber === 4) {
            return '<div style="padding: 40px; background: white; height: 100%; display: flex; flex-direction: column; justify-content: center;"><h2 style="font-size: 36px; color: #003366; margin: 0 0 30px 0; font-family: Montserrat;">Conflitos de Agendamento</h2><div style="font-size: 20px; line-height: 2;"><p><strong style="color: #E74C3C;">Propostas em Conflito:</strong> ' + emConflito + '</p><p><strong style="color: #003366;">Percentual:</strong> ' + (totalInscricoes > 0 ? ((emConflito / totalInscricoes) * 100).toFixed(1) : 0) + '%</p><p style="margin-top: 20px; color: #666;">Ação: Revisar horários e consolidar agenda</p></div></div>';
          } else if (slideNumber === 5) {
            return '<div style="padding: 40px; background: linear-gradient(135deg, #003366 0%, #004d99 100%); color: white; height: 100%; display: flex; flex-direction: column; justify-content: center;"><h2 style="font-size: 36px; margin: 0 0 30px 0; font-family: Montserrat;">Próximos Passos</h2><div style="font-size: 18px; line-height: 2;"><p>✓ Revisar propostas em conflito</p><p>✓ Consolidar agenda final</p><p>✓ Notificar proponentes</p><p>✓ Publicar calendário definitivo</p></div></div>';
          }
        }
        
        function updateSlide() {
          const content = generateSlideContent(currentSlide);
          document.getElementById('slide-container').innerHTML = content;
          document.getElementById('slide-counter').textContent = 'Slide ' + currentSlide + ' de ' + totalSlides;
        }
        
        function nextSlide() {
          if (currentSlide < totalSlides) {
            currentSlide++;
            updateSlide();
          }
        }
        
        function previousSlide() {
          if (currentSlide > 1) {
            currentSlide--;
            updateSlide();
          }
        }
        
        function downloadSlides() {
          alert('💾 Funcionalidade de download será implementada em breve!');
        }
        
        updateSlide();
        
        document.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowRight') nextSlide();
          if (e.key === 'ArrowLeft') previousSlide();
        });
      </script>
    </body>
    </html>
    `;
    
    res.send(html);
    
  } catch (error) {
    console.error("❌ Erro ao visualizar slides:", error);
    res.status(500).send("Erro ao carregar o visualizador de slides.");
  }
});

// ===================================================================
// ✅ ROTA PARA SERVIR OS ARQUIVOS HTML DOS SLIDES
// ===================================================================
app.use("/slides-content", express.static("slides-edital-ufsc"));

// --- 6. INICIALIZAÇÃO DO SERVIDOR ---
app.listen(port, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${port}` );
  cron.schedule("*/5 * * * *", atualizarCache);
  atualizarCache();
});



// --- 5. FUNÇÃO DE ENVIO DE E-MAIL DE CONFIRMAÇÃO (ETAPA 1) ---
async function sendStep1ConfirmationEmail(email, nome, evento_nome, local, etapas) {
  if (!transporter) {
    console.warn("⚠️ Transporter de e-mail não configurado. Pular envio de e-mail da Etapa 1.");
    return false;
  }

  const locaisNomes = {
    teatro: "Teatro Carmen Fossari",
    igrejinha: "Igrejinha da UFSC",
  };

  const etapasHtml = etapas.map(etapa => {
    const dataFormatada = new Date(etapa.inicio).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const horaInicio = new Date(etapa.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
    const horaFim = new Date(etapa.fim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
    return `<li><strong>${etapa.nome.charAt(0).toUpperCase() + etapa.nome.slice(1)}:</strong> ${dataFormatada}, das ${horaInicio} às ${horaFim}</li>`;
  }).join('');

  const mailOptions = {
    from: process.env.EMAIL_USER || 'seu-email@gmail.com',
    to: email,
    subject: `✅ Confirmação da 1ª Etapa: ${evento_nome}`,
    html: `
      <div style="font-family: sans-serif; line-height: 1.6;">
        <h2>Olá, ${nome}!</h2>
        <p>A primeira etapa da sua solicitação de agendamento para o evento <strong>"${evento_nome}"</strong> foi recebida com sucesso.</p>
        <p><strong>Local:</strong> ${locaisNomes[local] || local}</p>
        <p><strong>Resumo dos horários solicitados:</strong></p>
        <ul>
          ${etapasHtml}
        </ul>
        <p><strong>Atenção:</strong> Este é um e-mail de confirmação da sua solicitação. Os horários ainda estão em análise e podem ser contestados por outras propostas. O agendamento só será definitivo após a consolidação da agenda do edital.</p>
        <p>O próximo passo é preencher o formulário de inscrição detalhada. Se a aba não abriu automaticamente, acesse o link que foi disponibilizado na página de agendamento.</p>
        <p>Atenciosamente,<br>Sistema de Agendamento UFSC</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ E-mail de confirmação da Etapa 1 enviado para: ${email}`);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao enviar e-mail de confirmação da Etapa 1 para ${email}:`, error);
    return false;
  }
}
