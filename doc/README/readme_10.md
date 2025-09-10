# **Sistema de Agendamento DAC**

Plataforma de agendamento integrada ao Google Calendar e Google Forms para gestão de eventos nos espaços **Teatro** e **Igrejinha**.

---

## **🚀 Funcionalidades**

### **Etapa 1 — Agendamento**

* Usuário escolhe local (**Teatro** ou **Igrejinha**) e insere seus dados.

* Seleciona períodos para **ensaio**, **montagem**, **desmontagem** e/ou eventos extras.

* O sistema:

  * Cria eventos no **Google Calendar** do espaço selecionado.

  * Salva a inscrição em banco local **SQLite**.

  * Envia **e-mail de confirmação** automático ao solicitante.

* Ao finalizar, libera o link da **Etapa 2**.

### **Etapa 2 — Formulário complementar**

* O usuário é direcionado a um **Google Forms** (configurado em `config.json`).

* Pode anexar documentos e preencher dados adicionais.

* Respostas são salvas em uma **planilha do Google Sheets** vinculada ao Forms.

### **Painel Administrativo**

* Visualização centralizada das **inscrições da Etapa 1** (SQLite).

* Acesso às **respostas do Forms (Etapa 2\)**.

* Exibição de **links de anexos**:

  * 🔗 Link original no Drive.

  * ⬇️ Link direto para download.

* Consulta aos **eventos agendados** nos calendários.

---

## **🗂️ Estrutura do Projeto**

`📦 projeto`

 `┣ 📜 server.js          # Backend Node.js (Express)`

 `┣ 📜 App.jsx            # Frontend React (Etapa 1)`

 `┣ 📜 Admin.jsx          # Painel Administrativo`

 `┣ 📜 config.json        # Link configurável do Google Forms`

 `┣ 📜 inscricoes.db      # Banco SQLite`

 `┣ 📜 credentials.json   # Credenciais do Service Account Google`

 `┗ 📜 .env               # Variáveis de ambiente`

---

## **⚙️ Configuração**

### **1\. Credenciais Google**

1. Criar um **Service Account** no Google Cloud.

2. Ativar APIs:

   * Google Calendar

   * Google Drive

   * Google Sheets

3. Baixar o `credentials.json`.

Compartilhar os calendários com o e-mail do service account:

 `agendamento-dac-service@agendamento-dac.iam.gserviceaccount.com`

4.  com permissão de **"Fazer alterações nos eventos"**.

### **2\. Banco de dados**

O backend cria automaticamente o arquivo `inscricoes.db` na primeira execução.

### **3\. Variáveis de ambiente (`.env`)**

`PORT=4000`

`EMAIL_USER=seu.email@gmail.com`

`EMAIL_PASS=sua-senha-ou-app-password`

`SHEET_ID=xxxxxxxxxxxxxxxxxxxxxxx`

`SHEET_RANGE=Respostas!A:Z`

---

## **▶️ Executando**

### **Backend**

`npm install`

`node server.js`

### **Frontend**

Dependendo de como estruturou (React, Vite ou CRA):

`npm run dev`

---

## **🔗 Rotas principais**

### **Backend**

* `GET /ical/:local/horarios` → Lista eventos ocupados do calendário (`teatro` ou `igrejinha`).

* `POST /api/create-events` → Cria eventos \+ salva inscrição \+ envia e-mail.

* `GET /api/forms-link` → Retorna link configurado do Forms.

* `POST /api/forms-link` → Atualiza link do Forms no `config.json`.

* `GET /api/inscricoes` → Lista inscrições (Etapa 1).

`GET /api/forms-respostas` → Lista respostas do Forms (Etapa 2), incluindo anexos:

 `{`

  `"Documento": {`

    `"url": "https://drive.google.com/file/d/FILE_ID/view?usp=sharing",`

    `"download": "https://drive.google.com/uc?export=download&id=FILE_ID"`

  `}`

`}`

* 

---

## **✅ Fluxo do Usuário**

1. Abre a aplicação e agenda evento (Etapa 1).

2. Recebe e-mail de confirmação.

3. Link da Etapa 2 é exibido → preenche Google Forms.

4. Administração acessa painel e acompanha:

   * Inscrições da Etapa 1 (SQLite).

   * Dados \+ anexos da Etapa 2 (Google Forms/Sheets).

---

## **📌 Observações**

* O cache de eventos atualiza a cada **5 minutos** via `cron`.

* O range atual do calendário busca **de hoje até \+2 meses**.

* Arquivos enviados via Forms aparecem no Admin com opção de:

  * Visualizar 🔗

  * Baixar ⬇️ direto

