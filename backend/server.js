// ===================================================================
//                  ✅ SERVER.JS - VERSÃO PostgreSQL ✅
// ===================================================================

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs";
import PDFDocument from "pdfkit";
import cron from "node-cron";
import dotenv from "dotenv";
import { google } from "googleapis";
import pkg from 'pg';
const { Pool } = pkg;
import nodemailer from "nodemailer";
import { Resend } from 'resend';
import { parse } from "csv-parse/sync";
import archiver from "archiver";
import { PassThrough } from "stream";
// import bcrypt from "bcrypt"; // Comentado temporariamente devido a erro de módulo nativo
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { fileURLToPath } from "url";
import pdfGeneratorRouter from './pdfGenerator.js';

// Define __dirname para ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configura dotenv para ler .env do diretório backend (desenvolvimento)
// EM PRODUÇÃO (RENDER), ESTA LINHA DEVE SER COMENTADA PARA USAR AS VARIAVEIS DO SISTEMA
// dotenv.config({ path: path.join(__dirname, '.env') });

// DEBUG: Mostrar quais variáveis de e-mail estão disponíveis
console.log('\ud83d\udd0d DEBUG - Variáveis de ambiente:');
console.log('  EMAIL_USER:', process.env.EMAIL_USER ? '✅ Definida' : '❌ Não encontrada');
console.log('  EMAIL_PASS:', process.env.EMAIL_PASS ? '✅ Definida' : '❌ Não encontrada');

// --- 1. CONFIGURAÇÕES GERAIS E BANCO DE DADOS ---
// No Render, a DATABASE_URL pode ser Interna ou Externa.
// Se o hostname contiver 'dpg-' e terminar com '-a', é um hostname interno do Render.
// Hostnames internos do Render não suportam SSL/TLS.
const databaseUrl = process.env.DATABASE_URL;
const isInternalRenderHost = databaseUrl && databaseUrl.includes('dpg-') && databaseUrl.includes('-a');

const pool = new Pool(
  databaseUrl
    ? {
        connectionString: databaseUrl,
        ssl: isInternalRenderHost ? false : {
          rejectUnauthorized: false, // Necessário para conexões externas no Render
        },
      }
    : {
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'edital_ufsc',
      }
);

if (isInternalRenderHost) {
  console.log('🌐 Detectado Hostname Interno do Render. SSL desabilitado para esta conexão.');
}

// Função auxiliar para executar queries
async function query(text, params = []) {
  try {
    const result = await pool.query(text, params);
    return result;
  } catch (error) {
    console.error('❌ Erro na query:', { text, error: error.message });
    throw error;
  }
}

// Inicializar tabelas
async function initializeTables() {
  try {
    // Tabela principal de inscrições
    await query(`
      CREATE TABLE IF NOT EXISTS inscricoes (
        id SERIAL PRIMARY KEY,
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
        hasConflict INTEGER DEFAULT 0,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Tabela de avaliadores
    await query(`
      CREATE TABLE IF NOT EXISTS evaluators (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Tabela de avaliações
    await query(`
      CREATE TABLE IF NOT EXISTS assessments (
        id SERIAL PRIMARY KEY,
        inscription_id INTEGER NOT NULL,
        evaluator_email TEXT NOT NULL,
        scores_json TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inscription_id) REFERENCES inscricoes(id) ON DELETE CASCADE
      );
    `);

    // Índice único para garantir uma avaliação por avaliador por inscrição
    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_inscription_evaluator 
      ON assessments (inscription_id, evaluator_email);
    `);

    // Tabela de critérios
    await query(`
      CREATE TABLE IF NOT EXISTS evaluation_criteria (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        weight REAL NOT NULL,
        sort_order INTEGER NOT NULL
      );
    `);

    // Tabela de configurações (para persistir config.json no banco)
    await query(`
      CREATE TABLE IF NOT EXISTS config (
        id INTEGER PRIMARY KEY DEFAULT 1,
        config_json TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CHECK (id = 1)
      );
    `);

    console.log("✅ Banco de dados PostgreSQL inicializado com sucesso.");
  } catch (error) {
    console.error("❌ Erro ao inicializar tabelas:", error);
  }
}

// Chamar inicialização de tabelas
await initializeTables();

// ===================================================================
// ✅ FUNÇÃO AUXILIAR PARA LER CONFIGURAÇÃO DO BANCO DE DADOS
// ===================================================================
async function getConfigFromDB() {
  try {
    const result = await query("SELECT config_json FROM config WHERE id = 1");
    if (result.rows.length > 0) {
      return JSON.parse(result.rows[0].config_json);
    }
  } catch (e) {
    console.error("❌ Erro ao ler configuração do banco de dados:", e.message);
  }
  return {}; // Retorna objeto vazio se não encontrar ou houver erro
}

// ✅ FUNÇÃO AUXILIAR PARA PEGAR O NÚMERO DE AVALIAÇÕES REQUERIDAS
// Esta função agora é assíncrona e lê do banco de dados
async function getRequiredAssessments() {
  try {
    const config = await getConfigFromDB();
    if (config.requiredAssessments) {
      return parseInt(config.requiredAssessments, 10);
    }
  } catch (e) { /* ignora */ }
  return 3; // Valor padrão
}

// --- 2. CONFIGURAÇÃO DO GOOGLE CALENDAR E SHEETS ---

// NOVO: Tenta ler as credenciais de uma variável de ambiente (para Render)
let credentials = null;
if (process.env.GOOGLE_CREDENTIALS_JSON) {
  try {
    // A chave privada (private_key) pode ter quebras de linha que precisam ser restauradas
    const jsonString = process.env.GOOGLE_CREDENTIALS_JSON.replace(/\\n/g, '\n');
    credentials = JSON.parse(jsonString);
    console.log('✅ Credenciais do Google lidas da variável de ambiente.');
  } catch (e) {
    console.error('❌ Erro ao parsear GOOGLE_CREDENTIALS_JSON:', e.message);
  }
}

// Se não houver variável de ambiente, tenta ler do arquivo local (para desenvolvimento)
if (!credentials) {
  try {
    const credentialsPath = path.join(__dirname, 'credentials.json');
    if (fs.existsSync(credentialsPath)) {
      credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
      console.log('🔑 Usando credentials.json local (desenvolvimento)');
    } else {
      console.warn('⚠️ credentials.json não encontrado. Google APIs desabilitadas.');
    }
  } catch (e) {
    console.error('❌ Erro ao ler credentials.json local:', e.message);
  }
}

// Declarações globais para as APIs do Google (serão inicializadas de forma assíncrona)
let sheets = null;
let calendar = null;
let drive = null;
let auth = null; // Variável de autenticação global

const calendarIds = {
  teatro: "oto.bezerra@ufsc.br",
  igrejinha: "c_e19d30c40d4de176bc7d4e11ada96bfaffd130b3ed499d9807c88785e2c71c05@group.calendar.google.com",
};

// --- 3. CONFIGURACAO DO NODEMAILER (SMTP) ---
let transporter = null;

// --- 3.1. CONFIGURACAO DO RESEND (API) ---
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

if (resend) {
  console.log('✅ Serviço de e-mail Resend (API) configurado com sucesso!');
} else {
  console.warn('⚠️ Variável RESEND_API_KEY não encontrada. O Resend está desabilitado.');
}

// --- 3.2. CONFIGURACAO DO BREVO API (RECOMENDADO) ---
let brevoApiKey = process.env.BREVO_API_KEY || null;
if (brevoApiKey) {
  console.log('✅ Serviço de e-mail Brevo API configurado com sucesso!');
} else {
  console.warn('⚠️ Variável BREVO_API_KEY não encontrada. O Brevo API está desabilitado.');
}
// --- 3.3. FALLBACK: GMAIL SMTP ---
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
  console.log('✅ Servidor de e-mail (Gmail SMTP) configurado com sucesso!');
  console.log('   De:', process.env.EMAIL_USER);
  console.warn('⚠️ ATENÇÃO: Gmail SMTP tem baixa deliverability (35%). Recomendamos usar Brevo SMTP.');
} else {
  console.warn('⚠️ Nenhuma configuração SMTP encontrada.');
  console.warn('   Configure BREVO_SMTP_USER e BREVO_SMTP_KEY para usar Brevo (recomendado)');
  console.warn('   Ou configure EMAIL_USER e EMAIL_PASS para usar Gmail (não recomendado)');
}

// FUNCOES PARA GERAÇÃO DE SENHA E ENVIO DE EMAIL

async function sendPdfByEmail(email, filename, pdfBuffer, inscricao) {
  if (!transporter) {
    console.error('❌ Erro: Transporter de e-mail não configurado. Verifique EMAIL_USER e EMAIL_PASSWORD no .env');
    return false;
  }

  const mailOptions = {
    from: `"Sistema de Agendamento DAC" <${process.env.EMAIL_USER || 'seu-email@gmail.com'}>`,
    to: email,
    subject: `Confirmação de Inscrição: ${inscricao.evento_nome || 'Evento'} - #${inscricao.id}`,
    html: `
      <h2>Confirmação de Inscrição</h2>
      <p>Prezado(a) ${inscricao.nome},</p>
      <p>Sua inscrição para o evento <strong>${inscricao.evento_nome || 'sem nome'}</strong> no local <strong>${inscricao.local || 'sem local'}</strong> foi processada.</p>
      <p>Em anexo, você encontrará o PDF com o resumo de sua inscrição e os detalhes fornecidos na Etapa 2 (Formulário).</p>
      <p><strong>Detalhes Principais:</strong></p>
      <ul>
        <li><strong>Inscrição ID:</strong> #${inscricao.id}</li>
        <li><strong>Nome do Evento:</strong> ${inscricao.evento_nome || 'N/A'}</li>
        <li><strong>Local:</strong> ${inscricao.local || 'N/A'}</li>
        <li><strong>E-mail de Contato:</strong> ${email}</li>
      </ul>
      <p>Em caso de dúvidas, entre em contato com a organização.</p>
      <p>Atenciosamente,<br>Sistema de Agendamento DAC</p>
    `,
    attachments: [
      {
        filename: filename,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ PDF de Inscrição enviado com sucesso para:', email);
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar PDF por e-mail para', email, ':', error);
    return false;
  }
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
    from: `"Sistema de Agendamento DAC" <${process.env.EMAIL_USER || 'seu-email@gmail.com'}>`,
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
      <p>Atenciosamente,<br>Sistema de Agendamento DAC</p>
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

// --- 4. FUNCOES UTILITARIAS ---`}
function normalizeKey(key = "") {
  return key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").toLowerCase();
}

// ✅ FUNÇÃO ATUALIZADA para buscar pesos do novo banco de dados
async function getEvaluationCriteria() {
  try {
    const result = await query('SELECT * FROM evaluation_criteria ORDER BY sort_order ASC');
    const criteria = result.rows;
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

// --- 5. CACHE DE EVENTOS DO CALENDÁRIO ---
let cacheEventos = {};
async function atualizarCache() {
  try {
    const agora = new Date();
    const start = agora.toISOString();
    const end = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    for (const local in calendarIds) {
      try {
        const events = await calendar.events.list({
          calendarId: calendarIds[local],
          timeMin: start,
          timeMax: end,
          singleEvents: true,
          orderBy: 'startTime',
        });
        cacheEventos[local] = events.data.items || [];
      } catch (err) {
        console.warn(`⚠️ Erro ao atualizar cache para ${local}:`, err.message);
      }
    }
  } catch (err) {
    console.error("❌ Erro ao atualizar cache:", err.message);
  }
}

// --- 6. INICIALIZAÇÃO DAS GOOGLE APIS (VERSÃO ATUALIZADA) ---
// Função assíncrona para inicializar as Google APIs
async function initializeGoogleAPIs() {
  try {
    // Variável 'auth' agora é global (declarada acima)
    
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log('🔑 Usando GOOGLE_APPLICATION_CREDENTIALS da variável de ambiente');
      // Se a variável de ambiente contém JSON, faz o parse
      try {
        const envValue = process.env.GOOGLE_APPLICATION_CREDENTIALS.trim();
        let credentials;
        
        // Tentar parsear direto primeiro
        try {
          credentials = JSON.parse(envValue);
        } catch (firstError) {
          // Se falhar, tentar substituir \\n por \n (caso esteja escapado)
          try {
            const jsonString = envValue.replace(/\\n/g, '\n');
            credentials = JSON.parse(jsonString);
          } catch (secondError) {
            // Se ainda falhar, não é JSON válido
            throw secondError;
          }
        }
        
        console.log('🔑 Service Account:', credentials.client_email);
        auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.readonly'],
        });
      } catch (e) {
        console.log('🔑 Não é JSON, usando como caminho de arquivo');
        console.log('⚠️ Erro ao parsear JSON:', e.message);
        // Se não for JSON, assume que é um caminho de arquivo
        const { auth: fileAuth } = await google.auth.getClient({
          keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
          scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.readonly'],
        });
        auth = fileAuth;
      }
    } else {
      console.log('🔑 Usando credentials.json local (desenvolvimento)');
      // Desenvolvimento: usa o arquivo local
      const credData = JSON.parse(fs.readFileSync(path.join(__dirname, 'credentials.json'), 'utf8'));
      console.log('🔑 Service Account:', credData.client_email);
      
      // ✅ Usar GoogleAuth com credentials direto
      auth = new google.auth.GoogleAuth({
        credentials: credData,
        scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.readonly'],
      });
    }

    // Atualiza as variáveis globais
    calendar = google.calendar({ version: 'v3', auth });
    sheets = google.sheets({ version: 'v4', auth });
    drive = google.drive({ version: 'v3', auth });
    console.log('✅ Google APIs autenticadas com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao inicializar Google APIs:', error.message);
    process.exit(1);
  }
}

// --- 7. CONFIGURAÇÃO DO EXPRESS ---
const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// --- 9. ROTA PARA OBTER CONFIGURAÇÕES ---
app.get("/api/config", async (req, res) => {
  try {
    const FIXED_FORMS_LINK = "https://docs.google.com/forms/d/e/1FAIpQLScxvwER2fKcTMebfOas0NWm4hn35POVjkmYtbwRLFEKmq3G5w/viewform?usp=dialog";
    const FIXED_SHEET_LINK = "https://docs.google.com/spreadsheets/d/1DSMc1jGYJmK01wxKjAC83SWXQxcoxPUUjRyTdloxWt8/edit?resourcekey=&gid=913092206#gid=913092206";

    const defaultConfig = {
      blockedDates: [],
      stageTimes: {
        ensaio: { start: "08:00", end: "21:00" },
        montagem: { start: "08:00", end: "21:00" },
        desmontagem: { start: "08:00", end: "21:00" },
      },
      buttonExternalEditalText: "Edital Externo",
      formsLink: FIXED_FORMS_LINK,
      sheetLink: FIXED_SHEET_LINK,
      sheetId: "",
      useFixedLinks: true,
      weights: { A: 1, B: 1, C: 1, D: 1 },
      pageTitle: "Sistema de Agendamento de Espaços",
      allowBookingOverlap: false,
      enableInternalEdital: false,
      enableExternalEdital: true,
      enableRehearsal: true,
      requiredAssessments: 3,
    };

    // 1. Tenta buscar do banco de dados primeiro
    try {
      const result = await query('SELECT config_json FROM config WHERE id = 1');
      if (result.rows.length > 0) {
        const savedConfig = JSON.parse(result.rows[0].config_json);
        const fullConfig = { ...defaultConfig, ...savedConfig };

        // Se useFixedLinks estiver ativo, força o uso dos links fixos
        if (fullConfig.useFixedLinks) {
          fullConfig.formsLink = FIXED_FORMS_LINK;
          fullConfig.sheetLink = FIXED_SHEET_LINK;
        }

        console.log("✅ Configurações carregadas do banco de dados.");
        return res.json(fullConfig);
      }
    } catch (dbError) {
      console.warn("⚠️ Erro ao buscar configurações do banco:", dbError.message);
    }

    // 2. Fallback: Tenta ler do arquivo local (config.json)
    try {
      if (fs.existsSync("config.json")) {
        const fileConfig = JSON.parse(fs.readFileSync("config.json", "utf8"));
        const fullConfig = { ...defaultConfig, ...fileConfig };

        // Se useFixedLinks estiver ativo, força o uso dos links fixos
        if (fullConfig.useFixedLinks) {
          fullConfig.formsLink = FIXED_FORMS_LINK;
          fullConfig.sheetLink = FIXED_SHEET_LINK;
        }

        console.log("✅ Configurações carregadas do arquivo local.");
        return res.json(fullConfig);
      }
    } catch (fileError) {
      console.warn("⚠️ Erro ao buscar configurações do arquivo:", fileError.message);
    }

    // 3. Se não encontrou em nenhum lugar, retorna configuração padrão
    console.log("ℹ️ Usando configuração padrão.");
    res.json(defaultConfig);
  } catch (e) {
    console.error("❌ Erro em GET /api/config:", e.message);
    res.status(500).json({ error: "Erro ao ler configuração." });
  }
});

// --- 10. ENDPOINTS PARA GERENCIAR AVALIADORES E AUTENTICAÇÃO ---

// Endpoint para buscar a lista de avaliadores
app.get('/api/evaluators', async (req, res) => {
  try {
    const result = await query('SELECT * FROM evaluators ORDER BY email ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar avaliadores:', error);
    res.status(500).json({ error: 'Erro ao buscar lista de avaliadores.' });
  }
});

app.post('/api/evaluators', async (req, res) => {
  const { evaluators, sharedPassword } = req.body;
  
  if (!Array.isArray(evaluators) || !sharedPassword) {
    return res.status(400).json({ error: 'Dados invalidos. Forneca um array de avaliadores e uma senha unica.' });
  }

  try {
    console.log('Recebido pedido para salvar avaliadores:', { count: evaluators.length });
    // 1. Inserir ou atualizar avaliadores com a senha única
    for (const evaluator of evaluators) {
      const email = evaluator.email;
      if (!email) {
        console.warn('Avaliador sem email ignorado:', evaluator);
        continue;
      }
      
      console.log('Processando avaliador:', email);
      const evaluatorPassword = 'avalia.dac.2026';
      await query(
        'INSERT INTO evaluators (email, password_hash) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash',
        [email.trim().toLowerCase(), evaluatorPassword]
      );
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Avaliadores salvos com sucesso. Nenhum e-mail foi enviado.' 
    });
  } catch (error) {
    console.error('Erro ao salvar avaliadores:', error);
    res.status(500).json({ error: 'Erro ao salvar avaliadores: ' + error.message, details: error });
  }
});

// Endpoint para remover um avaliador
app.delete('/api/evaluators/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM evaluators WHERE id = $1', [id]);
    res.json({ success: true, message: 'Avaliador removido com sucesso.' });
  } catch (error) {
    console.error('Erro ao remover avaliador:', error);
    res.status(500).json({ error: 'Erro ao remover avaliador.' });
  }
});

