
# 📌 Sistema de Inscrições – Backend + Painel Administrativo (v14)

Este projeto integra **Google Calendar**, **Google Forms/Sheets** e **Google Drive** para gerenciar reservas de espaços e inscrições de eventos.  
Os dados da primeira etapa ficam no **SQLite**; as respostas (etapa 2) vêm do **Google Forms/Sheets**; e os anexos são baixados do **Google Drive**.  
Inclui geração de **PDF**, **download em ZIP** (individual e geral) e **limpeza automática** de anexos antigos. Nesta versão, o botão manual foi renomeado para **“Limpar dados”** (e pode até ser ocultado do painel).

---

## 🔧 Arquitetura (resumo)

- **Node.js/Express** (backend)
- **better-sqlite3** (banco local `inscricoes.db`)
- **googleapis** (Calendar, Drive e Sheets – service account)
- **pdfkit** (gera PDFs das inscrições)
- **archiver** (gera arquivos `.zip`)
- **node-cron** (tarefas automáticas – cache e limpeza)
- **React** (Painel administrativo)

---

## 📂 Fluxo principal

1. **Etapa 1 (Admin/Usuário)** – cria eventos no **Google Calendar**, e salva a inscrição (nome, e-mail, telefone, local, etapas) em `SQLite`.
2. **Etapa 2 (Forms)** – a pessoa preenche o **Google Forms**; as respostas vão para o **Google Sheets** (incluindo **links de anexos** enviados ao Forms/Drive).
3. **Admin** – unifica Etapa 1 + Etapa 2 por **e‑mail** ou **telefone**; mostra status, contatos, anexos e oferece **downloads** (PDF/ZIP).
4. **Downloads** – PDF individual com dados combinados; ZIP por inscrição (PDF + anexos do Drive); ZIP geral (todas as inscrições com seus PDFs).
5. **Limpeza automática** – remove anexos de inscrições muito antigas (padrão: **>18 meses**), mantendo a inscrição no banco. Há também o botão manual **“Limpar dados”** (opcional).

---

## 📦 Instalação

```bash
# Node 18+ recomendado
npm install
npm run dev   # ou: node server.js
```

Crie o arquivo **`credentials.json`** (service account do Google) na raiz do backend, e o **`.env`** (veja modelo abaixo).

### `.env` (exemplo)

```env
PORT=4000
EMAIL_USER=sua-conta@gmail.com
EMAIL_PASS=senha-ou-app-password
SHEET_RANGE=A:ZZ
# Limpeza: "simulate" (log) ou "delete" (apaga de fato)
CLEANUP_MODE=simulate
```

> ⚠️ Compartilhe os **calendários** e o **arquivo/planilha do Drive** com o **e‑mail da service account** (de `credentials.json`), pelo menos com **permissão de leitura** (para baixar) e **edição** no Calendar (para criar eventos).

---

## 🗄️ Banco de dados (`inscricoes.db`)

Criado automaticamente (better-sqlite3). Tabela:

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
  eventos_json TEXT,              -- eventos extras (lista JSON)
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

> Para ~**40 inscrições/ano**, o tamanho do banco é **muito pequeno** (alguns MB ao longo de muitos anos). Os anexos **não** são salvos localmente; vêm do Google Drive.

---

## ⚙️ Configuração no Painel

No Painel Administrativo:
1. Cole o **link do Google Forms** e o **link da Planilha do Google Sheets**.
2. Clique em **Salvar Configurações**.  
   O backend extrai e guarda `sheetId` no `config.json`.

---

## 🧭 Endpoints (principais)

### ▶️ Operacional
- `POST /api/create-events`  
  Cria os eventos no **Google Calendar** e grava a inscrição (Etapa 1) em `SQLite`.
  
- `GET /ical/:local/horarios`  
  Retorna eventos **em cache** por local (cache auto‑atualizado a cada **5 minutos**).

### 📥 Downloads & Relatórios
- `GET /api/gerar-pdf/:id`  
  Gera **PDF** de uma inscrição (Etapa 1 + Etapa 2).  
  Use `?download=true` para baixar.

- `GET /api/download-zip/:id`  
  Baixa **ZIP** de **uma** inscrição contendo:  
  `inscricao-<id>.pdf` + **anexos** do Forms (baixados do Drive via ID).

- `GET /api/download-all-zips`  
  Baixa **ZIP** com **todas** as inscrições. Para cada inscrição é gerado um PDF.

> 🔎 O backend tenta exportar o **CSV** de respostas via Drive API (mais completo); se falhar, usa a **Sheets API** como fallback.

