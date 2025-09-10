# Sistema de Inscrições e Agendamento

## 🚀 Visão Geral

Este sistema integra **Google Forms + Google Sheets + Google Calendar**
para gerenciar inscrições de eventos.\
Ele funciona em duas etapas: 1. **Etapa 1:** Usuário preenche dados
básicos e agenda horários disponíveis (bloqueados automaticamente no
Google Calendar).\
2. **Etapa 2:** Usuário é redirecionado para um Google Forms configurado
no **painel administrativo** para fornecer informações adicionais.

O administrador pode:\
- Configurar facilmente o link do **Forms** e do **Sheets** direto pelo
painel (sem editar arquivos manualmente).\
- Visualizar todas as inscrições.\
- Baixar anexos enviados via Forms.\
- Gerar PDFs personalizados de cada inscrição.\
- Receber notificações por e-mail.

------------------------------------------------------------------------

## 👩‍💻 Instruções para Usuários (Passo a Passo)

### 1. Instalação inicial

1.  Instale o **Node.js** (versão 18+).\

2.  Baixe o projeto.\

3.  No terminal, instale as dependências:

    ``` bash
    npm install
    ```

### 2. Configuração do Google API

1.  Acesse o [Google Cloud Console](https://console.cloud.google.com/).\
2.  Ative as APIs:
    -   Google Calendar API\
    -   Google Sheets API\
    -   Google Drive API\
3.  Gere as credenciais (`credentials.json`) e salve na raiz do backend.

### 3. Configuração do `.env`

Crie um arquivo `.env` na raiz do backend:

``` ini
PORT=4000

# Google Sheets
SHEET_ID=
SHEET_RANGE="Respostas ao formulário!A:Z"

# E-mail
EMAIL_USER=seuemail@gmail.com
EMAIL_PASS=suasenhaouapppassword
```

⚠️ **Importante:** O **SHEET_ID** agora é gerenciado automaticamente
pelo sistema. Você só precisa inserir o link do Forms/Sheets no painel
admin.

### 4. Rodando o sistema

Backend:

``` bash
node server.js
```

Frontend:

``` bash
npm run dev
```

O sistema ficará disponível em: - Frontend → `http://localhost:5173` -
Backend → `http://localhost:4000`

### 5. Usando o Painel Admin

1.  Acesse o **painel admin** no frontend.\
2.  Cole o link do Google Forms e o link da planilha de respostas
    (Sheets).\
3.  Clique em salvar → o sistema extrai automaticamente o `sheetId` e
    configura tudo.\
4.  A partir de agora, qualquer inscrição feita será salva no banco,
    vinculada ao Forms e com bloqueio automático no calendário.

------------------------------------------------------------------------

## 👨‍💻 Instruções Técnicas para Devs

### 📂 Estrutura do Projeto

-   **server.js** → Backend Node.js com Express\
-   **Admin.jsx** → Painel administrativo (frontend React)\
-   **inscricoes.db** → Banco SQLite com inscrições da etapa 1\
-   **config.json** → Configuração dinâmica de links Forms/Sheets

### 🌐 Rotas API

-   `GET /ical/:local/horarios` → Busca eventos do calendário Google.\
-   `POST /api/create-events` → Cria eventos no Google Calendar e salva
    inscrição no banco.\
-   `GET /api/forms-link` → Retorna link salvo no painel admin.\
-   `POST /api/forms-link` → Salva link Forms/Sheets.\
-   `GET /api/inscricoes` → Lista todas as inscrições salvas (etapa 1).\
-   `GET /api/forms-respostas` → Lista respostas do Google Forms (etapa
    2).\
-   `GET /api/download-drive/:fileId` → Baixa anexos do Forms via Google
    Drive.\
-   `GET /api/gerar-pdf/:inscricaoId` → Gera PDF da inscrição (etapa 1 +
    etapa 2).

### 🗄️ Banco de Dados (SQLite)

Tabela: `inscricoes` - id, nome, email, telefone\
- evento_nome, local\
- ensaio_inicio, ensaio_fim\
- montagem_inicio, montagem_fim\
- desmontagem_inicio, desmontagem_fim\
- eventos_json (eventos extras)\
- criado_em

### 📧 E-mails Automáticos

Após a inscrição (etapa 1), o sistema envia e-mail automático de
confirmação para o usuário.

------------------------------------------------------------------------

## ✅ Funcionalidades

-   Painel admin simples para configuração.\
-   Integração com **Google Calendar** para bloqueio automático de
    horários.\
-   Integração com **Google Forms + Sheets**.\
-   Armazenamento local em SQLite.\
-   Geração de **PDFs personalizados**.\
-   Download seguro de anexos do Google Drive.\
-   Envio automático de e-mails.

------------------------------------------------------------------------

## 📝 Observações

-   É necessário compartilhar o Google Sheets com o e-mail do serviço
    (do `credentials.json`).\
-   Se mudar o Forms, lembre-se de atualizar o link no painel admin.\
-   O sistema já faz a extração do **sheetId** automaticamente → não é
    mais preciso editar manualmente o `.env`.

------------------------------------------------------------------------

Desenvolvido com ❤️ para facilitar inscrições e agendamentos.
