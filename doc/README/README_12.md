# Sistema de Inscrições com Integração Google Calendar + Forms + PDF

## 📌 Visão Geral
Este projeto implementa um sistema de **inscrições para uso de espaços culturais** (ex: teatro, igrejinha).  
O fluxo de inscrição é dividido em **duas etapas**:

1. **Etapa 1 (Site / Backend / Google Calendar)**  
   - O usuário seleciona local, datas e horários de **ensaio, montagem, eventos, desmontagem**.  
   - O backend registra essas informações no **SQLite** e também cria eventos no **Google Calendar** do local correspondente.  

2. **Etapa 2 (Google Forms / Google Sheets)**  
   - O usuário preenche um **Google Forms** com informações adicionais (área/segmento, finalidade, anexos, etc).  
   - As respostas são gravadas em uma **planilha Google Sheets** vinculada ao Forms.  
   - Para garantir fidelidade total, o backend baixa essa planilha em **CSV via Google Drive API** e processa diretamente.  

3. **Geração do PDF**  
   - Quando um administrador abre uma inscrição no painel, o sistema junta:  
     - Dados da **Etapa 1** (SQLite + Google Calendar).  
     - Dados da **Etapa 2** (Google Forms → Google Sheets → CSV).  
   - Um PDF é gerado com **todas as informações**, incluindo campos que antes não apareciam (ex: `Área/Segmento`, `Finalidade da atividade artístico-cultural`).  

---

## 🏗 Arquitetura
- **Frontend (React)**  
  - Componente `App.jsx` → fluxo de inscrição.  
  - Componente `Admin.jsx` → painel administrativo, visualização de inscrições, links para PDF e anexos.  

- **Backend (Node.js + Express)**  
  - `server.js` gerencia rotas REST.  
  - Banco local: **SQLite** (`inscricoes.db`).  
  - Integrações com **Google Calendar**, **Google Sheets** e **Google Drive**.  
  - Geração de PDF com **PDFKit**.  

---

## ⚙️ Tecnologias Utilizadas
- **Frontend**: React, Tailwind, shadcn/ui (UI simplificada).  
- **Backend**: Node.js, Express, SQLite (better-sqlite3), PDFKit.  
- **Google APIs**: Calendar, Sheets, Drive.  
- **Outros**: nodemailer (emails), cron (atualização de cache de eventos).  
- **CSV**: `csv-parse` garante leitura confiável das respostas do Forms.  

---

## 🔑 Variáveis de Ambiente
Criar um arquivo `.env` na raiz do backend:

```ini
PORT=4000
EMAIL_USER=seu.email@gmail.com
EMAIL_PASS=sua-senha-ou-app-pass
SHEET_ID=xxxxxxxxxxxxxxxxxxxx  # não é usado diretamente, pois o config.json guarda o ID
SHEET_RANGE=A:ZZ
```

Além disso:  
- Arquivo `credentials.json` (chaves de serviço do Google).  
- Arquivo `config.json` (salvo pelo painel admin com link do Forms e Sheets).  

---

## 🚀 Como Rodar

### 1. Instalar dependências
```bash
# Backend
cd backend
npm install

# Frontend
cd frontend
npm install
```

### 2. Configurar credenciais Google
- Criar uma conta de serviço no Google Cloud.  
- Baixar `credentials.json` e colocar na pasta do backend.  
- Compartilhar a planilha e o calendário com o **email da conta de serviço**.  

### 3. Rodar o backend
```bash
cd backend
node server.js
```

### 4. Rodar o frontend
```bash
cd frontend
npm start
```

---

## 🔄 Fluxo Resumido
1. Usuário entra no site → faz Etapa 1 → reserva no Google Calendar.  
2. Usuário recebe link do Forms (Etapa 2).  
3. Admin acessa painel:  
   - Vê lista de inscrições (Etapa 1).  
   - Vê anexos enviados no Forms.  
   - Gera PDF completo (Etapa 1 + Etapa 2).  

---

## 📝 Pontos Importantes
- **CSV em vez de Sheets API** → garante que todos os campos do Forms sejam capturados corretamente no PDF.  
- **Banco SQLite** → armazena apenas a Etapa 1, garantindo persistência local e leveza.  
- **Painel Admin** → mostra status (se Etapa 2 foi preenchida), links para anexos e PDF.  

---

## 🚧 Próximos Passos
- Padronizar nomes de campos entre Etapa 1 e Etapa 2.  
- Implementar envio automático do PDF por email para o usuário.  
- Criar sistema de permissões no painel admin.  
- Migrar banco SQLite para PostgreSQL (se for para produção com múltiplos admins).  

---

## 📂 Estrutura do Projeto (simplificada)
```
/backend
  ├── server.js
  ├── inscricoes.db
  ├── credentials.json
  ├── config.json
  └── package.json

/frontend
  ├── src/
  │   ├── App.jsx
  │   ├── Admin.jsx
  │   └── modal.css
  └── package.json
```