### 🧹 Limpeza de anexos
- **Automática**: um cron roda **mensalmente** (`0 0 1 * *`) e procura anexos de inscrições com mais de **18 meses**. A ação (simular/apagar) depende de `CLEANUP_MODE` (`simulate` ou `delete`).  
- **Manual**: `POST /api/cleanup` (acionado pelo botão **“Limpar dados”**, se você mantiver esse botão no painel).  
  - O botão é **opcional**; você pode ocultá‑lo e deixar só o cron.

### 🔧 Configurações e dados
- `GET /api/forms-link` / `POST /api/forms-link` – lê/salva `formsLink`, `sheetLink` e `sheetId`.
- `GET /api/inscricoes` – lista as inscrições, sinalizando se a Etapa 2 foi encontrada e expondo contatos e anexos (dos últimos registros do Forms).  
- `DELETE /api/inscricoes/:id` – remove uma inscrição do banco (não mexe nos anexos do Drive).

---

## 🖥️ Painel Administrativo (React)

Para cada inscrição:
- **Status** ✅/❌ (se casou com registro no Forms por e‑mail/telefone);
- **Visualizar/baixar PDF** gerado pelo backend;
- **Anexos**: links **Visualizar** (preview do Drive) e **Baixar**;  
  também existe um botão **“Baixar todos em ZIP”** que chama `GET /api/download-zip/:id`.
- **Contatos** (modal) consolidando e‑mails e telefones encontrados;
- **Excluir** inscrição (apenas banco);
- **Baixar todos os PDFs em ZIP** (topo da tela) → `GET /api/download-all-zips`.

### “Limpar dados” (opcional)
- Botão que chama `POST /api/cleanup` (**manual**).  
- Pode ser removido do JSX sem afetar o cron automático.

---

## ♻️ Como funciona a limpeza

1. O backend lê `config.json` → `sheetId` e varre as respostas do Forms (CSV do Drive; fallback Sheets).  
2. Para cada inscrição antiga, tenta localizar os **IDs de arquivo** presentes nas respostas (qualquer coluna com `drive.google.com`).  
3. Se `CLEANUP_MODE=delete`, executa `drive.files.delete({ fileId })`.  
   Caso contrário, apenas **loga** que teria deletado.  
4. A inscrição **permanece no banco**; somente os **anexos** são afetados.

> 🔄 Os **links** dos anexos ainda podem **aparecer** no painel (pois vêm da planilha). Ao tentar baixar, os arquivos **não existirão** mais. Isso é esperado. Se quiser, você pode ajustar o frontend para “esconder” anexos cujo `fileId` retorne erro 404.

---

## 🛠️ Dicas & Solução de Problemas

- **“Identifier 'cron' has already been declared”**  
  Remova **imports duplicados**; deixe apenas:
  ```js
  import cron from "node-cron";
  ```

- **Drive apagou, mas ZIP ainda traz anexos?**  
  O ZIP **não** guarda cache no servidor; ele tenta baixar do Drive **no momento** da requisição.  
  Se o arquivo foi apagado, a tentativa falha e o item é **ignorado** (pode restar somente o PDF).  
  No Windows, o **Explorador** pode mostrar **pré‑vias** vindas da pasta **Temp** do navegador; isso **não** significa que o arquivo ainda existe no Drive.

- **Permissões do service account**  
  Compartilhe **Calendars**, **Sheets** e/ou as **pastas/arquivos** do Drive com o e‑mail da service account.

- **Fuso horário**  
  Ao criar eventos, usamos `America/Sao_Paulo`. O cron segue o **timezone do servidor**.

---

## 🧪 Testes rápidos (curl)

```bash
# Baixar zip de uma inscrição
curl -L http://localhost:4000/api/download-zip/1 --output inscricao-1.zip

# Baixar zip geral
curl -L http://localhost:4000/api/download-all-zips --output todas.zip

# Limpeza manual (se mantiver a rota exposta)
curl -X POST http://localhost:4000/api/cleanup
```

---

## 📝 Changelog

- **v14** – Renomeado botão para **“Limpar dados”**; README revisado; mantida limpeza automática (>18 meses).  
- **v13** – **Downloads**: ZIP por inscrição (`/api/download-zip/:id`) e ZIP geral (`/api/download-all-zips`).  
- **v12** – Base do painel + geração de PDF por inscrição e integração Calendar/Forms/Sheets.

---

## ✅ Checklist para produção

- [ ] `credentials.json` válido (APIs: Calendar, Sheets e Drive **ativadas**).  
- [ ] `config.json` salvo via painel (Forms/Sheets) → confere `sheetId`.  
- [ ] `.env` com `EMAIL_*`, `PORT`, `CLEANUP_MODE`.  
- [ ] Calendários/arquivos compartilhados com a **service account**.  
- [ ] Cron ativo no servidor (o processo Node precisa ficar rodando).

---

Feito com ❤️ para facilitar o fluxo de inscrições e uso de espaços.
