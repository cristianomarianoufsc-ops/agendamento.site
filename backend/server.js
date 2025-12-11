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
import bcrypt from "bcrypt";
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
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: {
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
// ✅ FUNÇÃO AUXILIAR PARA PEGAR O NÚMERO DE AVALIAÇÕES REQUERIDAS
// ===================================================================
function getRequiredAssessments() {
  try {
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf-8"));
    if (config.requiredAssessments) {
      return parseInt(config.requiredAssessments, 10);
    }
  } catch (e) { /* ignora */ }
  return 3; // Valor padrão
}

// --- 2. CONFIGURAÇÃO DO GOOGLE CALENDAR E SHEETS ---
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
    from: process.env.EMAIL_USER || 'seu-email@gmail.com',
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
      <p>Atenciosamente,<br>Sistema de Agendamento UFSC</p>
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

// --- 4. FUNCOES UTILITARIAS ---`}
function normalizeKey(key = "") {
  return key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
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

// --- 6. CONFIGURAÇÃO DO GOOGLE CALENDAR E SHEETS ---
let auth;
let calendar;
let sheets;
let drive;

try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log('🔑 Usando GOOGLE_APPLICATION_CREDENTIALS da variável de ambiente');
    // Se a variável de ambiente contém JSON, faz o parse
    try {
      const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
      console.log('🔑 Service Account:', credentials.client_email);
      auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.readonly'],
      });
    } catch (e) {
      console.log('🔑 Não é JSON, usando como caminho de arquivo');
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
    const credData = JSON.parse(fs.readFileSync('./credentials.json', 'utf8'));
    console.log('🔑 Service Account:', credData.client_email);
    
    // ✅ Usar GoogleAuth com credentials direto
    auth = new google.auth.GoogleAuth({
      credentials: credData,
      scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.readonly'],
    });
  }

  calendar = google.calendar({ version: 'v3', auth });
  sheets = google.sheets({ version: 'v4', auth });
  drive = google.drive({ version: 'v3', auth });
  console.log('✅ Google APIs autenticadas com sucesso!');
} catch (error) {
  console.error('❌ Erro ao inicializar Google APIs:', error.message);
  process.exit(1);
}

