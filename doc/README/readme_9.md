# 🎭 Sistema de Gestão de Inscrições e Eventos – README v8

## 📌 Visão Geral
Aplicação web para **gestão de inscrições em eventos culturais**, composta por **duas etapas**:

1. **Primeira Etapa (Agendamento / Cadastro inicial)**  
   - Usuário escolhe local, datas e etapas (ensaio, montagem, desmontagem, evento).  
   - Os eventos são criados no **Google Calendar** automaticamente.  
   - Dados são salvos no **SQLite (`inscricoes.db`)**.

2. **Segunda Etapa (Complementar – Google Forms)**  
   - Usuário recebe um link dinâmico para preencher um **Google Forms**.  
   - As respostas são buscadas via **Google Sheets API** e mescladas com os dados da Etapa 1.  
   - Uploads feitos no Forms (Google Drive) também são processados.

O **Painel Admin** permite:
- Configurar o link do Forms.  
- Visualizar inscrições unificadas (SQLite + Forms).  
- Ver todas as etapas (ensaio, montagem, eventos extras, desmontagem).  
- Gerenciar cache de eventos por calendário.

---

## 🛠️ Tecnologias
- **Frontend**: React (Vite)  
- **Backend**: Node.js (Express)  
- **Banco de dados**: SQLite (better-sqlite3)  
- **APIs externas**:  
  - Google Calendar API  
  - Google Sheets API  
  - Google Drive API  
- **Outros**: cron jobs, dotenv, pdfkit  

---

## 📂 Estrutura Principal
```
/frontend
  ├── src/
  │   ├── App.jsx          # Formulário da Etapa 1
  │   ├── Admin.jsx        # Painel administrativo (/admin)
  │   └── ...
/backend
  ├── server.js            # Servidor Node + APIs
  ├── inscricoes.db        # SQLite local
  ├── config.json          # Guarda o link do Forms
  ├── credentials.json     # Service Account do Google
  └── .env                 # Configurações (SHEET_ID, etc.)
```

---

## ⚙️ Configuração

### 1. Clonar o projeto
```bash
git clone <repo-url>
cd <repo>
```

### 2. Configurar credenciais
Crie um projeto no Google Cloud com:
- **Calendar API**  
- **Sheets API**  
- **Drive API**

Baixe o arquivo `credentials.json` (Service Account) e coloque na pasta `/backend`.

### 3. Configurar `.env`
Na pasta `/backend`, crie `.env`:
```env
PORT=4000
SHEET_ID=<ID da sua planilha de respostas do Forms>
SHEET_RANGE="Respostas ao formulário 1!A:Z"
```

### 4. Instalar dependências
```bash
cd backend && npm install
cd ../frontend && npm install
```

### 5. Rodar
```bash
# Backend
cd backend
node server.js

# Frontend
cd frontend
npm run dev
```

---

## 🚀 Fluxo de Uso

### 🔹 Usuário (Etapa 1)
1. Preenche nome, e-mail, telefone, local, título do evento e etapas.  
2. Evento(s) são criados no **Google Calendar**.  
3. Dados ficam registrados no **SQLite**.

### 🔹 Usuário (Etapa 2)
1. Clica em **Segunda Etapa**.  
2. App.jsx busca o link salvo em `/api/forms-link` (dinâmico).  
3. Abre o **Google Forms** configurado pelo admin.  

### 🔹 Admin
1. Acessa `/admin`.  
2. Define ou altera o **link do Forms** (salvo em `config.json`).  
3. Visualiza a **tabela unificada**:
   - Nome, Telefone, E-mail, Título do Evento  
   - Etapas (formato simplificado `dd/MM - HH:mm → HH:mm`)  
   - Ordem das etapas: **Ensaio → Montagem → Evento(s) → Desmontagem**  

---

## 📋 Rotas principais

### Backend
- `GET /api/forms-link` → retorna link do Forms  
- `POST /api/forms-link` → salva link do Forms  
- `GET /api/forms-respostas` → busca respostas da planilha vinculada  
- `GET /api/inscricoes` → retorna inscrições da etapa 1 (SQLite)  
- `POST /api/create-events` → cria eventos no Google Calendar + salva no banco  
- `DELETE /api/cancel-event/:local/:eventId` → remove evento  

### Frontend
- `/` → Formulário Etapa 1  
- `/admin` → Painel administrativo  

---

## ✅ Checklist de Implementação (v8)
- [x] Criar Google Forms de teste  
- [x] Admin com campo/link Forms e botão salvar  
- [x] Backend com rotas `/api/forms-link`  
- [x] App.jsx busca link dinâmico da Etapa 2  
- [x] Persistência SQLite (Etapa 1)  
- [x] Merge Etapa 1 + Etapa 2 por e-mail  
- [x] Exibição das etapas formatadas  
- [x] Coluna **Documentos** removida  
- [x] **Desmontagem sempre por último**  

---

## 🔮 Próximos Passos
- Filtros e busca no Admin  
- Exportar CSV/PDF da tabela  
- Autenticação no `/admin`  
- Paginação para grande volume de dados  
- Reativar coluna de documentos quando necessário  