app.post('/api/auth/viewer', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Nome e senha sao obrigatorios.' });
    }
    try {
        const result = await query('SELECT * FROM evaluators WHERE email = $1', [email.trim().toLowerCase()]);
        const evaluator = result.rows[0];
        
        if (!evaluator) {
            return res.status(403).json({ success: false, message: 'Acesso negado. Nome nao encontrado na lista de avaliadores.' });
        }

        // Comparacao simples (sem bcrypt)
        if (password === evaluator.password_hash) {
            res.json({ success: true, message: 'Acesso autorizado.' });
        } else {
            res.status(403).json({ success: false, message: 'Acesso negado. Senha incorreta.' });
        }
    } catch (error) {
        console.error('Erro na autenticacao do avaliador:', error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
});

// --- ROTA PARA BUSCAR DADOS DO FORMS (DINÂMICO) ---
app.get('/api/forms-data', async (req, res) => {
  try {
    // Busca a configuração atual para pegar o sheetId dinâmico
    const config = await getConfigFromDB();
    const sheetId = config.sheetId || '1Fh8G2vQ1Tu4_qXghW6q5X2noxvUAuJA0m70pAwxka-s';

    if (!sheets) {
        console.warn("⚠️ API do Google Sheets não inicializada.");
        return res.status(503).json({ error: 'Serviço do Google Sheets não disponível.' });
    }

    // Acessa a API do Google Sheets para todas as abas
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const sheetTitles = spreadsheet.data.sheets.map(s => s.properties.title);
    
    let allFormsData = [];
    for (const title of sheetTitles) {
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: `${title}!A:ZZ`
        });
        const rows = response.data.values;
        if (rows && rows.length > 1) {
          const headers = rows[0];
          const sheetRecords = rows.slice(1).map(row => {
            const rowData = {};
            headers.forEach((header, index) => { rowData[header] = row[index] || ""; });
            return rowData;
          });
          allFormsData = allFormsData.concat(sheetRecords);
        }
      } catch (sheetErr) {
        console.warn(`⚠️ Erro ao ler aba "${title}":`, sheetErr.message);
      }
    }

    res.json(allFormsData);

  } catch (e) {
    console.error('❌ Erro ao buscar dados do Forms/Sheets:', e.message);
    // Verifica se o erro é de permissão (403) ou credenciais inválidas
    if (e.code === 403) {
      res.status(403).json({ error: 'Erro de permissão. Verifique se a conta de serviço tem acesso à planilha.' });
    } else {
      res.status(500).json({ error: 'Erro interno ao buscar dados da planilha.' });
    }
  }
});

// --- ROTA PARA AUTENTICAÇÃO DO ADMINISTRADOR ---
app.post('/api/auth/admin', async (req, res) => {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin.dac.ufsc'; // Senha padrão se não estiver em ENV

    if (!password) {
        return res.status(400).json({ error: 'A senha é obrigatória.' });
    }

    // Comparação simples da senha
    if (password === adminPassword) {
        res.json({ success: true, message: 'Acesso de administrador autorizado.' });
    } else {
        res.status(403).json({ success: false, message: 'Acesso negado. Senha incorreta.' });
    }
});