// --- 7. CONFIGURAÇÃO DO EXPRESS ---
const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// --- 9. ROTA PARA OBTER CONFIGURAÇÕES ---
app.get("/api/config", async (req, res) => {
  try {
    const defaultConfig = {
      blockedDates: [],
      stageTimes: {
        ensaio: { start: "08:00", end: "21:00" },
        montagem: { start: "08:00", end: "21:00" },
        desmontagem: { start: "08:00", end: "21:00" },
      },
      buttonExternalEditalText: "Edital Externo",
      formsLink: "",
      sheetLink: "",
      sheetId: "",
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
        console.log("✅ Configurações carregadas do banco de dados.");
        return res.json(fullConfig);
      }
    } catch (dbError) {
      console.warn("⚠️ Erro ao buscar configurações do banco:", dbError.message);
    }

    // 2. Fallback: tenta buscar do arquivo local (desenvolvimento)
    if (fs.existsSync("config.json")) {
      const savedConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf-8"));
      const fullConfig = { ...defaultConfig, ...savedConfig };
      console.log("✅ Configurações carregadas do arquivo local (fallback).");
      return res.json(fullConfig);
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
    // 1. Remover todos os avaliadores antigos
    await query('DELETE FROM evaluators');
    
    // 2. Inserir novos avaliadores com a senha unica
    for (const evaluator of evaluators) {
      const name = evaluator.name || evaluator.email;
      await query(
        'INSERT INTO evaluators (email, password_hash) VALUES ($1, $2)',
        [name, sharedPassword]
      );
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Avaliadores salvos com sucesso. Nenhum e-mail foi enviado.' 
    });
  } catch (error) {
    console.error('Erro ao salvar avaliadores:', error);
    res.status(500).json({ error: 'Erro ao salvar avaliadores.' });
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

    // ✅ ALTERAÇÃO CRUCIAL: Sempre recalcula o sheetId se o sheetLink existir
    if (updatedConfig.sheetLink) {
      const match = updatedConfig.sheetLink.match(/\/d\/([a-zA-Z0-9-_]+)/);
      updatedConfig.sheetId = match ? match[1] : ""; // Se não encontrar, define como vazio
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

    const inscriptionsWithScores = inscriptions.map(inscription => {
      const relatedAssessments = allAssessments.filter(a => a.inscription_id === inscription.id);
      let finalScore = null;
      
      let requiredAssessmentsForScore = 3;
      try {
        const config = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf-8"));
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

      // Detectar conflito
      let hasConflict = false;
      const inscriptionSlots = allSlots.filter(s => s.id === inscription.id);
      for (let i = 0; i < allSlots.length; i++) {
        for (let j = i + 1; j < allSlots.length; j++) {
          const slotA = allSlots[i];
          const slotB = allSlots[j];
          if (slotA.local === slotB.local && slotA.start < slotB.end && slotA.end > slotB.start) {
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
      // Tenta buscar a configuração do banco de dados
      const configResult = await query('SELECT config_json FROM config WHERE id = 1');
      let config = {};
      if (configResult.rows.length > 0) {
        config = JSON.parse(configResult.rows[0].config_json);
      } else {
        // Fallback para o arquivo local se não estiver no banco (desenvolvimento)
        config = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf-8"));
      }

      if (config.sheetId) {
        console.log(`\n🔍 [DEBUG-SHEETS] Tentando buscar dados da planilha com ID: ${config.sheetId}`);
        const response = await sheets.spreadsheets.values.get({ spreadsheetId: config.sheetId, range: "A:ZZ" });
        const rows = (response.data.values || []);
        
        console.log(`🔍 [DEBUG-SHEETS] Resposta da API - Número de linhas recebidas: ${rows.length}`);
        if (rows.length > 0) {
          console.log(`🔍 [DEBUG-SHEETS] Cabeçalhos (primeira linha): ${rows[0].join(', ')}`);
        }

        if (rows.length > 1) {
          const headers = rows[0];
          formsDataRows = rows.slice(1).map(row => headers.reduce((acc, header, index) => ({ ...acc, [header]: row[index] || "" }), {}));
          console.log(`✅ [DEBUG-SHEETS] Dados da planilha processados com sucesso. Total de linhas de dados: ${formsDataRows.length}`);
        } else {
          console.log("❌ [DEBUG-SHEETS] A planilha não contém dados (apenas cabeçalho ou está vazia).");
        }
      }
    } catch (e) {
      console.error("❌ [UNIFY] ERRO CRÍTICO ao buscar dados da planilha:", e.message);
      console.error("❌ [UNIFY] Detalhes do erro:", e.stack);
    }

    const inscricoesCompletas = inscriptionsWithScores.map(inscricao => {
      const emailEtapa1 = (inscricao.email || "").trim().toLowerCase();
      const telEtapa1 = (inscricao.telefone || "").replace(/\D/g, "");
      
      // 1. Procurar pela correspondência em cada linha da planilha
      // IMPORTANTE: Procurar pelas chaves de e-mail e telefone EM CADA LINHA INDIVIDUALMENTE
      // porque o Google Forms pode ter variações nos nomes das colunas
      const match = formsDataRows.find(rowData => {
        let emailForms = '', telForms = '';

        // 2. Identificar as chaves de E-mail e Telefone NESTA LINHA ESPECÍFICA
        const rowKeys = Object.keys(rowData);
        const rowEmailKey = rowKeys.find(key => normalizeKey(key).includes('mail'));
        const rowPhoneKey = rowKeys.find(key => normalizeKey(key).includes('fone') || normalizeKey(key).includes('telefone'));

        // 3. Extrair e normalizar os dados usando as chaves identificadas
        if (rowEmailKey) {
          emailForms = (rowData[rowEmailKey] || "").trim().toLowerCase();
        }
        if (rowPhoneKey) {
          telForms = (rowData[rowPhoneKey] || "").replace(/\D/g, "");
        }

        // 4. Lógica de correspondência
        const isMatch = (emailForms && emailEtapa1 && emailForms === emailEtapa1) || (telForms && telEtapa1 && telForms === telEtapa1);
        
        // Se o problema persistir, o usuário pode descomentar o log abaixo para debug no Render
        // if (isMatch) {
        //   console.log(`✅ [UNIFY] Match encontrado para Inscrição #${inscricao.id}. Email: ${emailForms}, Telefone: ${telForms}.`);
        // }
        
        return isMatch;
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
      const config = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf-8"));
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

      if (slotA.local === slotB.local && slotA.start < slotB.end && slotA.end > slotB.start) {
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
          if (!slot.eventId) {
            const inscricaoVencedora = inscriptionsWithScores.find(i => i.id === slot.inscriptionId);
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

    const inscriptionsWithScores = inscriptions.map(inscription => {
      const relatedAssessments = allAssessments.filter(a => a.inscription_id === inscription.id);
      let finalScore = null;
      
      let requiredAssessmentsForScore = 3;
      try {
        const config = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf-8"));
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
      
      await query(
        `INSERT INTO inscricoes (nome, email, telefone, evento_nome, local, ensaio_inicio, ensaio_fim, ensaio_eventId, montagem_inicio, montagem_fim, montagem_eventId, desmontagem_inicio, desmontagem_fim, desmontagem_eventId, eventos_json) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [dbPayload.nome, dbPayload.email, dbPayload.telefone, dbPayload.evento_nome, dbPayload.local, dbPayload.ensaio_inicio, dbPayload.ensaio_fim, dbPayload.ensaio_eventId, dbPayload.montagem_inicio, dbPayload.montagem_fim, dbPayload.montagem_eventId, dbPayload.desmontagem_inicio, dbPayload.desmontagem_fim, dbPayload.desmontagem_eventId, dbPayload.eventos_json]
      );
      console.log("💾 Inscrição salva no banco com sucesso!");
      
res.json({ success: true, message: "Eventos criados e inscrição salva com sucesso!", eventos: eventosCriados });

	      // Envia o e-mail de confirmação da Etapa 1 em segundo plano (não bloqueia a resposta ao cliente)
		      sendStep1ConfirmationEmail(userData, (userData.eventName || resumo), local, etapasComId.map(e => ({ nome: e.nome, inicio: e.inicio, fim: e.fim })));
    } catch (err) {
      console.error("❌ Erro ao salvar inscrição no banco:", err.message);
      res.status(500).json({ success: false, error: "Erro ao salvar inscrição." });
    }
  } catch (err) {
    console.error("❌ Erro no endpoint /api/create-events:", err.message);
    res.status(500).json({ success: false, error: "Erro interno ao criar eventos." });
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
    const dataFormatada = new Date(etapa.inicio).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const horaInicio = new Date(etapa.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo', hour12: false });
    const horaFim = new Date(etapa.fim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo', hour12: false });
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
	        <p>Atenciosamente,<br>Sistema de Agendamento UFSC</p>
		      </div>
		    `;
  
  const subject = `✅ Confirmação da 1ª Etapa: ${evento_nome}`;
  const remetente = process.env.EMAIL_REMETENTE_VALIDADO || 'noreply@agendamento.site';
  
  console.log(`✅ Tentando enviar e-mail de confirmação da Etapa 1 para: ${email}`);

  // --- 1. Tenta Brevo API (Prioridade) ---
  if (brevoApiKey) {
    try {
      const payload = {
        sender: { email: remetente, name: "Sistema de Agendamento UFSC" },
        to: [{ email: email, name: nome }],
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
        from: remetente,
        to: [email],
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
        from: `"Sistema de Agendamento UFSC" <${remetente}>`,
        to: email,
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
        const relatedAssessments = allAssessments.filter(a => a.inscription_id === inscription.id);
        let finalScore = null;
        
        let requiredAssessmentsForScore = 3;
        try {
          const config = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf-8"));
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


// --- ROTAS DE CONFIGURAÇÃO ---

// --- 24. ROTA: GERAR PDF COM DADOS DO GOOGLE SHEETS ---
// --- ROTAS DE CONFIGURAÇÃO (GET E POST /api/config) ---

// GET /api/config - Ler configurações do banco
app.get("/api/config", async (req, res) => {
  try {
    const result = await query("SELECT config_json FROM config WHERE id = 1");
    
    if (result.rows.length > 0) {
      const config = JSON.parse(result.rows[0].config_json);
      res.json(config);
    } else {
      // Se não existe, retorna config vazio
      res.json({
        formsLink: "",
        sheetLink: "",
        sheetId: "",
        pageTitle: "Sistema de Agendamento de Espaços",
        allowBookingOverlap: false,
        blockedDates: [],
        stageTimes: {
          ensaio: { start: "08:00", end: "21:00" },
          montagem: { start: "08:00", end: "21:00" },
          evento: { start: "08:00", end: "21:00" },
          desmontagem: { start: "08:00", end: "21:00" }
        },
        enableInternalEdital: true,
        enableExternalEdital: true,
        enableRehearsal: true
      });
    }
  } catch (error) {
    console.error("Erro ao ler configurações:", error);
    res.status(500).json({ error: "Erro ao ler configurações" });
  }
});

// POST /api/config - Salvar configurações no banco
app.post("/api/config", async (req, res) => {
  try {
    // Ler config atual
    const currentResult = await query("SELECT config_json FROM config WHERE id = 1");
    let currentConfig = {};
    
    if (currentResult.rows.length > 0) {
      currentConfig = JSON.parse(currentResult.rows[0].config_json);
    }
    
    // Merge com novos dados
    const newConfig = { ...currentConfig, ...req.body };
    
    // Extrair sheetId do sheetLink se fornecido
    if (newConfig.sheetLink) {
      const match = newConfig.sheetLink.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match) {
        newConfig.sheetId = match[1];
        console.log(`✅ SheetId extraído: ${newConfig.sheetId}`);
      }
    }
    
    // Salvar no banco (INSERT ou UPDATE)
    await query(`
      INSERT INTO config (id, config_json, updated_at)
      VALUES (1, $1, NOW())
      ON CONFLICT (id) DO UPDATE
      SET config_json = $1, updated_at = NOW()
    `, [JSON.stringify(newConfig)]);
    
    console.log("✅ Configurações salvas no banco:", newConfig);
    res.json({ success: true });
    
  } catch (error) {
    console.error("Erro ao salvar configurações:", error);
    res.status(500).json({ error: "Erro ao salvar configurações" });
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
    
    // 2. Buscar dados do Google Sheets via CSV (como no backup)
    let respostaForms = null;
    try {
      // ✅ LER CONFIG DO BANCO DE DADOS (não do arquivo)
      const configResult = await query('SELECT config_json FROM config WHERE id = 1');
      let sheetId = null;
      if (configResult.rows.length > 0) {
        const config = JSON.parse(configResult.rows[0].config_json);
        sheetId = config.sheetId;
      }
      console.log(`[PDF] SheetId do banco:`, sheetId);

      if (sheetId) {
        // ✅ Usar Sheets API ao invés do Drive API
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: 'A:Z'
        });
        
        const rows = response.data.values;
        if (!rows || rows.length === 0) {
          console.log('[PDF] Sheet vazio');
        } else {
          // Primeira linha = cabeçalhos
          const headers = rows[0];
          // Converter para array de objetos
          const records = rows.slice(1).map(row => {
            const obj = {};
            headers.forEach((header, i) => {
              obj[header] = row[i] || '';
            });
            return obj;
          });
          console.log(`[PDF] Records found: ${records.length}`);
          if (records.length > 0) {
            console.log(`[PDF] Columns:`, Object.keys(records[0]));
          }

        // Encontrar linha correspondente
        respostaForms = records.find(f => {
          const emailKey = Object.keys(f).find(k => k.toLowerCase().includes("mail"));
          const telKey = Object.keys(f).find(k => k.toLowerCase().includes("fone") || k.toLowerCase().includes("telefone"));
          const emailForms = emailKey ? (f[emailKey] || "").trim().toLowerCase() : null;
          const telForms = telKey ? (f[telKey] || "").replace(/\D/g, "") : null;
          const emailEtapa1 = (inscricao.email || "").trim().toLowerCase();
          const telEtapa1 = (inscricao.telefone || "").replace(/\D/g, "");
          
          return (emailForms && emailEtapa1 && emailForms === emailEtapa1) || 
                 (telForms && telEtapa1 && telForms === telEtapa1);
        });
          console.log(`[PDF] Resposta encontrada:`, respostaForms ? 'SIM' : 'N\u00c3O');
          if (respostaForms) {
            console.log(`[PDF] Campos:`, Object.keys(respostaForms));
          }
        }
      }
    } catch (e) {
      console.error("[PDF] ERRO ao buscar dados do Forms:", e.message);
      console.error(e.stack);
    }
    
    // 3. Gerar PDF
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on("data", chunk => chunks.push(chunk));
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(chunks);
      const filename = `inscricao-${id}-${(inscricao.evento_nome || 'evento').replace(/\s+/g, '_')}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`); // inline = abre em nova aba
      res.send(pdfBuffer);

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

    // Dados da 2ª Etapa (do Google Sheets) - SEMPRE MOSTRAR
    doc.font('Helvetica-Bold').fontSize(14).text("3. DETALHAMENTO DO EVENTO (Etapa 2)");
    if (respostaForms) {
      doc.font('Helvetica').fontSize(10);
      for (const [key, value] of Object.entries(respostaForms)) {
        // Ignorar carimbo de data/hora
        if (key.toLowerCase().includes('carimbo de data/hora')) continue;
        
        // Tratar valores vazios de forma mais flexível
        const displayValue = String(value).trim() === "" ? "NÃO INFORMADO" : value;
        
        // Se o valor for uma URL do Drive, exibir como link
        const isDriveLink = typeof value === 'string' && value.includes('drive.google.com');
        
        // Escrever o rótulo
        doc.font('Helvetica-Bold').text(key, { continued: true }).font('Helvetica').text(`: `, { continued: true });

        if (isDriveLink) {
          // Se for link, exibe o texto "LINK PARA ANEXO" como um link clicável
          doc.fillColor('blue').text("LINK PARA ANEXO", { 
            link: value, 
            underline: true, 
            continued: false 
          }).fillColor('black'); // Volta a cor para preto
        } else {
          // Caso contrário, exibe o valor normalmente
          doc.text(displayValue, { continued: false });
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
          const emailKey = Object.keys(f).find(k => k.toLowerCase().includes("mail"));
          const telKey = Object.keys(f).find(k => k.toLowerCase().includes("fone") || k.toLowerCase().includes("telefone"));
          const emailForms = emailKey ? (f[emailKey] || "").trim().toLowerCase() : null;
          const telForms = telKey ? (f[telKey] || "").replace(/\D/g, "") : null;
          const emailEtapa1 = (inscricao.email || "").trim().toLowerCase();
          const telEtapa1 = (inscricao.telefone || "").replace(/\D/g, "");
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
app.listen(port, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${port}` );
  cron.schedule("*/5 * * * *", atualizarCache);
  atualizarCache();
});
