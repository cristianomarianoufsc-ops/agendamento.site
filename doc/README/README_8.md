# 📅 Agendamento DAC

Sistema de agendamento com integração ao **Google Calendar** e **Google Sheets**, utilizando **Node.js + Express + SQLite**.

---

## 🚀 Tecnologias
- Node.js + Express
- SQLite (armazenamento local de inscrições)
- Google Calendar API
- Google Sheets API
- Service Account (Google Cloud)
- Cron jobs (atualização de cache de eventos)

---

## ⚙️ Pré-requisitos

1. **Node.js** (>= 16)
2. **Conta no Google Cloud**
   - Projeto criado (ex: `agendamento-dac`)
   - APIs ativadas:
     - ✅ Google Calendar API  
     - ✅ Google Sheets API  
3. **Service Account**
   - Criada dentro do mesmo projeto (`IAM & Admin > Contas de Serviço`)
   - Criar uma chave JSON e baixar
   - Renomear o arquivo para `credentials.json` e colocar dentro da pasta `backend/`
   - Compartilhar:
     - Agenda(s) do Google Calendar com o e-mail da service account
     - Planilha de respostas do Forms com o e-mail da service account
4. **Banco SQLite**
   - Arquivo `inscricoes.db` é criado automaticamente

---

## 📂 Estrutura

```
backend/
 ├── node_modules/
 ├── uploads/
 ├── .env
 ├── config.json
 ├── credentials.json       # chave da Service Account (NÃO versionar no git)
 ├── inscricoes.db          # banco SQLite (criado em runtime)
 ├── package.json
 ├── server.js              # servidor principal
```

---

## 🔑 Configuração do `.env`

Crie um arquivo `.env` na pasta `backend/` com:

```env
PORT=4000

# Google Sheets
SHEET_ID=1XEWi3G20TGM-stQUQTlEga4ZeTWnw-_yffydWX8bY5E
SHEET_RANGE=Respostas ao formulário 1!A:Z
```

---

## ▶️ Rodando o projeto

Instale dependências:

```bash
cd backend
npm install
```

Inicie o servidor:

```bash
node server.js
```

O backend sobe em [http://localhost:4000](http://localhost:4000)

---

## 🌐 Endpoints

### 📌 Listar cache de eventos por local
```http
GET /ical/:local/horarios
```
- `local` pode ser `teatro` ou `igrejinha`.

### 📌 Criar eventos no Google Calendar + salvar no DB
```http
POST /api/create-events
```
Body (JSON):
```json
{
  "local": "teatro",
  "resumo": "Evento Teste",
  "etapas": [
    { "nome": "ensaio", "inicio": "2025-08-30T10:00:00", "fim": "2025-08-30T12:00:00" },
    { "nome": "evento", "inicio": "2025-08-31T18:00:00", "fim": "2025-08-31T20:00:00" }
  ],
  "userData": {
    "name": "Fulano de Tal",
    "email": "fulano@email.com",
    "phone": "99999-0000",
    "eventName": "Peça Teatral"
  }
}
```

### 📌 Cancelar evento
```http
DELETE /api/cancel-event/:local/:eventId
```

### 📌 Configurar link do Forms
- **GET** `/api/forms-link`  
- **POST** `/api/forms-link`  
Body:
```json
{ "formsLink": "https://docs.google.com/forms/d/xxxx" }
```

### 📌 Listar inscrições do banco local
```http
GET /api/inscricoes
```

### 📌 Buscar respostas do Google Forms (via Google Sheets)
```http
GET /api/forms-respostas
```
- Puxa direto da planilha vinculada ao Forms
- Usa `SHEET_ID` e `SHEET_RANGE` do `.env`

---

## 🗂️ Banco SQLite

Tabela criada automaticamente:
```sql
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
```

---

## ⚠️ Observações Importantes
- **Nunca versionar o `credentials.json` no GitHub** (use `.gitignore`).
- O e-mail da service account deve estar como **Editor** tanto na agenda do Calendar quanto na planilha do Sheets.
- O `SHEET_RANGE` deve corresponder exatamente ao nome da aba (ex: `Respostas ao formulário 1!A:Z`).
- O cache dos eventos é atualizado a cada **5 minutos** via `node-cron`.

---

## ✅ Checklist de funcionamento
- [ ] Criou Service Account no **mesmo projeto** do Google Cloud  
- [ ] Baixou chave JSON → `backend/credentials.json`  
- [ ] Compartilhou Agenda + Planilha com o e-mail da service account  
- [ ] Ativou **Google Calendar API** e **Google Sheets API**  
- [ ] Configurou `.env` corretamente  
- [ ] Servidor sobe sem erros e endpoints respondem
