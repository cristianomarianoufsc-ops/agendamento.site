# 📌 Sistema de Agendamento e Inscrições

Este projeto é um sistema para gerenciar inscrições e agendamentos de
eventos a partir de formulários do **Google Forms** e planilhas do
**Google Sheets**.\
Ele conta com: - Painel Administrativo para visualizar inscrições. -
Integração com **Google Calendar** para criação de eventos. - Download e
visualização de anexos do **Google Drive**. - Geração automática de
**ficha de inscrição em PDF**. - Download individual ou em **ZIP** de
todos os anexos de uma inscrição.

------------------------------------------------------------------------

## 🚀 Tecnologias Usadas

-   **Frontend:** React + Vite\
-   **Backend:** Node.js (Express)\
-   **Banco de Dados:** SQLite\
-   **APIs Google:** Drive, Sheets, Calendar\
-   **Bibliotecas Extras:**
    -   `pdfkit` → gerar PDFs\
    -   `nodemailer` → envio de e-mails\
    -   `archiver` → criar arquivos ZIP

------------------------------------------------------------------------

## ⚙️ Configuração do Projeto

### 1. Clonar repositório

``` bash
git clone https://github.com/seu-repositorio/agendamento-site.git
cd agendamento-site
```

### 2. Instalar dependências

Backend:

``` bash
cd backend
npm install
```

Frontend:

``` bash
cd frontend
npm install
```

------------------------------------------------------------------------

## 🔑 Variáveis de Ambiente

Crie um arquivo `.env` no **backend** com os seguintes dados:

``` env
PORT=4000

# Google Sheets
SHEET_RANGE=A:ZZ

# Gmail (envio de e-mails automáticos)
EMAIL_USER=seuemail@gmail.com
EMAIL_PASS=sua-senha-app-google
```

Além disso, é necessário o arquivo **credentials.json** com as
credenciais do projeto do Google Cloud (API habilitada para Sheets,
Drive e Calendar).

------------------------------------------------------------------------

## ▶️ Executando o Projeto

### Backend

``` bash
cd backend
npm run dev
```

O backend ficará disponível em:\
📍 `http://localhost:4000`

### Frontend

``` bash
cd frontend
npm run dev
```

O frontend ficará disponível em:\
📍 `http://localhost:5173`

------------------------------------------------------------------------

## 📋 Funcionalidades

### Painel Administrativo

-   Inserir link do **Google Forms** e da **Planilha de Respostas
    (Sheets)**.\
-   Ver lista de inscrições, etapas (ensaio, montagem, evento,
    desmontagem).\
-   Acessar contatos de cada inscrito via pop-up.

### Anexos

-   **Visualizar** anexos diretamente pelo Google Drive (`preview`).\
-   **Baixar** anexos individualmente do servidor.\
-   **Baixar Todos** anexos em um arquivo **ZIP** com um clique.

### PDF da Inscrição

-   Gerado automaticamente com:
    -   Dados básicos (título, local, etapas).\
    -   Respostas do Forms (somente campos preenchidos).\
    -   Sem duplicações de dados já exibidos no início.\
-   Opções:
    -   👁️ **Visualizar PDF** (abre em nova aba).\
    -   ⬇️ **Baixar PDF**.

------------------------------------------------------------------------

## 📦 Estrutura do Projeto

    /backend
      ├── server.js        # API principal
      ├── inscricoes.db    # Banco SQLite
      ├── credentials.json # Credenciais Google
      └── .env             # Configurações

    /frontend
      ├── src
      │   ├── Admin.jsx    # Painel Administrativo
      │   ├── App.jsx
      │   └── modal.css
      └── index.html

------------------------------------------------------------------------

## ✅ Fluxo de Uso

1.  Inserir links do Google Forms e Google Sheets no painel admin.\
2.  Usuários enviam respostas pelo Forms.\
3.  As inscrições aparecem automaticamente no painel.\
4.  O administrador pode:
    -   Consultar etapas e contatos.\
    -   Baixar anexos individualmente ou todos juntos em ZIP.\
    -   Gerar e visualizar PDFs de inscrição.\
    -   Conferir compatibilidade entre Etapa 1 e Etapa 2.

------------------------------------------------------------------------

📌 **Observação**: Para cada novo Forms usado, é preciso compartilhar a
planilha de respostas com o e-mail de serviço configurado no
**credentials.json** (exemplo:
`agendamento-dac-service@xxxx.iam.gserviceaccount.com`).
