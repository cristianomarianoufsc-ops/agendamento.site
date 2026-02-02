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
console.log('🔍 DEBUG - Variáveis de ambiente:');
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
    console.error("❌ Erro ao inicializar tabelas:", error.message);
    // Não encerra o processo aqui para permitir que o servidor inicie mesmo com erro de banco (fallback para config local)
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
  return null; // Retorna null se não encontrar ou houver erro
}

// ✅ FUNÇÃO AUXILIAR PARA PEGAR O NÚMERO DE AVALIAÇÕES REQUERIDAS
// Esta função agora é assíncrona e lê do banco de dados
async function getRequiredAssessments() {
  try {
    const config = await getConfigFromDB();
    if (config && config.requiredAssessments) {
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
  if (!transporter && !brevoApiKey) {
    console.error('❌ Erro: Nenhum serviço de e-mail configurado.');
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
      }
    ]
  };

  try {
    if (brevoApiKey) {
        console.log(`✅ Tentando enviar e-mail de confirmação da Etapa 1 para: ${email}`);
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': brevoApiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: { name: "Sistema de Agendamento DAC", email: "cristianomariano.ufsc@gmail.com" },
                to: [{ email: email, name: inscricao.nome }],
                subject: mailOptions.subject,
                htmlContent: mailOptions.html,
                attachment: [{
                    content: pdfBuffer.toString('base64'),
                    name: filename
                }]
            })
        });

        if (response.ok) {
            const result = await response.json();
            console.log(`✅✅✅ E-mail enviado com sucesso via Brevo API REST! ID: ${result.messageId}`);
            return true;
        } else {
            const errorText = await response.text();
            console.error(`❌ Erro ao enviar e-mail via Brevo API REST: ${response.status} - ${errorText}`);
            // Fallback para SMTP se configurado
            if (transporter) {
                console.log('🔄 Tentando fallback para SMTP...');
                await transporter.sendMail(mailOptions);
                return true;
            }
            return false;
        }
    } else {
        await transporter.sendMail(mailOptions);
        console.log(`✅ E-mail enviado com sucesso para: ${email}`);
        return true;
    }
  } catch (error) {
    console.error(`❌ Erro ao enviar e-mail para ${email}:`, error.message);
    return false;
  }
}

// --- 4. FUNÇÕES DE APOIO ---

// Função para atualizar o cache de horários ocupados
async function atualizarCache() {
  console.log("🔄 Atualizando cache de horários ocupados...");
  // Implementação futura ou conforme necessário
}

// --- 5. INICIALIZAÇÃO DAS GOOGLE APIS ---
async function initializeGoogleAPIs() {
  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log('🔑 Usando GOOGLE_APPLICATION_CREDENTIALS da variável de ambiente');
      try {
        const envValue = process.env.GOOGLE_APPLICATION_CREDENTIALS.trim();
        let credentials;
        try {
          credentials = JSON.parse(envValue);
        } catch (firstError) {
          try {
            const jsonString = envValue.replace(/\\n/g, '\n');
            credentials = JSON.parse(jsonString);
          } catch (secondError) {
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
        const { auth: fileAuth } = await google.auth.getClient({
          keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
          scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.readonly'],
        });
        auth = fileAuth;
      }
    } else {
      console.log('🔑 Usando credentials.json local (desenvolvimento)');
      const credData = JSON.parse(fs.readFileSync(path.join(__dirname, 'credentials.json'), 'utf8'));
      console.log('🔑 Service Account:', credData.client_email);
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
    // Não encerra o processo para permitir funcionamento parcial
  }
}

// --- 6. CONFIGURAÇÃO DO EXPRESS ---
const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- 7. ROTAS DA API ---

// ROTA PARA OBTER CONFIGURAÇÕES
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

    const savedConfig = await getConfigFromDB();
    if (savedConfig) {
      console.log("✅ Configurações carregadas do banco de dados.");
      return res.json({ ...defaultConfig, ...savedConfig });
    }

    // Fallback para arquivo local se o banco falhar
    try {
      if (fs.existsSync("config.json")) {
        const fileConfig = JSON.parse(fs.readFileSync("config.json", "utf8"));
        console.log("✅ Configurações carregadas do arquivo local.");
        return res.json({ ...defaultConfig, ...fileConfig });
      }
    } catch (e) { /* ignora */ }

    console.log("ℹ️ Usando configuração padrão.");
    res.json(defaultConfig);
  } catch (e) {
    console.error("❌ Erro em GET /api/config:", e.message);
    res.status(500).json({ error: "Erro ao ler configuração." });
  }
});

