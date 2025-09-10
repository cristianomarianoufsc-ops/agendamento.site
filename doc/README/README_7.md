# 🎭 Sistema de Agendamento -- Espaços Culturais (Teatro e Igrejinha)

Este projeto é um sistema de **agendamento de eventos culturais**,
desenvolvido para gerenciar reservas no **Teatro Carmen Fossari** e na
**Igrejinha da UFSC**.\
Ele integra com o **Google Calendar** para criar, listar e cancelar
eventos de forma automática.

------------------------------------------------------------------------

## 🚀 Funcionalidades

✅ Seleção de **local** (Teatro ou Igrejinha)\
✅ Cadastro de **usuário** (nome, e-mail, telefone, nome do evento)\
✅ Agendamento dividido em etapas: - **Ensaio** (08:00 → até 16:30)\
- **Montagem** (até 22:00)\
- **Evento** (até 22:00, múltiplos permitidos)\
- **Desmontagem** (até 22:00)

✅ Respeita as **regras de horários máximos por etapa**\
✅ Bloqueia **sobreposição de horários** (do próprio usuário e do Google
Calendar)\
✅ Integração com **Google Calendar API**\
✅ Geração de **resumo em PDF** e opção de imprimir\
✅ Envio automático de **confirmação por e-mail (EmailJS)**\
✅ Cancelamento individual de etapas/eventos diretamente pelo resumo\
✅ Cache local dos eventos (atualizado a cada 5 minutos) para melhor
performance

------------------------------------------------------------------------

## 🛠️ Tecnologias Utilizadas

-   **Frontend**: React + TailwindCSS\
-   **Backend**: Node.js + Express\
-   **Banco de eventos**: Google Calendar API\
-   **Email**: EmailJS\
-   **PDF**: jsPDF + html2canvas\
-   **Outros**: cron (para atualização automática do cache), dotenv,
    body-parser

------------------------------------------------------------------------

## ⚙️ Como Rodar o Projeto

### 🔹 1. Clonar o repositório

``` bash
git clone https://github.com/seu-repo/agendamento.git
cd agendamento
```

### 🔹 2. Backend (Node.js)

1.  Vá até a pasta `backend`

2.  Crie um arquivo `.env` com:

    ``` env
    PORT=4000
    ```

3.  Coloque o arquivo da Service Account (Google Cloud) na raiz da pasta
    backend\
    Exemplo: `agendamento-teste-XXXX.json`

4.  Instale as dependências e inicie o servidor:

    ``` bash
    npm install
    npm start
    ```

### 🔹 3. Frontend (React)

1.  Vá até a pasta `frontend`

2.  Instale as dependências:

    ``` bash
    npm install
    npm start
    ```

O frontend estará em `http://localhost:3000`\
O backend em `http://localhost:4000`

------------------------------------------------------------------------

## 📌 Regras Importantes de Horário

-   **Ensaio**\
    ⏰ Pode começar às **08:00** e terminar no máximo às **16:30**

-   **Montagem, Evento, Desmontagem**\
    ⏰ Início até **21:00**\
    ⏰ Término até **22:00**

-   **Não é permitido sobrepor horários** entre etapas ou eventos.

------------------------------------------------------------------------

## 📬 Integração com o Google Calendar

-   Todos os eventos confirmados no frontend são enviados ao **Google
    Calendar** do local selecionado.\
-   Cada evento recebe o `eventId` do Google Calendar, permitindo
    **cancelamentos diretos pelo frontend**.\
-   O sistema mantém um **cache atualizado a cada 5 minutos** para
    garantir que a interface mostre horários ocupados corretamente.

------------------------------------------------------------------------

## 📄 Fluxo do Usuário

1.  Seleciona **local** (Teatro ou Igrejinha)\
2.  Preenche **dados do responsável**\
3.  Escolhe as **etapas do evento** (respeitando as regras de horário)\
4.  Confirma cada etapa → vai para o **Resumo da Solicitação**\
5.  Confirma a primeira etapa → eventos são enviados ao **Google
    Calendar**\
6.  Pode **remover individualmente** etapas/eventos, se necessário\
7.  Pode **gerar PDF** ou imprimir o resumo\
8.  Email de confirmação enviado via **EmailJS**

------------------------------------------------------------------------

## 🔧 Melhorias Futuras (sugestões)

-   Painel administrativo para visualização de todos os eventos em
    calendário\
-   Exportação direta para **Google Drive** junto com os PDFs\
-   Envio de lembrete automático por e-mail alguns dias antes do evento

------------------------------------------------------------------------

## 👨‍💻 Autores

Projeto desenvolvido em parceria para facilitar o agendamento de espaços
culturais da UFSC.