// NOVO: Endpoint unificado para SALVAR a configuração
app.post("/api/config", async (req, res) => {
  try {
    const newConfigData = req.body;
    let currentConfig = {};

    // 1. Busca a configuração atual do banco de dados
    try {
      const result = await query('SELECT config_json FROM config WHERE id = 1');
      if (result.rows.length > 0) {
        currentConfig = JSON.parse(result.rows[0].config_json);
      }
    } catch (e) {
      console.warn("⚠️ Nenhuma configuração encontrada no banco, criando nova.");
    }

    // 2. Mescla a configuração atual com os novos dados recebidos
    const updatedConfig = { ...currentConfig, ...newConfigData };

    // Validação e limpeza para o novo campo
    if (updatedConfig.buttonExternalEditalText && updatedConfig.buttonExternalEditalText.length > 50) {
        updatedConfig.buttonExternalEditalText = updatedConfig.buttonExternalEditalText.substring(0, 50);
    }

    // Links fixos solicitados pelo usuário
    const FIXED_FORMS_LINK = "https://docs.google.com/forms/d/e/1FAIpQLScxvwER2fKcTMebfOas0NWm4hn35POVjkmYtbwRLFEKmq3G5w/viewform?usp=dialog";
    const FIXED_SHEET_LINK = "https://docs.google.com/spreadsheets/d/1DSMc1jGYJmK01wxKjAC83SWXQxcoxPUUjRyTdloxWt8/edit?resourcekey=&gid=913092206#gid=913092206";

    // Se estiver usando links fixos, sobrescreve os links atuais
    if (updatedConfig.useFixedLinks) {
        updatedConfig.formsLink = FIXED_FORMS_LINK;
        updatedConfig.sheetLink = FIXED_SHEET_LINK;
    }

    // Sempre recalcula o sheetId com base no sheetLink atual (seja fixo ou manual)
    if (updatedConfig.sheetLink) {
      const match = updatedConfig.sheetLink.match(/\/d\/([a-zA-Z0-9-_]+)/);
      updatedConfig.sheetId = match ? match[1] : updatedConfig.sheetLink;
    }

    // Sincroniza formsId para compatibilidade se necessário
    if (updatedConfig.formsLink) {
        const match = updatedConfig.formsLink.match(/(?:forms\/d\/e\/|spreadsheets\/d\/)([a-zA-Z0-9_-]+)/);
        updatedConfig.formsId = match ? match[1] : updatedConfig.formsLink;
    }

    // 3. Salva no banco de dados (INSERT ou UPDATE)
    const configJson = JSON.stringify(updatedConfig);
    console.log("📦 Tentando salvar no banco de dados...");
    try {
      await query(`
        INSERT INTO config (id, config_json, updated_at)
        VALUES (1, $1, CURRENT_TIMESTAMP)
        ON CONFLICT (id) 
        DO UPDATE SET config_json = $1, updated_at = CURRENT_TIMESTAMP
      `, [configJson]);
      console.log("✅ Configurações salvas com sucesso no banco de dados!");
    } catch (dbError) {
      console.error("❌ Erro ao salvar no banco de dados:", dbError.message);
      console.error("   Detalhes:", dbError);
    }

    // 4. Também salva no arquivo local (para desenvolvimento/backup)
    fs.writeFileSync("config.json", JSON.stringify(updatedConfig, null, 2));
    console.log("✅ Configurações salvas no arquivo local (backup).");
    
    res.json({ success: true, ...updatedConfig });
    
  } catch (err) {
    console.error("❌ Erro em POST /api/config:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ NOVOS ENDPOINTS PARA CRITÉRIOS DINÂMICOS
app.get('/api/criteria', async (req, res) => {
  try {
    const result = await query('SELECT * FROM evaluation_criteria ORDER BY sort_order ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar critérios:', error);
    res.status(500).json({ error: 'Erro ao buscar critérios de avaliação.' });
  }
});

app.post('/api/criteria', async (req, res) => {
  const criteriaList = req.body; // Espera um array de objetos

  if (!Array.isArray(criteriaList)) {
    return res.status(400).json({ error: 'O corpo da requisição deve ser um array de critérios.' });
  }

  try {
    // Primeiro, limpa a tabela para garantir que apenas os novos critérios existam
    await query('DELETE FROM evaluation_criteria');
    
    // Depois, insere todos os novos critérios
    for (const criterion of criteriaList) {
      await query(
        'INSERT INTO evaluation_criteria (id, title, description, weight, sort_order) VALUES ($1, $2, $3, $4, $5)',
        [criterion.id, criterion.title, criterion.description, criterion.weight, criterion.sort_order]
      );
    }
    
    res.status(200).json({ success: true, message: 'Critérios de avaliação salvos com sucesso.' });
  } catch (error) {
    console.error('Erro ao salvar critérios:', error);
    res.status(500).json({ error: 'Erro ao salvar os critérios no banco de dados.' });
  }
});

// --- 11. ROTA PARA OBTER INSCRIÇÕES ---
app.get("/api/inscricoes", async (req, res) => {
  try {
    const criteria = await getEvaluationCriteria();
    const inscriptionsResult = await query("SELECT * FROM inscricoes ORDER BY criado_em DESC");
    const inscriptions = inscriptionsResult.rows;
    
    const assessmentsResult = await query("SELECT * FROM assessments");
    const allAssessments = assessmentsResult.rows;
    
    const totalEvaluatorsResult = await query('SELECT COUNT(*) as count FROM evaluators');
    const totalEvaluators = totalEvaluatorsResult.rows[0].count;

    // ✅ LÓGICA DE DETECÇÃO DE CONFLITO
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

    const requiredAssessmentsForScore = await getRequiredAssessments();

    const inscriptionsWithScores = inscriptions.map(inscription => {
      let finalScore = null;
      const relatedAssessments = allAssessments.filter(a => a.inscription_id === inscription.id);
      
      if (relatedAssessments.length >= requiredAssessmentsForScore && requiredAssessmentsForScore > 0) {
        let totalScoreSum = 0;
        const assessmentsForScore = relatedAssessments.slice(0, requiredAssessmentsForScore);
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

          const weightedAverage = totalWeight > 0 ? singleEvaluationScore / totalWeight : 0;
          totalScoreSum += weightedAverage;
        });

        finalScore = totalScoreSum / assessmentsForScore.length;
      }

      // Detectar conflito
      let hasConflict = false;
      const inscriptionSlots = allSlots.filter(s => s.id === inscription.id);
      for (let i = 0; i < allSlots.length; i++) {
        for (let j = i + 1; j < allSlots.length; j++) {
          const slotA = allSlots[i];
          const slotB = allSlots[j];
          // ✅ MODIFICADO: Conflito agora considera apenas data/horário (Teatro e Igrejinha são próximos)
          if (slotA.start < slotB.end && slotA.end > slotB.start) {
            if (inscriptionSlots.some(s => (s.start === slotA.start && s.end === slotA.end) || (s.start === slotB.start && s.end === slotB.end))) {
              hasConflict = true;
              break;
            }
          }
        }
        if (hasConflict) break;
      }

      return { 
        ...inscription, 
        finalScore, 
        allAssessments: relatedAssessments, 
        assessmentsCount: relatedAssessments.length, 
        evaluatorsWhoAssessed: relatedAssessments.map(a => a.evaluator_email), 
        totalEvaluators,
        hasConflict
      };
    });

    // O resto da rota para unificar com o Google Forms...
    let formsDataRows = [];
    try {
      const FIXED_SHEET_LINK = "https://docs.google.com/spreadsheets/d/1DSMc1jGYJmK01wxKjAC83SWXQxcoxPUUjRyTdloxWt8/edit?resourcekey=&gid=913092206#gid=913092206";
      const matchId = FIXED_SHEET_LINK.match(/\/d\/([a-zA-Z0-9-_]+)/);
      let sheetId = matchId ? matchId[1] : null;

      console.log(`[UNIFY] Usando SheetId: ${sheetId}`);

      if (sheetId && sheets) {
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        const sheetTitles = spreadsheet.data.sheets.map(s => s.properties.title);
        
        for (const title of sheetTitles) {
          try {
            const response = await sheets.spreadsheets.values.get({
              spreadsheetId: sheetId,
              range: `${title}!A:Z`
            });
            const rows = response.data.values;
            if (rows && rows.length > 1) {
              const headers = rows[0];
              const sheetRecords = rows.slice(1).map(row => {
                const obj = {};
                headers.forEach((header, i) => { obj[header] = row[i] || ''; });
                return obj;
              });
              formsDataRows = formsDataRows.concat(sheetRecords);
            }
          } catch (sheetErr) {
            console.warn(`⚠️ [UNIFY] Erro ao ler aba "${title}":`, sheetErr.message);
          }
        }
      }
    } catch (e) {
      console.warn("⚠️ [UNIFY] Aviso: Não foi possível buscar dados da planilha.", e.message);
    }

    const inscricoesCompletas = inscriptionsWithScores.map(inscricao => {
      const emailEtapa1 = (inscricao.email || "").trim().toLowerCase();
      const telEtapa1 = (inscricao.telefone || "").replace(/\D/g, "").replace(/^(55)/, "");
      
      console.log(`[UNIFY] Tentando unificar inscrição #${inscricao.id} (${inscricao.nome})`);
      const match = formsDataRows.find(f => {
        // ✅ Lógica robusta do PDF para encontrar a coluna de e-mail
        let emailKey = Object.keys(f).find(k => k.toLowerCase().includes("mail"));
        if (!emailKey) {
          emailKey = Object.keys(f).find(k => {
            const value = (f[k] || "").trim();
            return typeof value === 'string' && value.includes("@") && value.includes(".");
          });
        }
        
        // ✅ Lógica robusta do PDF para encontrar a coluna de telefone
        const telKey = Object.keys(f).find(k => {
           const nk = normalizeKey(k);
           return nk.includes("fone") || nk.includes("telefone") || nk.includes("contato") || nk.includes("whatsapp");
        });

        const emailForms = emailKey ? (f[emailKey] || "").trim().toLowerCase() : null;
        const telForms = telKey ? (f[telKey] || "").replace(/\D/g, "").replace(/^(55)/, "") : null;
        
        // Lógica de telefone flexível (aceita com ou sem o 9 extra)
        const checkTelMatch = (t1, t2) => {
          if (!t1 || !t2) return false;
          if (t1 === t2) return true;
          // Se um tem 11 dígitos e outro 10, e os últimos 8 são iguais e o DDD bate
          const clean1 = t1.length > 10 ? t1.slice(0, 2) + t1.slice(3) : t1;
          const clean2 = t2.length > 10 ? t2.slice(0, 2) + t2.slice(3) : t2;
          return clean1 === clean2;
        };

        // ✅ Lógica robusta do PDF para encontrar a coluna de nome
        const nomeKey = Object.keys(f).find(k => {
           const nk = normalizeKey(k);
           return nk.includes("nome") || nk.includes("responsavel") || nk.includes("proponente");
        });
        const nomeForms = nomeKey ? normalizeKey(f[nomeKey] || "") : "";
        const nomeEtapa1 = normalizeKey(inscricao.nome || "");

        const isMatch = (emailForms && emailEtapa1 && emailForms.includes(emailEtapa1)) || 
                       (emailEtapa1 && emailForms && emailEtapa1.includes(emailForms)) ||
                       checkTelMatch(telEtapa1, telForms) ||
                       (nomeForms && nomeEtapa1 && (nomeForms.includes(nomeEtapa1) || nomeEtapa1.includes(nomeForms)));
        
        // Log detalhado de cada tentativa para depuração no Render
        if (inscricao.id === 3 || inscricao.id === "3") {
           console.log(`[UNIFY-DEBUG] Testando #${inscricao.id} contra linha da planilha:`);
           console.log(`  - Email Etapa 1: "${emailEtapa1}" | Email Planilha: "${emailForms}" (Chave: ${emailKey})`);
           console.log(`  - Tel Etapa 1: "${telEtapa1}" | Tel Planilha: "${telForms}" (Chave: ${telKey})`);
           console.log(`  - Resultado: ${isMatch ? "✅ MATCH" : "❌ NO MATCH"}`);
        }

        if (isMatch) console.log(`[UNIFY] ✅ Sucesso! Encontrado match para #${inscricao.id} na planilha.`);
        return isMatch;
      });

      if (!match) {
        console.log(`[UNIFY] ❌ Falha! Não foi encontrado match para #${inscricao.id} na planilha.`);
        console.log(`[UNIFY]   - Email Etapa 1: "${emailEtapa1}"`);
        console.log(`[UNIFY]   - Tel Etapa 1: "${telEtapa1}"`);
        if (formsDataRows.length > 0) {
           console.log(`[UNIFY]   - Verificando primeiros 2 registros da planilha para depuração:`);
           formsDataRows.slice(0, 2).forEach((r, idx) => {
             console.log(`[UNIFY]     Reg [${idx}]: Email="${(r['Endereço de e-mail'] || r['Email'] || 'N/A')}", Tel="${(r['Telefone'] || r['Fone'] || 'N/A')}"`);
           });
        }
      }

      let proponenteTipo = 'Não identificado';
      if (match) {
        const tipoKey = Object.keys(match).find(key => {
          const normalized = normalizeKey(key);
          // Busca por termos comuns em formulários (inscreve, tipo, proponente)
          return normalized.includes('inscreve') || normalized.includes('inscrevera') || 
                 (normalized.includes('proponente') && (normalized.includes('tipo') || normalized.includes('fisica') || normalized.includes('juridica')));
        });
        if (tipoKey && match[tipoKey]) {
          proponenteTipo = match[tipoKey];
        }
      }

      const finalInsc = { 
        ...inscricao, 
        etapa2_ok: !!match, 
        formsData: match || null,
        proponenteTipo: proponenteTipo 
      };
      if (match) console.log(`[UNIFY] Objeto final para #${inscricao.id} marcado como etapa2_ok: true`);
      return finalInsc;
    });

    let requiredAssessments = 3;
    try {
      const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));
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

// --- 12. FUNÇÕES AUXILIARES PARA CONSOLIDAÇÃO DE AGENDA ---

/**
 * Calcula a pontuação final de uma inscrição com base nas avaliações e critérios.
 */
function calculateFinalScore(inscriptionId, criteria, allAssessments) {
  const requiredAssessments = getRequiredAssessments();
  const relatedAssessments = allAssessments.filter(a => a.inscription_id === inscriptionId);

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

    const weightedAverage = totalWeight > 0 ? singleEvaluationScore / totalWeight : 0;
    totalScoreSum += weightedAverage;
  });

  return totalScoreSum / assessmentsForScore.length;
}

/**
 * Remove um evento do Google Calendar e limpa o eventId no banco de dados.
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
      const inscricaoResult = await query("SELECT eventos_json FROM inscricoes WHERE id = $1", [inscriptionId]);
      const inscricao = inscricaoResult.rows[0];
      if (inscricao && inscricao.eventos_json) {
        const eventos = JSON.parse(inscricao.eventos_json);
        const newEventos = eventos.filter(ev => ev.eventId !== eventId);
        await query("UPDATE inscricoes SET eventos_json = $1 WHERE id = $2", [JSON.stringify(newEventos), inscriptionId]);
      }
    } else {
      await query(`UPDATE inscricoes SET ${eventType}_eventId = NULL, ${eventType}_inicio = NULL, ${eventType}_fim = NULL WHERE id = $1`, [inscriptionId]);
    }
  } catch (error) {
    console.error(`❌ Erro ao deletar evento ${eventId} (${eventType}) do Google Calendar:`, error.message);
  }
}

/**
 * Cria um evento no Google Calendar e salva o eventId no banco de dados.
 */
async function updateCalendarEvent(local, eventId, summary) {
  try {
    const event = {
      summary: summary,
      extendedProperties: {
        private: {
          managedBy: "sistema-edital-dac",
          status: "confirmed"
        }
      }
    };

    await calendar.events.patch({
      calendarId: calendarIds[local],
      eventId: eventId,
      resource: event
    });

    console.log(`✅ Evento ${eventId} atualizado para 'confirmed' no Google Calendar.`);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao atualizar evento ${eventId} no Google Calendar:`, error.message);
    return false;
  }
}

/**
 * Cria um evento no Google Calendar e salva o eventId no banco de dados.
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
      const inscricaoResult = await query("SELECT eventos_json FROM inscricoes WHERE id = $1", [inscriptionId]);
      const inscricao = inscricaoResult.rows[0];
      if (inscricao && inscricao.eventos_json) {
        const eventos = JSON.parse(inscricao.eventos_json);
        const eventoIndex = eventos.findIndex(ev => ev.inicio === start && ev.fim === end);
        if (eventoIndex !== -1) {
          eventos[eventoIndex].eventId = newEventId;
          await query("UPDATE inscricoes SET eventos_json = $1 WHERE id = $2", [JSON.stringify(eventos), inscriptionId]);
        }
      }
    } else {
      await query(`UPDATE inscricoes SET ${eventType}_eventId = $1 WHERE id = $2`, [newEventId, inscriptionId]);
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
    <p>Atenciosamente,<br>Sistema de Agendamento DAC</p>
  ` : `
    <h2>Atenção, ${nome}. Seu agendamento foi cancelado.</h2>
    <p>Após a consolidação da agenda, sua proposta não obteve a maior pontuação para o horário solicitado, e o agendamento foi cancelado.</p>
    <p>Você pode acessar o sistema para verificar a possibilidade de reagendamento em outras datas ou horários.</p>
    <p>Atenciosamente,<br>Sistema de Agendamento DAC</p>
  `;

  const mailOptions = {
    from: `"Sistema de Agendamento DAC" <${process.env.EMAIL_USER || 'seu-email@gmail.com'}>`,
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
  
  const conflictingResult = await query("SELECT * FROM inscricoes WHERE hasConflict = 1");
  const conflictingInscriptions = conflictingResult.rows;

  if (conflictingInscriptions.length === 0) {
    console.log("✅ Nenhuma inscrição em conflito encontrada. Consolidação finalizada.");
    return { success: true, message: "Nenhuma inscrição em conflito encontrada." };
  }

  const assessmentsResult = await query("SELECT * FROM assessments");
  const allAssessments = assessmentsResult.rows;

  // 1. Calcular a pontuação final para todas as inscrições em conflito
  const inscriptionsWithScores = conflictingInscriptions.map(insc => ({
    ...insc,
    finalScore: calculateFinalScore(insc.id, criteria, allAssessments)
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
  const conflictingTimeSlots = {};

  for (let i = 0; i < allSlots.length; i++) {
    for (let j = i + 1; j < allSlots.length; j++) {
      const slotA = allSlots[i];
      const slotB = allSlots[j];

      // ✅ MODIFICADO: Conflito agora considera apenas data/horário (Teatro e Igrejinha são próximos)
      if (slotA.start < slotB.end && slotA.end > slotB.start) {
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
    
    const slotsInConflict = allSlots.filter(slot => inscriptionIds.includes(slot.inscriptionId) && key.includes(slot.start.toISOString()) && key.includes(slot.end.toISOString()));

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

      slotsInConflict.forEach(slot => {
        if (slot.inscriptionId !== winnerSlot.inscriptionId) {
          losingInscriptions.add(slot.inscriptionId);
          updatedInscriptions.add(slot.inscriptionId);
          
          deleteCalendarEvent(slot.local, slot.inscriptionId, slot.type, slot.eventId);
        } else {
          const inscricaoVencedora = inscriptionsWithScores.find(i => i.id === slot.inscriptionId);
          if (slot.eventId) {
            // Se o evento já existe, atualiza o status para 'confirmed'
            updateCalendarEvent(slot.local, slot.eventId, `${slot.type.charAt(0).toUpperCase() + slot.type.slice(1)} - ${inscricaoVencedora.evento_nome}`);
          } else {
            // Se o evento não existe (o que não deveria acontecer se a primeira etapa foi concluída), cria
            createCalendarEvent(slot.local, slot.inscriptionId, slot.type, slot.start.toISOString(), slot.end.toISOString(), inscricaoVencedora.evento_nome);
          }
        }
      });
    }
  }

  // 5. Atualizar a flag hasConflict e enviar e-mails
  for (const id of updatedInscriptions) {
    await query("UPDATE inscricoes SET hasConflict = 0 WHERE id = $1", [id]);
    const inscricaoResult = await query("SELECT email, nome FROM inscricoes WHERE id = $1", [id]);
    const { email, nome } = inscricaoResult.rows[0];
    
    const isWinner = winningInscriptions.has(id);
    sendConsolidationEmail(email, nome, isWinner);
  }

  console.log(`✅ Consolidação concluída. Vencedores: ${winningInscriptions.size}, Perdedores: ${losingInscriptions.size}.`);
  return { success: true, message: `Consolidação concluída. ${winningInscriptions.size} vencedores e ${losingInscriptions.size} perdedores.` };
}

// --- 13. ROTA PARA OBTER DADOS BRUTOS PARA ANÁLISE (GERAR SLIDES) ---
app.get("/api/admin/data-for-analysis", async (req, res) => {
  try {
    const criteria = await getEvaluationCriteria();
    const inscriptionsResult = await query("SELECT * FROM inscricoes ORDER BY criado_em DESC");
    const inscriptions = inscriptionsResult.rows;
    
    const assessmentsResult = await query("SELECT * FROM assessments");
    const allAssessments = assessmentsResult.rows;
    
    const totalEvaluatorsResult = await query('SELECT COUNT(*) as count FROM evaluators');
    const totalEvaluators = totalEvaluatorsResult.rows[0].count;

    const requiredAssessmentsForScore = await getRequiredAssessments();

    const inscriptionsWithScores = inscriptions.map(inscription => {
      let finalScore = null;
      const relatedAssessments = allAssessments.filter(a => a.inscription_id === inscription.id);
      
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
      
      const hasConflict = inscription.hasConflict === 1;

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
    });
  } catch (error) {
    console.error("❌ Erro em GET /api/inscricoes:", error);
    res.status(500).json({ error: "Erro interno ao obter inscrições." });
  }
});

// --- 11.1. ROTA PARA OBTER APENAS OS IDs DAS INSCRIÇÕES (PARA O ADMIN PANEL) ---
app.get("/api/admin/inscricoes", async (req, res) => {
  try {
    const inscriptionsResult = await query("SELECT id FROM inscricoes ORDER BY criado_em DESC");
    const ids = inscriptionsResult.rows.map(row => row.id);
    res.json(ids);
  } catch (error) {
    console.error("❌ Erro em GET /api/admin/inscricoes:", error);
    res.status(500).json({ error: "Erro interno ao obter IDs de inscrições." });
  }
});

// --- 12. ROTA PARA OBTER DETALHES DE UMA INSCRIÇÃO (PARA O ADMIN PANEL) ---
app.get("/api/admin/inscricoes/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const inscriptionResult = await query("SELECT * FROM inscricoes WHERE id = $1", [id]);
    if (inscriptionResult.rows.length === 0) {
      return res.status(404).json({ error: "Inscrição não encontrada." });
    }
    const inscricao = inscriptionResult.rows[0];

    // Simulação de dados do Forms e Arquivos (para evitar dependência do Google Sheets/Drive)
    // Em um ambiente real, esta lógica precisaria ser implementada.
    const dadosForms = {
      "Campo 1 do Forms": "Valor de teste 1",
      "Campo 2 do Forms": "Valor de teste 2",
    };
    const arquivos = [
      { nome: "anexo_teste_1.pdf", url: "/anexos/1/anexo_teste_1.pdf" },
      { nome: "anexo_teste_2.jpg", url: "/anexos/1/anexo_teste_2.jpg" },
    ];

    res.json({
      dados: inscricao, // Retorna os dados brutos da inscrição
      forms: dadosForms, // Retorna dados simulados do forms
      arquivos: arquivos, // Retorna arquivos simulados
    });
  } catch (error) {
    console.error("❌ Erro em GET /api/admin/inscricoes/:id:", error);
    res.status(500).json({ error: "Erro interno ao obter detalhes da inscrição." });
  }
});

// --- 13. ROTA PARA OBTER DADOS BRUTOS PARA ANÁLISE (GERAR SLIDES) ---
app.get("/api/admin/data-for-analysis", async (req, res) => {
  try {
    const criteria = await getEvaluationCriteria();
    const inscriptionsResult = await query("SELECT * FROM inscricoes ORDER BY criado_em DESC");
    const inscriptions = inscriptionsResult.rows;
    
    const assessmentsResult = await query("SELECT * FROM assessments");
    const allAssessments = assessmentsResult.rows;
    
    const totalEvaluatorsResult = await query('SELECT COUNT(*) as count FROM evaluators');
    const totalEvaluators = totalEvaluatorsResult.rows[0].count;

    const requiredAssessmentsForScore = await getRequiredAssessments();

    const inscriptionsWithScores = inscriptions.map(inscription => {
      let finalScore = null;
      const relatedAssessments = allAssessments.filter(a => a.inscription_id === inscription.id);
      
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
      
      // Normalizar o campo hasConflict para booleano
      const hasConflict = inscription.hasconflict === 1 || inscription.hasconflict === true || inscription.hasConflict === 1 || inscription.hasConflict === true;

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
    });
  } catch (error) {
    console.error("❌ Erro ao obter dados para análise:", error);
    res.status(500).json({ error: "Erro interno ao obter dados para análise." });
  }
});

// --- 14. ROTA PARA CONSOLIDAR AGENDA ---
app.post("/api/admin/consolidate", async (req, res) => {
  try {
    const result = await consolidateSchedule();
    res.json(result);
  } catch (error) {
    console.error("❌ Erro na consolidação de agenda:", error);
    res.status(500).json({ success: false, error: "Erro interno ao consolidar a agenda." });
  }
});

// --- 15. ROTA PARA FORNECER O LINK DA PLANILHA MESTRE ---
app.get("/api/master-sheet-link", (req, res) => {
  try {
    const MASTER_SHEET_CONFIG_PATH = 'masterSheet.json';

    if (fs.existsSync(MASTER_SHEET_CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(MASTER_SHEET_CONFIG_PATH, 'utf-8'));
      if (config.sheetId) {
        const link = `https://docs.google.com/spreadsheets/d/${config.sheetId}/edit`;
        return res.json({ masterSheetLink: link } );
      }
    }
    res.json({ masterSheetLink: "" });
  } catch (error) {
    console.error("Erro ao ler o link da Planilha Mestre:", error.message);
    res.status(500).json({ error: "Erro ao obter o link da Planilha Mestre." });
  }
});

// --- 16. ROTA PARA CRIAR EVENTOS (ETAPA 1) ---
app.post("/api/create-events", async (req, res) => {
  try {
    const { local, resumo, etapas, userData } = req.body;
    console.log("📥 Recebida requisição /api/create-events:", { local, resumo, etapasCount: etapas?.length, userDataEmail: userData?.email });
    
    if (!calendarIds[local]) {
      console.error("❌ Calendário não encontrado para o local:", local);
      return res.status(400).json({ success: false, error: "Calendário não encontrado." });
    }

    let eventosCriados = [];
    let etapasComId = [];
    let calendarError = null;

    // 1. Tenta criar os eventos no Google Calendar
    try {
      const calendar = google.calendar({ version: 'v3', auth: auth });
      for (const etapa of etapas) {
        const nomeEtapaCapitalizado = etapa.nome.charAt(0).toUpperCase() + etapa.nome.slice(1);
        const event = {
          summary: `${nomeEtapaCapitalizado} - ${resumo}`,
          start: { dateTime: etapa.inicio, timeZone: "America/Sao_Paulo" },
          end: { dateTime: etapa.fim, timeZone: "America/Sao_Paulo" },
          description: "EM ANÁLISE - Horário sujeito a alteração conforme resultado do edital.",
          extendedProperties: {
            private: {
              managedBy: "sistema-edital-dac",
              status: "pending_evaluation"
            }
          }
        };
        try {
          const response = await calendar.events.insert({ calendarId: calendarIds[local], resource: event });
          etapasComId.push({ ...etapa, eventId: response.data.id });
          eventosCriados.push({ etapa: etapa.nome, id: response.data.id, summary: response.data.summary, inicio: etapa.inicio });

        } catch (err) {
          console.error(`⚠️ Falha ao criar evento "${event.summary}" no Google Calendar:`, err.message);
          // Não lançamos o erro para permitir que a inscrição seja salva no banco
          etapasComId.push({ ...etapa, eventId: null });
        }
      }
    } catch (err) {
      // Captura erro de inicialização do Google Calendar (ex: invalid_grant)
      calendarError = err;
      console.error("⚠️ Erro de inicialização do Google Calendar:", err.message);
      console.error("⚠️ DETALHES DO ERRO DO GOOGLE CALENDAR:", err);
      // Continuamos o processo para salvar no banco de dados
    }

    // 2. Salva a inscrição no banco de dados, independentemente do sucesso do Calendar
    try {
      const dbPayload = {
        nome: userData.name, email: userData.email, telefone: userData.phone,
        evento_nome: userData.eventName || resumo, local,
        ensaio_inicio: null, ensaio_fim: null, ensaio_eventId: null,
        montagem_inicio: null, montagem_fim: null, montagem_eventId: null,
        desmontagem_inicio: null, desmontagem_fim: null, desmontagem_eventId: null,
        eventos_json: '[]'
      };
      
      const todosEventos = [];
      etapasComId.forEach(e => {
        const nome = e.nome.toLowerCase();
        
        // Adiciona ao array geral de eventos para o JSON
        todosEventos.push({ nome: e.nome, inicio: e.inicio, fim: e.fim, eventId: e.eventId });

        // Mantém compatibilidade com colunas legadas (pega o primeiro de cada tipo)
        if (dbPayload.hasOwnProperty(`${nome}_inicio`) && !dbPayload[`${nome}_inicio`]) {
          dbPayload[`${nome}_inicio`] = e.inicio;
          dbPayload[`${nome}_fim`] = e.fim;
          dbPayload[`${nome}_eventId`] = e.eventId;
        }
      });
      
      dbPayload.eventos_json = JSON.stringify(todosEventos);
      
      try {
        await query(
          `INSERT INTO inscricoes (nome, email, telefone, evento_nome, local, ensaio_inicio, ensaio_fim, ensaio_eventId, montagem_inicio, montagem_fim, montagem_eventId, desmontagem_inicio, desmontagem_fim, desmontagem_eventId, eventos_json) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [dbPayload.nome, dbPayload.email, dbPayload.telefone, dbPayload.evento_nome, dbPayload.local, dbPayload.ensaio_inicio, dbPayload.ensaio_fim, dbPayload.ensaio_eventId, dbPayload.montagem_inicio, dbPayload.montagem_fim, dbPayload.montagem_eventId, dbPayload.desmontagem_inicio, dbPayload.desmontagem_fim, dbPayload.desmontagem_eventId, dbPayload.eventos_json]
        );
        console.log("💾 Inscrição salva no banco com sucesso!");
      } catch (dbErr) {
        console.error("⚠️ Erro ao salvar no banco de dados, mas o evento foi criado no Calendar:", dbErr.message);
        // Se o evento foi criado no Calendar mas o banco falhou, ainda podemos considerar "sucesso" para o usuário não travar
        // mas avisamos no log. Se ambos falharem, aí sim é erro total.
        if (eventosCriados.length === 0) throw dbErr;
      }

      const message = calendarError || eventosCriados.length < etapas.length 
        ? "Inscrição processada, mas houve erro na sincronização total com o Google Calendar." 
        : "Eventos criados e inscrição salva com sucesso!";
      
      // Envia a resposta ANTES do e-mail para evitar timeout ou erros de e-mail bloquearem o frontend
      res.json({ 
        success: true, 
        message: message, 
        eventos: eventosCriados,
        calendarError: calendarError ? calendarError.message : (eventosCriados.length < etapas.length ? "Alguns eventos não foram criados no Calendar" : null)
      });

      // Envia o e-mail de confirmação da Etapa 1 em segundo plano
      setTimeout(() => {
        sendStep1ConfirmationEmail(userData, (userData.eventName || resumo), local, etapasComId.map(e => ({ nome: e.nome, inicio: e.inicio, fim: e.fim })))
          .catch(mailErr => console.error("❌ Erro no envio de e-mail em background:", mailErr.message));
      }, 100);

    } catch (err) {
      console.error("❌ Erro ao processar inscrição:", err.message);
      res.status(500).json({ success: false, error: "Erro ao salvar inscrição no banco de dados." });
    }
    } catch (err) {
      console.error("❌ Erro no endpoint /api/create-events (catch final):", err);
      // Se o erro for propagado do bloco try/catch do Calendar, ele será capturado aqui.
      res.status(500).json({ 
        success: false, 
        error: "Erro interno ao criar eventos.",
        details: err.message,
        stack: err.stack
      });
    }
});

// --- 17. ROTA PARA CANCELAR MÚLTIPLOS EVENTOS ---

// --- ROTA PARA LIMPEZA GERAL (FORÇADA) ---
app.post("/api/cleanup/force", async (req, res) => {
  try {
    // 1. Buscar todas as inscrições para obter os eventIds do Google Calendar
    const allInscricoes = await query('SELECT * FROM inscricoes');
    const allEventIdsToDelete = [];
    const localMap = {}; // Mapeia eventId para o local (calendarId)

    const addId = (id, local) => { if (id) { allEventIdsToDelete.push(id); localMap[id] = local; } };
    const addJsonIds = (json, local) => {
      try {
        JSON.parse(json).forEach(e => addId(e.eventId, local));
      } catch (e) { /* ignore */ }
    };

    allInscricoes.rows.forEach(inscricao => {
      const local = inscricao.local;
      addId(inscricao.ensaio_eventId, local);
      addId(inscricao.montagem_eventId, local);
      addId(inscricao.desmontagem_eventId, local);
      addJsonIds(inscricao.eventos_json, local);
    });

    // 2. Deletar eventos do Google Calendar
    if (allEventIdsToDelete.length > 0) {
      console.log(`🗑️ Tentando deletar ${allEventIdsToDelete.length} eventos do Google Calendar na Limpeza Geral.`);
      const deletePromises = allEventIdsToDelete.map(eventId => {
        const local = localMap[eventId];
        if (calendarIds[local]) {
          return calendar.events.delete({ calendarId: calendarIds[local], eventId })
            .then(() => console.log(`   ✅ Evento ${eventId} deletado do Calendar.`))
            .catch(err => console.error(`   ❌ Falha ao deletar evento ${eventId} do Calendar:`, err.message));
        }
        return Promise.resolve();
      });
      await Promise.all(deletePromises);
    }

    // 3. Deletar todas as avaliações e inscrições do banco de dados
    await query('DELETE FROM assessments');
    console.log("🗑️ Todas as avaliações deletadas.");
    await query('DELETE FROM inscricoes');
    console.log("🗑️ Todas as inscrições deletadas.");

    // 3. Limpar o cache de eventos (se houver)
    // O cache de eventos é limpo na inicialização, mas é bom garantir.
    // O cache de eventos é um objeto global, não precisa de código aqui.

    res.json({ success: true, message: "Limpeza geral concluída com sucesso." });
  } catch (error) {
    console.error("❌ Erro ao executar limpeza geral:", error);
    res.status(500).json({ error: "Erro interno ao executar a limpeza geral." });
  }
});

// --- 17. ROTA PARA CANCELAR MÚLTIPLOS EVENTOS ---
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

// --- 18. ROTA PARA OBTER EVENTOS OCUPADOS ---

// --- ROTA PARA EXCLUIR INSCRIÇÃO ---
app.delete("/api/inscricao/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Buscar a inscrição para obter os eventIds do Google Calendar
    const result = await query('SELECT * FROM inscricoes WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Inscrição não encontrada." });
    }
    const inscricao = result.rows[0];

    // 2. Cancelar eventos no Google Calendar (se existirem)
    const eventIdsToDelete = [];
    const local = inscricao.local;

    // Funções auxiliares para adicionar IDs
    const addId = (id) => { if (id) eventIdsToDelete.push(id); };
    const addJsonIds = (json) => {
      try {
        JSON.parse(json).forEach(e => addId(e.eventId));
      } catch (e) { /* ignore */ }
    };

    addId(inscricao.ensaio_eventId);
    addId(inscricao.montagem_eventId);
    addId(inscricao.desmontagem_eventId);
    addJsonIds(inscricao.eventos_json);

    if (eventIdsToDelete.length > 0 && calendarIds[local]) {
      console.log(`🗑️ Tentando deletar ${eventIdsToDelete.length} eventos do Google Calendar para a inscrição #${id}`);
      for (const eventId of eventIdsToDelete) {
        try {
          await calendar.events.delete({ calendarId: calendarIds[local], eventId });
          console.log(`   ✅ Evento ${eventId} deletado.`);
        } catch (err) {
          console.error(`   ❌ Falha ao deletar evento ${eventId} no Google Calendar:`, err.message);
          // Adiciona log detalhado para diagnóstico
          if (err.code === 403) {
            console.error(`   ⚠️ ERRO 403: Permissão negada. Verifique se as credenciais têm permissão de escrita/deleção no Google Calendar.`);
          }
          // Continua para o próximo, não impede a exclusão no DB
        }
      }
    }

    // 3. Excluir a inscrição e avaliações relacionadas no PostgreSQL
    // ON DELETE CASCADE na tabela assessments deve cuidar das avaliações
    await query('DELETE FROM inscricoes WHERE id = $1', [id]);
    
    console.log(`✅ Inscrição #${id} excluída com sucesso do banco de dados.`);
    res.json({ success: true, message: "Inscrição excluída com sucesso." });

  } catch (error) {
    console.error("❌ Erro ao excluir inscrição:", error);
    res.status(500).json({ error: "Erro interno ao excluir inscrição." });
  }
});

// --- 18. ROTA PARA OBTER EVENTOS OCUPADOS ---
app.get("/api/occupied-slots/:local/:month", async (req, res) => {
  const { local, month } = req.params;
  if (!calendarIds[local]) {
    return res.status(400).json({ error: "Local não encontrado." });
  }
  try {
    const [year, monthNum] = month.split('-');
    const startDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(monthNum), 0);
    const events = await calendar.events.list({
      calendarId: calendarIds[local],
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      fields: 'items(id,summary,start,end,extendedProperties)' // Otimiza a resposta
    });
    
    // ✅ PROCESSA OS EVENTOS ANTES DE ENVIAR (igual ao server.js antigo)
    const eventosProcessados = (events.data.items || []).map((event) => {
      const props = event.extendedProperties?.private || {};
      const isManaged = props.managedBy === 'sistema-edital-dac';
      const isContestable = isManaged && props.status === 'pending_evaluation';
      
      return {
        id: event.id,
        summary: event.summary,
        // ✅ EXTRAI dateTime ou date com fallback
        start: event.start?.dateTime || (event.start?.date ? `${event.start.date}T00:00:00` : null),
        end: event.end?.dateTime || (event.end?.date ? `${event.end.date}T23:59:59` : null),
        isAllDay: !!event.start?.date && !event.start?.dateTime,
        isContestable: isContestable
      };
    }).filter(e => e.start && e.end); // Remove eventos sem data válida
    
    res.json({ eventos: eventosProcessados });
  } catch (error) {
    console.error(`❌ Erro ao buscar eventos do Google Calendar para ${local}:`, error.message);
    // ✅ Retorna array vazio ao invés de erro 500 para não quebrar o frontend
    console.log("⚠️ Retornando lista vazia de eventos devido a erro na autenticação");
    res.json({ eventos: [] });
  }
});

// --- 19. ROTA PARA SALVAR AVALIAÇÃO ---
app.post("/api/save-assessment", async (req, res) => {
  const { inscriptionId, evaluatorEmail, scoresJson } = req.body;

  if (!inscriptionId || !evaluatorEmail || !scoresJson) {
    return res.status(400).json({ error: "Dados incompletos." });
  }

  try {
    await query(
      `INSERT INTO assessments (inscription_id, evaluator_email, scores_json) 
       VALUES ($1, $2, $3)
       ON CONFLICT (inscription_id, evaluator_email) DO UPDATE SET scores_json = $3`,
      [inscriptionId, evaluatorEmail, JSON.stringify(scoresJson)]
    );

    res.json({ success: true, message: "Avaliação salva com sucesso." });
  } catch (error) {
    console.error("Erro ao salvar avaliação:", error);
    res.status(500).json({ error: "Erro ao salvar avaliação." });
  }
});

// --- 20. ROTA PARA OBTER AVALIAÇÕES DE UMA INSCRIÇÃO ---
app.get("/api/assessments/:inscriptionId", async (req, res) => {
  const { inscriptionId } = req.params;

  try {
    const result = await query("SELECT * FROM assessments WHERE inscription_id = $1", [inscriptionId]);
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao obter avaliações:", error);
    res.status(500).json({ error: "Erro ao obter avaliações." });
  }
});

// --- 21. FUNÇÃO DE ENVIO DE E-MAIL DE CONFIRMAÇÃO (ETAPA 1) ---
async function sendStep1ConfirmationEmail(userData, evento_nome, local, etapas) {
  const { email, name, telefone } = userData;
  const nome = name;

  const locaisNomes = {
    teatro: "Teatro Carmen Fossari",
    igrejinha: "Igrejinha da UFSC",
  };

  const etapasHtml = etapas.map(etapa => {
    // Forçamos a interpretação da string ISO sem o "Z" como horário local, adicionando o offset se necessário,
    // ou simplesmente tratando a string de data que vem do frontend (YYYY-MM-DDTHH:mm:ss)
    // Para garantir pt-BR e America/Sao_Paulo:
    const dInicio = new Date(etapa.inicio.includes('Z') ? etapa.inicio : etapa.inicio + '-03:00');
    const dFim = new Date(etapa.fim.includes('Z') ? etapa.fim : etapa.fim + '-03:00');
    
    const dataFormatada = dInicio.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const horaInicio = dInicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
    const horaFim = dFim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
    return `<li><strong>${etapa.nome.charAt(0).toUpperCase() + etapa.nome.slice(1)}:</strong> ${dataFormatada}, das ${horaInicio} às ${horaFim}</li>`;
  }).join('');

  // O HTML do e-mail é o mesmo para todos os métodos
  const htmlContent = `
		      <div style="font-family: sans-serif; line-height: 1.6;">
		        <h2>Olá, ${nome}!</h2>
		        <p>A primeira etapa da sua solicitação de agendamento para o evento <strong>"${evento_nome}"</strong> foi recebida com sucesso.</p>
		        
		        <h3>Detalhes da Inscrição (Etapa 1):</h3>
		        <ul>
		          <li><strong>Nome do Proponente:</strong> ${nome}</li>
		          <li><strong>E-mail:</strong> ${email}</li>
		          ${telefone ? `<li><strong>Telefone:</strong> ${telefone}</li>` : ''}
		          <li><strong>Local Solicitado:</strong> ${locaisNomes[local] || local}</li>
		        </ul>
		        <ul>
		          ${etapasHtml}
		        </ul>    <p><strong>Atenção:</strong> Este é um e-mail de confirmação da sua solicitação. Os horários ainda estão em análise e podem ser contestados por outras propostas. O agendamento só será definitivo após a consolidação da agenda do edital.</p>
	        <p>O próximo passo é preencher o formulário de inscrição detalhada. Se a aba não abriu automaticamente, acesse o link que foi disponibilizado na página de agendamento.</p>
	        <p>Atenciosamente,<br>Sistema de Agendamento DAC</p>
		      </div>
		    `;
  
  const subject = `✅ Confirmação da 1ª Etapa: ${evento_nome}`;
  const remetente = process.env.EMAIL_REMETENTE_VALIDADO || 'noreply@agendamento.site';
  const adminEmail = 'pautas.dac@contato.ufsc.br';
  
  console.log(`✅ Tentando enviar e-mail de confirmação da Etapa 1 para: ${email} (com cópia para ${adminEmail})`);

  // --- 1. Tenta Brevo API (Prioridade) ---
  if (brevoApiKey) {
    try {
      const payload = {
        sender: { email: remetente, name: "Sistema de Agendamento DAC" },
        replyTo: { email: remetente, name: "Sistema de Agendamento DAC" },
        to: [
          { email: email, name: nome },
          { email: adminEmail, name: "Administrador DAC" }
        ],
        subject: subject,
        htmlContent: htmlContent
      };
      
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': brevoApiKey
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`HTTP ${response.status}: ${JSON.stringify(error)}`);
      }
      
      const data = await response.json();
      console.log(`✅✅✅ E-mail enviado com sucesso via Brevo API REST! ID: ${data.messageId}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Erro ao enviar e-mail via Brevo API REST para ${email}:`, error.message);
      // Continua para o fallback
    }
  }

  // --- 2. Tenta Resend (Fallback 1) ---
  if (resend) {
    try {
      const { data, error } = await resend.emails.send({
        from: `"Sistema de Agendamento DAC" <${remetente}>`,
        to: [email, adminEmail],
        subject: subject,
        html: htmlContent,
      });

      if (error) {
        console.error(`❌ Erro ao enviar e-mail via Resend para ${email}:`, error);
        // Continua para o fallback do Nodemailer
      } else {
        console.log(`✅✅✅ E-mail enviado com sucesso via Resend! ID: ${data.id}`);
        return true;
      }
    } catch (error) {
      console.error(`❌ Erro ao enviar e-mail via Resend (catch) para ${email}:`, error.message);
      // Continua para o fallback do Nodemailer
    }
  }

  // --- 3. Tenta Nodemailer (Fallback 2) ---
  if (transporter) {
    try {
      const mailOptions = {
        from: `"Sistema de Agendamento DAC" <${remetente}>`,
        to: [email, adminEmail],
        subject: subject,
        html: htmlContent,
      };
      
      await transporter.sendMail(mailOptions);
      const smtpService = process.env.EMAIL_USER ? 'Gmail SMTP' : 'SMTP Genérico';
      console.log(`✅✅✅ E-mail enviado com sucesso via Nodemailer (${smtpService})!`);
      return true;
    } catch (error) {
      console.error(`❌ Erro ao enviar e-mail via Nodemailer para ${email}:`, error.message);
      return false;
    }
  }

  // --- 4. Falha Total ---
  console.error('❌ Erro: Nenhum serviço de e-mail configurado ou funcional. O envio de e-mail falhou.');
  return false;
}

// --- 21.5 ROTA TEMPORÁRIA PARA DISPARO DE RETIFICAÇÃO ---
app.get("/api/disparar-retificacao-fuso", async (req, res) => {
  const { senha, testOnly } = req.query;
  const SENHA_SEGURANCA = "ufsc_dac_2026_retificar"; // Senha simples para evitar disparos acidentais
  
  if (senha !== SENHA_SEGURANCA) {
    return res.status(403).send("Acesso negado. Senha incorreta.");
  }

  try {
    // Buscar inscrições afetadas (antes de 13/03/2026)
    const result = await query("SELECT * FROM inscricoes WHERE criado_em < '2026-03-13' ORDER BY id ASC");
    const inscricoes = result.rows;
    
    console.log(`🚀 Iniciando disparo de retificação para ${inscricoes.length} inscrições.`);
    
    let enviados = 0;
    let erros = 0;

    for (const ins of inscricoes) {
      // Se testOnly estiver ativo, envia apenas para o admin (ou e-mail de teste)
      const destinatario = testOnly === 'true' ? 'cristianomariano.ufsc@gmail.com' : ins.email;
      
      // Montar lista de etapas
      const etapas = [];
      if (ins.ensaio_inicio) etapas.push({ nome: 'Ensaio', inicio: ins.ensaio_inicio, fim: ins.ensaio_fim });
      if (ins.montagem_inicio) etapas.push({ nome: 'Montagem', inicio: ins.montagem_inicio, fim: ins.montagem_fim });
      if (ins.desmontagem_inicio) etapas.push({ nome: 'Desmontagem', inicio: ins.desmontagem_inicio, fim: ins.desmontagem_fim });
      if (ins.eventos_json) {
        try {
          const evs = JSON.parse(ins.eventos_json);
          evs.forEach((ev, i) => etapas.push({ nome: `Evento ${i+1}`, inicio: ev.inicio, fim: ev.fim }));
        } catch(e) {}
      }

      // Formatar HTML das etapas (Consolidado)
      const etapasHtml = etapas.map(etapa => {
        const dInicio = new Date(etapa.inicio.includes('Z') ? etapa.inicio : etapa.inicio + '-03:00');
        const dFim = new Date(etapa.fim.includes('Z') ? etapa.fim : etapa.fim + '-03:00');
        const dataFormatada = dInicio.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        const horaInicio = dInicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
        const horaFim = dFim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
        return `<li><strong>${etapa.nome}:</strong> ${dataFormatada}, das ${horaInicio} às ${horaFim}</li>`;
      }).join('');

      const subject = `RETIFICAÇÃO: Confirmação de Horários - Inscrição #${ins.id}`;
      const htmlContent = `
        <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
          <h2 style="color: #003366;">Olá, ${ins.nome}!</h2>
          <p>Estamos entrando em contato para realizar uma <strong>retificação importante</strong> nos horários do seu agendamento para o evento "<strong>${ins.evento_nome}</strong>".</p>
          <p>Devido a um ajuste técnico no fuso horário do nosso sistema, os horários enviados anteriormente apresentavam uma diferença de 3 horas. Os horários <strong>corretos e oficiais</strong> registrados são:</p>
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; border-left: 5px solid #003366; margin: 20px 0;">
            <ul style="list-style: none; padding: 0; margin: 0;">
              ${etapasHtml}
            </ul>
          </div>
          <p>Pedimos desculpas pelo transtorno. Seus horários já estão garantidos conforme a lista acima.</p>
          <p>Atenciosamente,<br><strong>Equipe de Agendamento DAC/UFSC</strong></p>
        </div>
      `;

      // Reutiliza a lógica de envio do sistema
      // Mockamos userData para a função existente ou chamamos a lógica de envio diretamente
      // Para garantir o envio consolidado, chamamos a lógica de e-mail aqui
      const sucesso = await (async () => {
        const brevoApiKey = process.env.BREVO_API_KEY;
        const remetente = process.env.EMAIL_REMETENTE_VALIDADO || 'pautas.dac@contato.ufsc.br';
        
        if (brevoApiKey) {
          try {
            const payload = {
              sender: { email: remetente, name: "Sistema de Agendamento DAC" },
              to: [{ email: destinatario, name: ins.nome }],
              subject: subject,
              htmlContent: htmlContent
            };
            const response = await fetch('https://api.brevo.com/v3/smtp/email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'api-key': brevoApiKey },
              body: JSON.stringify(payload)
            });
            return response.ok;
          } catch (e) { return false; }
        }
        return false;
      })();

      if (sucesso) enviados++; else erros++;
      
      // Se for apenas teste, para no primeiro
      if (testOnly === 'true') break;
    }

    res.json({ 
      message: testOnly === 'true' ? "Teste enviado com sucesso!" : "Disparo concluído!",
      total_processado: testOnly === 'true' ? 1 : inscricoes.length,
      sucesso: enviados,
      erros: erros
    });

  } catch (error) {
    console.error("Erro no disparo de retificação:", error);
    res.status(500).send("Erro interno ao processar disparo.");
  }
});

// --- 22. ROTA PARA VISUALIZAR SLIDES ---
app.get("/api/slides-viewer", async (req, res) => {
  try {
    const analysisData = await (async () => {
      const criteria = await getEvaluationCriteria();
      const inscriptionsResult = await query("SELECT * FROM inscricoes ORDER BY criado_em DESC");
      const inscriptions = inscriptionsResult.rows;
      const assessmentsResult = await query("SELECT * FROM assessments");
      const allAssessments = assessmentsResult.rows;
      const totalEvaluatorsResult = await query('SELECT COUNT(*) as count FROM evaluators');
      const totalEvaluators = totalEvaluatorsResult.rows[0].count;

      const inscriptionsWithScores = inscriptions.map(inscription => {
      let finalScore = null;
      const relatedAssessments = allAssessments.filter(a => a.inscription_id === inscription.id);

        
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
            let totalWeight = 0;

            criteria.forEach(crit => {
              const scoreValue = scores[crit.id] || 0;
              const weightValue = crit.weight || 1;
              singleEvaluationScore += scoreValue * weightValue;
              totalWeight += weightValue;
            });

            const weightedAverage = totalWeight > 0 ? singleEvaluationScore / totalWeight : 0;
            totalScoreSum += weightedAverage;
          });

          finalScore = totalScoreSum / assessmentsForScore.length;
        }

        const hasConflict = inscription.hasConflict === 1;

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

      return {
        inscriptions: inscriptionsWithScores,
        criteria: criteria,
        totalEvaluators: totalEvaluators,
      };
    })();

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Visualizador de Slides - Análise do Edital</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Montserrat', sans-serif; background: #f5f5f5; }
        .viewer-container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .controls { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; gap: 10px; }
        .controls button { padding: 10px 20px; background: #003366; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; }
        .controls button:hover { background: #004d99; }
        #slide-counter { font-weight: bold; color: #003366; }
        .slide-frame { width: 100%; height: 600px; background: white; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
        .slide-info { padding: 20px; background: #f9f9f9; border-bottom: 1px solid #ddd; }
        .slide-info h2 { color: #003366; margin-bottom: 10px; }
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

// --- 23. ROTA PARA SERVIR OS ARQUIVOS HTML DOS SLIDES ---
app.use("/slides-content", express.static("slides-edital-ufsc"));


// --- ROTAS DE CONFIGURAÇÃO REMOVIDAS (DUPLICADAS) ---
// As rotas oficiais estão definidas anteriormente nas linhas 472 (GET) e 645 (POST).
// --- 24. ROTA PARA GERAR TERMO DE AUTORIZAÇÃO (MALA DIRETA) ---
app.get("/api/gerar-termo/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM inscricoes WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).send('Inscrição não encontrada');
    const inscricao = result.rows[0];

    // Buscar dados do Forms (Etapa 2) para preencher o termo
    let respostaForms = null;
    try {
      const configResult = await query('SELECT config_json FROM config WHERE id = 1');
      let sheetId = null;
      const FIXED_SHEET_LINK = "https://docs.google.com/spreadsheets/d/1DSMc1jGYJmK01wxKjAC83SWXQxcoxPUUjRyTdloxWt8/edit?resourcekey=&gid=913092206#gid=913092206";
      if (configResult.rows.length > 0) {
        const config = JSON.parse(configResult.rows[0].config_json);
        sheetId = config.sheetId || FIXED_SHEET_LINK.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
      }
      if (sheetId && sheets) {
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        const sheetTitles = spreadsheet.data.sheets.map(s => s.properties.title);
        let allRecords = [];
        for (const title of sheetTitles) {
          const response = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${title}!A:Z` });
          const rows = response.data.values;
          if (rows && rows.length > 1) {
            const headers = rows[0];
            allRecords = allRecords.concat(rows.slice(1).map(row => {
              const obj = {};
              headers.forEach((h, i) => { obj[h] = row[i] || ''; });
              return obj;
            }));
          }
        }
        respostaForms = allRecords.find(f => {
          const emailKey = Object.keys(f).find(k => k.toLowerCase().includes("mail"));
          const emailForms = emailKey ? f[emailKey].trim().toLowerCase() : null;
          return emailForms === inscricao.email.trim().toLowerCase();
        });
      }
    } catch (e) { console.error("Erro ao buscar dados para o termo:", e.message); }

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on("data", chunk => chunks.push(chunk));
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(chunks);
      const safeName = (inscricao.evento_nome || 'evento').normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "_");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="termo-${id}-${safeName}.pdf"`);
      res.send(pdfBuffer);
    });

    // --- CONSTRUÇÃO DO DOCUMENTO (Baseado no modelo enviado) ---
    const centerText = (t, s = 12, b = false) => {
      doc.font(b ? 'Helvetica-Bold' : 'Helvetica').fontSize(s).text(t, { align: 'center' });
    };

    centerText("SERVIÇO PÚBLICO FEDERAL MINISTÉRIO DA EDUCAÇÃO", 11);
    centerText("UNIVERSIDADE FEDERAL DE SANTA CATARINA SECRETARIA DE CULTURA, ARTE E ESPORTE Departamento Artístico Cultural", 11, true);
    centerText("Praça Santos Dumont - Rua Desembargador Vitor Lima, 117 - Trindade CEP 88040-400 Florianópolis - SC - Brasil", 9);
    doc.moveDown(2);

    centerText("TERMO DE AUTORIZAÇÃO PARA OCUPAÇÃO DOS ESPAÇOS DO DEPARTAMENTO ARTÍSTICO CULTURAL", 12, true);
    centerText(`*Este documento é parte integrante do Edital Mais Arte - Nº 002/2026/DAC/SeCArtE`, 10);
    doc.moveDown(2);

    doc.font('Helvetica-Bold').fontSize(12).text("I – PREÂMBULO");
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(11).text("1. Espaço físico objeto desta autorização:");
    doc.moveDown(0.5);
    const isTeatro = (inscricao.local || "").toLowerCase() === 'teatro';
    const isIgrejinha = (inscricao.local || "").toLowerCase() === 'igrejinha';
    doc.text(`${isTeatro ? '[X]' : '[  ]'} Teatro Carmen Fossari`);
    doc.text(`${isIgrejinha ? '[X]' : '[  ]'} Igrejinha da UFSC`);
    doc.moveDown(1);

    doc.font('Helvetica').text("2. Evento a ser realizado no espaço físico objeto desta autorização:");
    doc.font('Helvetica-Bold').fillColor('blue').text(`   ${inscricao.evento_nome || "N/A"}`).fillColor('black');
    doc.moveDown(1);

    doc.font('Helvetica').text("3. Data e horário de realização do evento, conforme informado na inscrição:");
    doc.font('Helvetica-Bold').fillColor('blue');
    const formatDT = (i, f, r) => {
      if (!i || !f) return;
      const dI = new Date(i.includes('Z') ? i : i + '-03:00');
      const dF = new Date(f.includes('Z') ? f : f + '-03:00');
      const data = dI.toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' });
      const hI = dI.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: 'America/Sao_Paulo' });
      const hF = dF.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: 'America/Sao_Paulo' });
      doc.text(`   • ${r}: ${data}, das ${hI} às ${hF}`);
    };
    formatDT(inscricao.montagem_inicio, inscricao.montagem_fim, "Montagem");
    formatDT(inscricao.ensaio_inicio, inscricao.ensaio_fim, "Ensaio");
    if (inscricao.eventos_json) {
      try { JSON.parse(inscricao.eventos_json).forEach((ev, i) => formatDT(ev.inicio, ev.fim, `Evento ${i+1}`)); } catch(e){}
    }
    formatDT(inscricao.desmontagem_inicio, inscricao.desmontagem_fim, "Desmontagem");
    doc.fillColor('black').moveDown(2);

    doc.font('Helvetica-Bold').text("II - PARTES ENVOLVIDAS:");
    doc.moveDown(0.5);
    
    // Mapeamento de campos do Forms para o Termo
    const findF = (q) => {
      if (!respostaForms) return "____________________";
      // Normaliza a busca para ser mais flexível
      const search = normalizeKey(q);
      const key = Object.keys(respostaForms).find(k => {
        const n = normalizeKey(k);
        return n.includes(search);
      });
      return key ? respostaForms[key] : "____________________";
    };

    const nomeProp = inscricao.nome || findF("nome");
    
    // ✅ BUSCA ROBUSTA PARA CPF/CNPJ (Validada com Teste Interno)
    let docProp = "____________________";
    if (respostaForms) {
      // 1. Tenta encontrar por nome de chave (CPF ou CNPJ)
      const cpfKey = Object.keys(respostaForms).find(k => {
        const n = normalizeKey(k);
        return (n.includes('cpf') || n.includes('cnpj')) && !n.includes('arquivo') && !n.includes('anexo');
      });
      
      if (cpfKey && respostaForms[cpfKey] && String(respostaForms[cpfKey]).trim() !== "") {
        const val = String(respostaForms[cpfKey]).trim();
        // Evita pegar data/hora se o nome da chave for genérico
        if (!val.includes(':') || val.replace(/\D/g, "").length >= 11) {
           docProp = val;
        }
      }

      // 2. Se não achou por nome, tenta por conteúdo (procura algo que pareça um CPF/CNPJ: 11 ou 14 dígitos)
      // MAS ignora campos que claramente são data/hora ou telefone
      if (docProp === "____________________") {
        const possibleDocKey = Object.keys(respostaForms).find(k => {
          const valRaw = String(respostaForms[k] || "");
          const valClean = valRaw.replace(/\D/g, "");
          const isDocLength = valClean.length === 11 || valClean.length === 14;
          const isNotDateTime = !valRaw.includes(':');
          const isNotPhone = !normalizeKey(k).includes('fone') && !normalizeKey(k).includes('tel');
          return isDocLength && isNotDateTime && isNotPhone;
        });
        if (possibleDocKey) docProp = respostaForms[possibleDocKey];
      }
    }
    
    // 3. Fallback final se ainda estiver vazio
    if (!docProp || docProp === "____________________") {
      const fallback = findF("cpf") || findF("cnpj") || findF("documento");
      if (fallback && fallback !== "____________________") docProp = fallback;
    }
    const rgProp = findF("rg") || "____________________";
    const orgProp = findF("expedida") || findF("orgao") || "____________________";
    const ruaProp = findF("rua") || findF("endereco") || "____________________";
    const numProp = findF("numero") || "____";
    const bairroProp = findF("bairro") || "____________________";
    const cidadeProp = findF("cidade") || "Florianópolis";
    const telProp = inscricao.telefone || findF("telefone") || "____________________";

    doc.font('Helvetica').fontSize(11).text(`Termo de autorização de uso do espaço cultural acima especificado, que entre si celebram, de um lado, a UNIVERSIDADE FEDERAL DE SANTA CATARINA, inscrita no CNPJ sob o nº 83.899.526/0001-82, doravante denominada AUTORIZADORA, e de outro lado `, { continued: true });
    doc.font('Helvetica-Bold').fillColor('blue').text(nomeProp, { continued: true });
    doc.font('Helvetica').fillColor('black').text(`, portador(a) do CPF/CNPJ sob o nº `, { continued: true });
    doc.font('Helvetica-Bold').fillColor('blue').text(docProp, { continued: true });
    doc.font('Helvetica').fillColor('black').text(`, RG nº `, { continued: true });
    doc.font('Helvetica-Bold').fillColor('blue').text(rgProp, { continued: true });
    doc.font('Helvetica').fillColor('black').text(`, expedida pela `, { continued: true });
    doc.font('Helvetica-Bold').fillColor('blue').text(orgProp, { continued: true });
    doc.font('Helvetica').fillColor('black').text(`, residente à rua `, { continued: true });
    doc.font('Helvetica-Bold').fillColor('blue').text(ruaProp, { continued: true });
    doc.font('Helvetica').fillColor('black').text(`, nº `, { continued: true });
    doc.font('Helvetica-Bold').fillColor('blue').text(numProp, { continued: true });
    doc.font('Helvetica').fillColor('black').text(`, bairro `, { continued: true });
    doc.font('Helvetica-Bold').fillColor('blue').text(bairroProp, { continued: true });
    doc.font('Helvetica').fillColor('black').text(`, Telefone `, { continued: true });
    doc.font('Helvetica-Bold').fillColor('blue').text(telProp, { continued: true });
    doc.font('Helvetica').fillColor('black').text(`, na cidade `, { continued: true });
    doc.font('Helvetica-Bold').fillColor('blue').text(cidadeProp, { continued: true });
    doc.font('Helvetica').fillColor('black').text(`, doravante denominado(a) AUTORIZADO(A), mediante as cláusulas pactuadas.`);
    
    doc.moveDown(2);
    doc.font('Helvetica-Bold').text("III - CLÁUSULAS PACTUADAS ENTRE AS PARTES ENVOLVIDAS:");
    doc.moveDown(1);

    const addClausula = (titulo, texto, paragrafo = null) => {
      doc.font('Helvetica-Bold').fontSize(11).text(titulo);
      doc.font('Helvetica').fontSize(10).text(texto, { align: 'justify' });
      if (paragrafo) {
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').text(paragrafo.split('.')[0] + '.', { continued: true });
        doc.font('Helvetica').text(paragrafo.substring(paragrafo.indexOf('.') + 1), { align: 'justify' });
      }
      doc.moveDown(1);
    };

    addClausula("CLÁUSULA PRIMEIRA – DO OBJETO E DO PRAZO DA AUTORIZAÇÃO", 
      "O objeto deste termo é a autorização de uso de dependências específicas de espaço cultural da AUTORIZADORA pelo(a) AUTORIZADO(A) para fim exclusivo de realização de evento, na forma especificada no preâmbulo acima, observado o calendário prioritário previamente estipulado pela Universidade Federal de Santa Catarina, por meio de Edital Público.",
      "Parágrafo único. Excluem-se, expressamente, da autorização ora ajustada, quaisquer outras áreas e/ou dependências que não a referida no preâmbulo desta autorização.");

    addClausula("CLÁUSULA SEGUNDA – DA TAXA DE UTILIZAÇÃO", 
      "Nos casos de locação do espaço para eventos particulares e/ou não gratuitos, a AUTORIZADORA cobrará as taxas referentes à utilização do espaço cultural objeto desta autorização, conforme valores definidos em Portaria editada pela Secretaria de Cultura, nos termos da legislação vigente à época da autorização.",
      "Parágrafo primeiro. Havendo cancelamento de apresentação do evento objeto deste termo, por qualquer motivo que seja, a taxa de locação paga pelo(a) AUTORIZADO(A) à AUTORIZADORA não será devolvida, podendo o (a) AUTORIZADO(A) reagendar a data para outra disponível no calendário anexo ao Edital vigente.");

    addClausula("CLÁUSULA TERCEIRA – DOS INGRESSOS E DOS VALORES FIXADOS", 
      "A comercialização dos ingressos do espetáculo é de total responsabilidade do AUTORIZADO(A), inclusive no que tange às regras de comercialização total ou meia entrada.");

    addClausula("CLÁUSULA QUARTA – DAS OBRIGAÇÕES E DOS DIREITOS DA AUTORIZADORA", 
      "A AUTORIZADORA, além de outras condições previstas em normas específicas, compromete-se a autorizar o uso das dependências e equipamentos do espaço cultural objeto deste termo o(à) AUTORIZADO(A), o qual será liberado para montagem no(s) dia(s) do(s) evento(s), a partir das (8) oito horas.");

    // Adicionar quebra de página se necessário para as assinaturas
    if (doc.y > 600) doc.addPage();

    addClausula("CLÁUSULA NONA, DO FORO", 
      "Fica eleito o foro da Comarca de Florianópolis, Capital do Estado de Santa Catarina, para dirimir eventuais dúvidas oriundas da aplicação deste Termo, com renúncia de qualquer outro, por mais privilegiado que seja.");

    doc.moveDown(1);
    doc.font('Helvetica').fontSize(10).text("E, por estarem justos e concordados, assinam o presente instrumento em 02 (duas) vias de igual teor e forma, para um só efeito.");
    doc.moveDown(2);

    const hoje = new Date().toLocaleDateString("pt-BR", { day: '2-digit', month: 'long', year: 'numeric' });
    doc.text(`Florianópolis (SC), ${hoje}.`, { align: 'center' });
    doc.moveDown(4);

    const startY = doc.y;
    doc.text("__________________________________________", 50, startY, { width: 230, align: 'center' });
    doc.text("__________________________________________", 310, startY, { width: 230, align: 'center' });
    
    doc.font('Helvetica-Bold').text("AUTORIZADORA", 50, startY + 15, { width: 230, align: 'center' });
    doc.text("AUTORIZADO (A)", 310, startY + 15, { width: 230, align: 'center' });
    
    doc.font('Helvetica').fontSize(9).text(`CPF/CNPJ: ${docProp}`, 310, startY + 30, { width: 230, align: 'center' });

    doc.end();
  } catch (error) {
    console.error("Erro ao gerar termo:", error);
    res.status(500).send("Erro ao gerar termo");
  }
});

app.get("/api/gerar-pdf/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. Buscar inscrição no banco
    const result = await query('SELECT * FROM inscricoes WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).send('Inscrição não encontrada');
    }
    
    const inscricao = result.rows[0];
    
    // 2. Buscar dados do Google Sheets
    let respostaForms = null;
    try {
      // ✅ LER CONFIG DO BANCO DE DADOS
      const configResult = await query('SELECT config_json FROM config WHERE id = 1');
      let sheetId = null;
      const FIXED_SHEET_LINK = "https://docs.google.com/spreadsheets/d/1DSMc1jGYJmK01wxKjAC83SWXQxcoxPUUjRyTdloxWt8/edit?resourcekey=&gid=913092206#gid=913092206";
      
      if (configResult.rows.length > 0) {
        const config = JSON.parse(configResult.rows[0].config_json);
        sheetId = config.sheetId;
        if ((config.useFixedLinks || !sheetId)) {
          const match = FIXED_SHEET_LINK.match(/\/d\/([a-zA-Z0-9-_]+)/);
          sheetId = match ? match[1] : sheetId;
        }
      } else {
        const match = FIXED_SHEET_LINK.match(/\/d\/([a-zA-Z0-9-_]+)/);
        sheetId = match ? match[1] : null;
      }
      
      console.log(`[PDF] SheetId final para busca:`, sheetId);

      if (sheetId && sheets) {
        // ✅ BUSCAR TODAS AS ABAS PARA GARANTIR QUE ENCONTRAMOS OS DADOS RECENTES
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        const sheetTitles = spreadsheet.data.sheets.map(s => s.properties.title);
        
        let allRecords = [];
        for (const title of sheetTitles) {
          try {
            const response = await sheets.spreadsheets.values.get({
              spreadsheetId: sheetId,
              range: `${title}!A:Z`
            });
            const rows = response.data.values;
            if (rows && rows.length > 1) {
              const headers = rows[0];
              const sheetRecords = rows.slice(1).map(row => {
                const obj = {};
                headers.forEach((header, i) => { obj[header] = row[i] || ''; });
                return obj;
              });
              allRecords = allRecords.concat(sheetRecords);
            }
          } catch (sheetErr) {
            console.warn(`[PDF] Erro ao ler aba "${title}":`, sheetErr.message);
          }
        }
        
        if (allRecords.length > 0) {
          console.log(`[PDF] Total de registros encontrados em todas as abas: ${allRecords.length}`);
          
          // Encontrar linha correspondente
          respostaForms = allRecords.find(f => {
            let emailKey = Object.keys(f).find(k => k.toLowerCase().includes("mail"));
            if (!emailKey) {
              emailKey = Object.keys(f).find(k => {
                const value = (f[k] || "").trim();
                return value.includes("@") && value.includes(".");
              });
            }
            
            const telKey = Object.keys(f).find(k => k.toLowerCase().includes("fone") || k.toLowerCase().includes("telefone"));
            const emailForms = emailKey ? (f[emailKey] || "").trim().toLowerCase() : null;
            const telForms = telKey ? (f[telKey] || "").replace(/\D/g, "").replace(/^(55)/, "") : null;
            const emailEtapa1 = (inscricao.email || "").trim().toLowerCase();
            const telEtapa1 = (inscricao.telefone || "").replace(/\D/g, "").replace(/^(55)/, "");
            
            // Lógica de telefone flexível (aceita com ou sem o 9 extra)
            const checkTelMatch = (t1, t2) => {
              if (!t1 || !t2) return false;
              if (t1 === t2) return true;
              const clean1 = t1.length > 10 ? t1.slice(0, 2) + t1.slice(3) : t1;
              const clean2 = t2.length > 10 ? t2.slice(0, 2) + t2.slice(3) : t2;
              return clean1 === clean2;
            };

            return (emailForms && emailEtapa1 && emailForms === emailEtapa1) || 
                   checkTelMatch(telEtapa1, telForms);
          });
          
          console.log(`[PDF] Resposta encontrada:`, respostaForms ? 'SIM' : 'NÃO');
        }
      }
    } catch (e) {
      console.error("[PDF] ERRO ao buscar dados do Forms:", e.message);
    }
    
    // 3. Gerar PDF
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on("data", chunk => chunks.push(chunk));
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(chunks);
      // Limpar o nome do arquivo para evitar caracteres inválidos no cabeçalho HTTP
      const safeEventName = (inscricao.evento_nome || 'evento')
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/[^a-zA-Z0-9]/g, "_"); // Substitui qualquer caractere não alfanumérico por _
      
      const filename = `inscricao-${id}-${safeEventName}.pdf`;
      
      try {
        res.setHeader("Content-Type", "application/pdf");
        // Usar encodeURIComponent para o filename no Content-Disposition (padrão RFC 5987)
        res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(filename)}"`); 
        res.send(pdfBuffer);
      } catch (headerError) {
        console.error("❌ Erro ao definir cabeçalhos do PDF:", headerError);
        if (!res.headersSent) {
          res.status(500).send("Erro ao gerar o cabeçalho do PDF.");
        }
      }

      // NOVO: Enviar o PDF por e-mail
      const emailDestino = respostaForms ? (respostaForms[Object.keys(respostaForms).find(k => k.toLowerCase().includes("mail"))] || inscricao.email) : inscricao.email;
      if (emailDestino) {
        sendPdfByEmail(emailDestino, filename, pdfBuffer, inscricao);
      }
    });
    
    // Título
    doc.fontSize(18).font('Helvetica-Bold').text("Formulário de Inscrição", { align: "center" });
    doc.fontSize(12).font('Helvetica').text(`Inscrição #${inscricao.id}`, { align: "center" }).moveDown(2);
    
    // Dados da 1ª Etapa
    doc.font('Helvetica-Bold').fontSize(14).text("1. DADOS DO PROPONENTE (Etapa 1)");
    doc.font('Helvetica').fontSize(10)
      .text(`Nome: ${inscricao.nome || "N/A"}`)
      .text(`Email: ${inscricao.email || "N/A"}`)
      .text(`Telefone: ${inscricao.telefone || "N/A"}`)
      .text(`Nome do Evento: ${inscricao.evento_nome || "N/A"}`)
      .text(`Local: ${inscricao.local || "N/A"}`).moveDown(1.5);

    // Horários
    doc.font('Helvetica-Bold').fontSize(14).text("2. AGENDAMENTOS REALIZADOS");
    const linhaEtapa = (rotulo, inicio, fim) => {
      if (!inicio || !fim) return;
      // Garantir interpretação correta do fuso horário de Brasília (UTC-3)
      const dInicio = new Date(inicio.includes('Z') ? inicio : inicio + '-03:00');
      const dFim = new Date(fim.includes('Z') ? fim : fim + '-03:00');
      
      const data = dInicio.toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' });
      const hIni = dInicio.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: 'America/Sao_Paulo' });
      const hFim = dFim.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: 'America/Sao_Paulo' });
      doc.font('Helvetica').fontSize(10).text(`• ${rotulo}: ${data}, das ${hIni} às ${hFim}`);
    };
    linhaEtapa("Ensaio", inscricao.ensaio_inicio, inscricao.ensaio_fim);
    if (inscricao.eventos_json && inscricao.eventos_json !== '[]') {
      JSON.parse(inscricao.eventos_json).forEach((ev, i) => linhaEtapa(`Evento ${i + 1}`, ev.inicio, ev.fim));
    }
    linhaEtapa("Montagem", inscricao.montagem_inicio, inscricao.montagem_fim);
    linhaEtapa("Desmontagem", inscricao.desmontagem_inicio, inscricao.desmontagem_fim);
    doc.moveDown(1.5);

    // Dados da 2ª Etapa (do Google Sheets) - SEMPRE MOSTRAR
    doc.font('Helvetica-Bold').fontSize(14).text("3. DETALHAMENTO DO EVENTO (Etapa 2)");
    
    if (respostaForms) {
      doc.font('Helvetica').fontSize(10);

      // --- NOVA SEÇÃO: ARQUIVOS (Links do Drive) ---
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').text("ARQUIVOS:", { underline: true });
      
      let hasFiles = false;
      for (const [key, value] of Object.entries(respostaForms)) {
        if (typeof value === 'string' && value.includes('drive.google.com')) {
          hasFiles = true;
          const urls = value.split(', ');
          urls.forEach((url, idx) => {
            doc.font('Helvetica-Bold').text(`  • ${key}${urls.length > 1 ? ` (${idx + 1})` : ''}: `, { continued: true })
               .font('Helvetica').fillColor('blue').text("VER ARQUIVO", { link: url.trim(), underline: true }).fillColor('black');
          });
        }
      }
      
      if (!hasFiles) {
        doc.font('Helvetica-Oblique').text("  Nenhum arquivo anexado.");
      }
      doc.moveDown(1);
      // --------------------------------------------

      // Restante dos dados
      // Determinar se é Pessoa Física ou Jurídica para ocultar campos irrelevantes
      const proponenteTipoKey = Object.keys(respostaForms).find(k => {
        const norm = normalizeKey(k);
        return norm.includes('proponente') && (norm.includes('fisica') || norm.includes('juridica') || norm.includes('tipo'));
      });
      const isPJ = proponenteTipoKey && String(respostaForms[proponenteTipoKey]).toLowerCase().includes('juridica');
      const isPF = proponenteTipoKey && String(respostaForms[proponenteTipoKey]).toLowerCase().includes('fisica');

      for (const [key, value] of Object.entries(respostaForms)) {
        const normKey = normalizeKey(key);
        const valStr = String(value || "").trim();

        // 1. Ignorar campos administrativos ou já exibidos
        if (normKey.includes('carimbodedatahora')) continue;
        if (valStr.includes('drive.google.com')) continue;
        
        // 2. Ocultar campos de PJ se for PF (e vice-versa) para um PDF mais limpo
        if (isPF) {
          if (normKey.includes('razaosocial') || normKey.includes('cnpj') || normKey.includes('contratosocial')) continue;
        }
        if (isPJ) {
          if (normKey.includes('cpf')) continue;
        }

        // 3. Só exibir o campo se ele tiver valor informado
        // Isso remove o "NÃO INFORMADO" de campos que o usuário simplesmente pulou
        if (valStr !== "" && valStr.toLowerCase() !== "não informado") {
          doc.font('Helvetica-Bold').text(`${key}: `, { continued: true })
             .font('Helvetica').text(valStr, { continued: false });
        }
      }
    } else {
      doc.font('Helvetica-Oblique').fontSize(10).text("O proponente ainda não preencheu o formulário da Etapa 2.");
    }
    
    doc.end();
    
  } catch (error) {
    console.error("❌ Erro ao gerar PDF:", error);
    res.status(500).send("Erro ao gerar PDF");
  }
});