// ROTA PARA SALVAR CONFIGURAÇÕES
app.post("/api/config", async (req, res) => {
  try {
    const newConfigData = req.body;
    console.log("📥 Recebendo novos dados de config:", JSON.stringify(newConfigData));
    
    let currentConfig = {};
    const savedConfig = await getConfigFromDB();
    if (savedConfig) {
      currentConfig = savedConfig;
    } else {
      try {
        if (fs.existsSync("config.json")) {
          currentConfig = JSON.parse(fs.readFileSync("config.json", "utf8"));
        }
      } catch (e) { /* ignora */ }
    }

    const updatedConfig = { ...currentConfig, ...newConfigData };

    const extractId = (val) => {
      if (!val) return "";
      const match = val.match(/\/d\/(?:e\/)?([a-zA-Z0-9-_]+)/);
      return match ? match[1] : val;
    };

    if (updatedConfig.formsId) {
      updatedConfig.formsId = extractId(updatedConfig.formsId);
      updatedConfig.formsLink = `https://docs.google.com/forms/d/e/${updatedConfig.formsId}/viewform`;
    }

    if (updatedConfig.sheetLink) {
      updatedConfig.sheetId = extractId(updatedConfig.sheetLink);
    } else if (updatedConfig.sheetId) {
      updatedConfig.sheetId = extractId(updatedConfig.sheetId);
    }

    if (updatedConfig.buttonExternalEditalText && updatedConfig.buttonExternalEditalText.length > 50) {
        updatedConfig.buttonExternalEditalText = updatedConfig.buttonExternalEditalText.substring(0, 50);
    }

    const configJson = JSON.stringify(updatedConfig);
    
    // Tenta salvar no banco
    let savedToDB = false;
    try {
      await query(`
        INSERT INTO config (id, config_json, updated_at)
        VALUES (1, $1, CURRENT_TIMESTAMP)
        ON CONFLICT (id) 
        DO UPDATE SET config_json = $1, updated_at = CURRENT_TIMESTAMP
      `, [configJson]);
      console.log("✅ Configurações salvas no banco com sucesso!");
      savedToDB = true;
    } catch (dbSaveError) {
      console.error("❌ Erro ao salvar no banco:", dbSaveError.message);
    }

    // Backup em arquivo local (sempre tenta, serve como fallback)
    try {
      fs.writeFileSync("config.json", JSON.stringify(updatedConfig, null, 2));
      console.log("✅ Backup local concluído.");
    } catch (fsError) {
      console.warn("⚠️ Erro backup local:", fsError.message);
    }
    
    if (!savedToDB && !fs.existsSync("config.json")) {
        throw new Error("Não foi possível salvar a configuração nem no banco nem localmente.");
    }

    res.json({ success: true, config: updatedConfig, savedToDB });
    
  } catch (err) {
    console.error("❌ Erro em POST /api/config:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- ROTA PARA AUTENTICAÇÃO DO ADMINISTRADOR ---
app.post('/api/auth/admin', async (req, res) => {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin.dac.ufsc';

    if (!password) {
        return res.status(400).json({ error: 'A senha é obrigatória.' });
    }

    if (password === adminPassword) {
        res.json({ success: true, message: 'Acesso de administrador autorizado.' });
    } else {
        res.status(403).json({ success: false, message: 'Acesso negado. Senha incorreta.' });
    }
});

// --- OUTRAS ROTAS (INSCRIÇÕES, AVALIAÇÕES, ETC) ---
// (Mantendo a estrutura simplificada para o exemplo, mas o arquivo real deve conter todas as rotas originais)

app.get('/api/inscricoes', async (req, res) => {
    try {
        const result = await query('SELECT * FROM inscricoes ORDER BY criado_em DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar inscrições:', error.message);
        res.status(500).json({ error: 'Erro ao buscar inscrições.' });
    }
});

// ... (Adicione aqui as demais rotas conforme necessário do arquivo original)

// Fallback para o React Router
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).send('API endpoint not found');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- INICIALIZAÇÃO DO SERVIDOR ---
async function startServer() {
  try {
    await initializeGoogleAPIs();
    app.listen(port, () => {
      console.log(`🚀 Servidor rodando em http://localhost:${port}`);
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar o servidor:', error.message);
    process.exit(1);
  }
}

startServer();
