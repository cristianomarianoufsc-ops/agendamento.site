const express = require('express');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const { exec } = require('child_process');
const archiver = require('archiver');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;
const MASTER_SHEET_CONFIG_PATH = path.join(__dirname, 'master-sheet-config.json');

// Configuração do PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Função de consulta genérica
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('executed query', { text, duration, rows: res.rowCount });
  return res;
}

// Função para normalizar chaves (remover acentos, espaços, etc.)
function normalizeKey(key = "") {
  return key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

// Autenticação com Google APIs
let auth;
let calendar;
let sheets;
let drive;

async function authenticateGoogle() {
  try {
    if (process.env.GOOGLE_CREDENTIALS_JSON) {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
      auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.readonly'],
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
      auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.readonly'],
      });
    } else {
      throw new Error('Nenhuma credencial do Google encontrada.');
    }

    const client = await auth.getClient();
    const credData = await auth.getCredentials();
    console.log('🔑 Service Account:', client.email);

    calendar = google.calendar({ version: 'v3', auth });
    sheets = google.sheets({ version: 'v4', auth });
    drive = google.drive({ version: 'v3', auth });
    console.log('✅ Google APIs autenticadas com sucesso!');
  } catch (e) {
    console.error('❌ ERRO DE AUTENTICAÇÃO COM GOOGLE APIS:', e.message);
    console.error('   Verifique se a variável de ambiente GOOGLE_CREDENTIALS_JSON ou GOOGLE_APPLICATION_CREDENTIALS está configurada corretamente.');
  }
}

// Função para buscar dados da planilha e unificar com inscrições
async function getInscricaoCompleta(id) {
  // ... (código anterior)

  // O resto da rota para unificar com o Google Forms...
  let formsDataRows = [];
  try {
    const configResult = await query('SELECT config_json FROM config WHERE id = 1');
    let config = {};
    if (configResult.rows.length > 0) {
      config = JSON.parse(configResult.rows[0].config_json);
    } else {
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

      let headerRowIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const isHeaderRow = row.some(cell => {
          if (cell && typeof cell === 'string') {
            const normalizedCell = normalizeKey(cell);
            return normalizedCell.includes('carimbo') || normalizedCell.includes('timestamp');
          }
          return false;
        });

        if (isHeaderRow) {
          headerRowIndex = i;
          console.log(`🔍 [DEBUG-SHEETS] Cabeçalho encontrado na linha ${i + 1} após varrer todas as colunas.`);
          break;
        }
      }

      if (headerRowIndex !== -1) {
        const headers = rows[headerRowIndex];
        formsDataRows = rows.slice(headerRowIndex + 1)
          .filter(row => row.length > 0 && row.some(cell => cell && String(cell).trim() !== ''))
          .map(row => headers.reduce((acc, header, index) => ({ ...acc, [header]: row[index] || "" }), {}));
        
        console.log(`✅ [DEBUG-SHEETS] Cabeçalho encontrado na linha ${headerRowIndex + 1}. Total de linhas de dados processadas: ${formsDataRows.length}`);
      } else {
        console.log("❌ [DEBUG-SHEETS] Não foi possível encontrar a linha de cabeçalho ('Carimbo de Data/Hora') na planilha.");
      }
    }
  } catch (e) {
    console.error("❌ [UNIFY] ERRO CRÍTICO ao buscar dados da planilha:", e.message);
    console.error("❌ [UNIFY] Detalhes do erro:", e.stack);
  }

  const inscricoesCompletas = inscriptionsWithScores.map(inscricao => {
    const emailEtapa1 = (inscricao.email || "").trim().toLowerCase();
    const telEtapa1 = (inscricao.telefone || "").replace(/\D/g, "");
    
    const match = formsDataRows.find((rowData, index) => {
      let emailForms = '', telForms = '';

      const rowKeys = Object.keys(rowData);
      const rowEmailKey = rowKeys.find(key => normalizeKey(key).includes('mail'));
      const rowPhoneKey = rowKeys.find(key => normalizeKey(key).includes('fone') || normalizeKey(key).includes('telefone'));

      if (rowEmailKey) {
        emailForms = (rowData[rowEmailKey] || "").trim().toLowerCase();
      }
      if (rowPhoneKey) {
        telForms = (rowData[rowPhoneKey] || "").replace(/\D/g, "");
      }

      const emailMatch = emailEtapa1 && emailForms && emailEtapa1 === emailForms;
      const telMatch = telEtapa1 && telForms && telEtapa1 === telForms;
      
      if (inscricao.id === 1) { 
        console.log(`\n🔍 [DEBUG-UNIFY] Inscrição #${inscricao.id} (Etapa 1): Email: ${emailEtapa1}, Tel: ${telEtapa1}`);
        console.log(`🔍 [DEBUG-UNIFY] Linha Forms #${index + 1} (Etapa 2): Email: ${emailForms}, Tel: ${telForms}`);
        console.log(`🔍 [DEBUG-UNIFY] Match: Email: ${emailMatch}, Tel: ${telMatch}`);
      }

      return emailMatch || telMatch;
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

  return inscricoesCompletas;
}

// ... (resto do código)

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));





















































































app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  authenticateGoogle();
});