// --- 25. ROTA: DOWNLOAD DE ANEXOS EM ZIP (CORRIGIDA) ---
app.get("/api/download-zip/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Buscar inscrição no banco
    const result = await query('SELECT * FROM inscricoes WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).send('Inscrição não encontrada');
    }
    
    const inscricao = result.rows[0];
    
    // Dados da 2ª Etapa (do Google Sheets)
    let respostaForms = null;
    try {
      // ✅ LER CONFIG DO BANCO DE DADOS (não do arquivo)
      const configResult = await query('SELECT config_json FROM config WHERE id = 1');
      let sheetId = null;
      if (configResult.rows.length > 0) {
        const config = JSON.parse(configResult.rows[0].config_json);
        sheetId = config.sheetId;
      }
      console.log(`[ZIP] SheetId do banco:`, sheetId);

      if (sheetId) {
        console.log(`[ZIP] Buscando dados para inscri\u00e7\u00e3o #${id}`);
        console.log(`[ZIP] E-mail: ${inscricao.email}, Telefone: ${inscricao.telefone}`);
        
        // ✅ Usar Sheets API ao invés do Drive API
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: 'A:Z'
        });
        
        const rows = response.data.values;
        if (!rows || rows.length === 0) {
          console.log('[ZIP] Sheet vazio');
          return res.status(404).send("Etapa 2 n\u00e3o preenchida.");
        }
        
        // Primeira linha = cabe\u00e7alhos
        const headers = rows[0];
        // Converter para array de objetos
        const records = rows.slice(1).map(row => {
          const obj = {};
          headers.forEach((header, i) => {
            obj[header] = row[i] || '';
          });
          return obj;
        });
        console.log(`[ZIP] Records found: ${records.length}`);
        if (records.length > 0) {
          console.log(`[ZIP] Columns:`, Object.keys(records[0]));
        }

        respostaForms = records.find(f => {
          // Buscar coluna de email: primeiro tenta por nome, depois por conteúdo com @
          let emailKey = Object.keys(f).find(k => k.toLowerCase().includes("mail"));
          if (!emailKey) {
            // Se não encontrou por nome, procura qualquer coluna que tenha @ (email válido)
            emailKey = Object.keys(f).find(k => {
              const value = (f[k] || "").trim();
              return value.includes("@") && value.includes(".");
            });
          }
          
          const telKey = Object.keys(f).find(k => k.toLowerCase().includes("fone") || k.toLowerCase().includes("telefone"));
          const emailForms = emailKey ? (f[emailKey] || "").trim().toLowerCase() : null;
          const telForms = telKey ? (f[telKey] || "").replace(/\D/g, "").replace(/^55/, "") : null;
          const emailEtapa1 = (inscricao.email || "").trim().toLowerCase();
          const telEtapa1 = (inscricao.telefone || "").replace(/\D/g, "").replace(/^55/, "");
          return (emailForms && emailEtapa1 && emailForms === emailEtapa1) || 
                 (telForms && telEtapa1 && telForms === telEtapa1);
        });
      }
    } catch (e) {
      console.error("Erro ao buscar dados do Forms:", e.message);
    }

    if (!respostaForms) {
      return res.status(404).send("Inscrição não encontrada ou Etapa 2 não preenchida.");
    }

    // 3. Criar ZIP com anexos reais do Google Drive
    const zipFileName = `anexos-inscricao-${id}.zip`;
    res.attachment(zipFileName);
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(res);

    const fileIdRegex = /id=([a-zA-Z0-9_-]+)/;
    const filePromises = [];

    for (const [key, value] of Object.entries(respostaForms)) {
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

// --- 23. SERVIR ARQUIVOS ESTÁTICOS E FALLBACK PARA O REACT ROUTER ---

// Servir arquivos estáticos (CSS, JS, Imagens)
app.use(express.static(path.join(__dirname, '..', 'dist')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));

// --- Rota para geração de PDF ---
app.use('/api', pdfGeneratorRouter);

// Fallback para o React Router: Envia o index.html para qualquer rota não tratada
app.use((req, res) => {
  // Ignora rotas de API para não interferir
  if (req.path.startsWith('/api')) {
    return res.status(404).send('API endpoint not found');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// --- 24. INICIALIZAÇÃO DO SERVIDOR ---
// Inicializa as Google APIs antes de iniciar o servidor
async function startServer() {
  try {
    // Inicializa as Google APIs
    await initializeGoogleAPIs();
    
    // Inicia o servidor Express
    app.listen(port, () => {
      console.log(`🚀 Servidor rodando em http://localhost:${port}`);
      cron.schedule("*/5 * * * *", atualizarCache);
      atualizarCache();
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar o servidor:', error.message);
    process.exit(1);
  }
}

// Chama a função de inicialização
startServer();
