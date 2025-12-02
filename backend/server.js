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
import { parse } from "csv-parse/sync";
import archiver from "archiver";
import { PassThrough } from "stream";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

// --- 1. CONFIGURAÇÕES GERAIS E BANCO DE DADOS ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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
    const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));
    if (config.requiredAssessments) {
      return parseInt(config.requiredAssessments, 10);
    }
  } catch (e) { /* ignora */ }
  return 3; // Valor padrão
}

// --- 2. CONFIGURAÇÃO DO GOOGLE CALENDAR E SHEETS ---
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
const { auth } = await google.auth.getClient({
  // Tenta usar a variável de ambiente GOOGLE_CREDENTIALS_JSON (Render)
  // Se não existir, tenta usar o arquivo local (Desenvolvimento)
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || './credentials.json',
  credentials: undefined,
});

const calendar = google.calendar({ version: 'v3', auth });
const sheets = google.sheets({ version: 'v4', auth });

// --- 7. CONFIGURAÇÃO DO EXPRESS ---
const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// --- 9. ROTA PARA OBTER CONFIGURAÇÕES ---
app.get("/api/config", (req, res) => {
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

    if (fs.existsSync("config.json")) {
      const savedConfig = JSON.parse(fs.readFileSync("config.json", "utf-8"));
      const fullConfig = { ...defaultConfig, ...savedConfig };
      res.json(fullConfig);
    } else {
      res.json(defaultConfig);
    }
  } catch (e) {
    res.status(500).json({ error: "Erro ao ler arquivo de configuração." });
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
  const { emails } = req.body;
  if (!Array.isArray(emails)) {
    return res.status(400).json({ error: 'O corpo da requisição deve ser um array de e-mails.' });
  }

  const results = [];
  const errors = [];

  try {
    // 1. Buscar avaliadores existentes para comparação
    const existingResult = await query('SELECT email FROM evaluators');
    const existingEvaluators = existingResult.rows.map(e => e.email);
    const emailsToKeep = new Set(emails.map(e => e.trim().toLowerCase()).filter(e => e !== ''));
    const emailsToRemove = existingEvaluators.filter(email => !emailsToKeep.has(email));
    
    // 2. Remover avaliadores que não estão na nova lista
    if (emailsToRemove.length > 0) {
        const placeholders = emailsToRemove.map((_, i) => `$${i + 1}`).join(',');
        await query(`DELETE FROM evaluators WHERE email IN (${placeholders})`, emailsToRemove);
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
          // Inserir novo avaliador
          await query(
            'INSERT INTO evaluators (email, password_hash) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET password_hash = $2',
            [normalizedEmail, passwordHash]
          );
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
        const result = await query('SELECT * FROM evaluators WHERE email = $1', [email.trim().toLowerCase()]);
        const evaluator = result.rows[0];
        
        if (!evaluator) {
            return res.status(403).json({ success: false, message: 'Acesso negado. E-mail não encontrado.' });
        }

        // 1. Verifica se o avaliador tem um hash de senha
        if (!evaluator.password_hash) {
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
      const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));
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
      
      // Envia o e-mail de confirmação da Etapa 1
      await sendStep1ConfirmationEmail(userData.email, userData.name, (userData.eventName || resumo), local, etapasComId.map(e => ({ nome: e.nome, inicio: e.inicio, fim: e.fim })));

      res.json({ success: true, message: "Eventos criados e inscrição salva com sucesso!", eventos: eventosCriados });
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
    });
    res.json({ eventos: events.data.items || [] });
  } catch (error) {
    console.error(`❌ Erro ao buscar eventos do Google Calendar para ${local}:`, error.message);
    // Retorna 500, mas com um JSON válido para o frontend
    res.status(500).json({ error: "Falha ao buscar eventos do calendário. Verifique a autenticação do Google Calendar." });
  }
});atch (error) {
    console.error("Erro ao obter slots ocupados:", error);
    res.status(500).json({ error: "Erro ao obter slots ocupados." });
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

// --- 23. SERVIR ARQUIVOS ESTÁTICOS E FALLBACK PARA O REACT ROUTER ---

// Servir arquivos estáticos (CSS, JS, Imagens)
app.use(express.static(path.join(__dirname, '..', 'dist')));

// Fallback para o React Router: Envia o index.html para qualquer rota não tratada
app.use((req, res) => {
  // Ignora rotas de API para não interferir
  if (req.path.startsWith('/api')) {
    return res.status(404).send('API endpoint not found');
  }
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});


// --- 24. INICIALIZAÇÃO DO SERVIDOR ---
app.listen(port, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${port}` );
  cron.schedule("*/5 * * * *", atualizarCache);
  atualizarCache();
});
