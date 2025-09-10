# Documento de Análise do Site de Agendamento

Este documento descreve o site de agendamento fornecido, localizado no caminho `C:\agendamento-site`, detalhando sua estrutura, funcionalidades e tecnologias utilizadas.

## 1. Visão Geral do Projeto

O projeto consiste em uma aplicação web desenvolvida para gerenciar agendamentos, especificamente para os espaços de 'Teatro' e 'Igrejinha'. Ele é composto por um frontend (interface do usuário) e um backend (servidor) que interagem para fornecer as funcionalidades de consulta e registro de agendamentos.

## 2. Estrutura do Projeto

A estrutura de diretórios do projeto é a seguinte:

```
agendamento-site/
├── backend/             # Contém o código do servidor (Node.js/Express)
│   ├── node_modules/
│   ├── package-lock.json
│   ├── package.json
│   └── server.js
├── backup/              # Diretório de backup (conteúdo não analisado em detalhes)
├── basic.ics            # Arquivo iCalendar básico
├── doc/                 # Documentação e arquivos auxiliares
│   ├── App_confirma_etapas/
│   ├── App_confirma_etapas.zip
│   ├── C.txt
│   ├── CALENDARIOS.txt
│   ├── DEPENDÊNCIAS.txt
│   ├── agendamento-site-completo/
│   └── agendamento-site-completo.zip
├── eslint.config.js     # Configuração do ESLint
├── index.html           # Ponto de entrada do frontend (HTML)
├── node_modules/        # Módulos Node.js do frontend
└── package-lock.json    # Lock file de dependências do frontend
```

## 3. Tecnologias Utilizadas

Com base na análise dos arquivos, as principais tecnologias identificadas são:

*   **Frontend:**
    *   **React:** Indicado pela presença de `index.html` apontando para `src/main.jsx` e pela menção de `react-router-dom` no arquivo `DEPENDÊNCIAS.txt`.
    *   **Vite:** O `index.html` menciona `Vite + React` no título, sugerindo que Vite é o bundler utilizado.
    *   **date-fns** e **date-fns-tz:** Bibliotecas para manipulação de datas e fusos horários, conforme `DEPENDÊNCIAS.txt`.
*   **Backend:**
    *   **Node.js:** Ambiente de execução do servidor.
    *   **Express.js:** Framework web para construção da API, conforme `server.js`.
    *   **CORS:** Configurado para permitir requisições de diferentes origens.
    *   **Google Calendar API:** Utilizada para buscar eventos e horários de calendários específicos.

## 4. Funcionalidades do Backend (`server.js`)

O servidor backend, implementado em `server.js`, expõe as seguintes rotas e funcionalidades:

### 4.1. Consulta de Horários (`GET /ical/:local/horarios`)

*   **Propósito:** Permite consultar a disponibilidade de horários para os espaços 'Teatro' e 'Igrejinha' diretamente do Google Calendar.
*   **Parâmetros:**
    *   `:local`: Indica o calendário a ser consultado ('teatro' ou 'igrejinha').
    *   `timeMin` (query parameter): Data e hora mínima para a busca de eventos (formato ISO 8601). Se não fornecido, usa a data e hora atual.
    *   `timeMax` (query parameter): Data e hora máxima para a busca de eventos (formato ISO 8601).
*   **Funcionamento:**
    1.  Recebe o `local` e os parâmetros de tempo.
    2.  Mapeia o `local` para um `calendarId` específico do Google Calendar.
    3.  Constrói uma URL para a API do Google Calendar, incluindo a `apiKey` (observação: a chave da API está exposta no código, o que representa um risco de segurança).
    4.  Faz uma requisição `fetch` para a API do Google Calendar.
    5.  Processa a resposta, extraindo os horários de início e fim dos eventos e os organiza por data.
    6.  Retorna um objeto JSON com os horários disponíveis para cada data.

### 4.2. Recebimento de Agendamentos (`POST /api/agendamentos`)

*   **Propósito:** Receber dados de agendamento enviados pelo frontend.
*   **Corpo da Requisição:** Espera um objeto JSON contendo os `dadosDoAgendamento`.
*   **Funcionamento:**
    1.  Recebe os dados de agendamento no corpo da requisição.
    2.  Atualmente, apenas loga os dados recebidos no console do servidor e retorna uma mensagem de sucesso.
    3.  **Observação:** O código inclui comentários indicando que, em uma implementação completa, essa rota seria responsável por salvar os dados em um banco de dados ou processá-los de outra forma.

## 5. Funcionalidades do Frontend

Embora o código do frontend não tenha sido executado, a análise dos arquivos e dependências sugere as seguintes funcionalidades:

*   **Interface de Usuário:** Uma aplicação React que permite aos usuários interagir com o sistema de agendamento.
*   **Navegação:** Utiliza `react-router-dom` para gerenciar as rotas e a navegação entre diferentes seções da aplicação (ex: visualização de calendários, formulário de agendamento).
*   **Visualização de Calendário:** Provavelmente exibe os horários disponíveis para 'Teatro' e 'Igrejinha' obtidos do backend, permitindo que os usuários vejam os períodos ocupados.
*   **Formulário de Agendamento:** Permite que os usuários preencham informações para solicitar um agendamento, que seriam então enviadas para a rota `POST /api/agendamentos` do backend.
*   **Manipulação de Datas:** Utiliza `date-fns` e `date-fns-tz` para formatar, exibir e manipular datas e horários de forma consistente, considerando fusos horários.

## 6. Observações e Melhorias Potenciais

*   **Segurança da API Key:** A chave da API do Google Calendar está exposta diretamente no código do `server.js`. Para um ambiente de produção, é crucial que essa chave seja carregada de variáveis de ambiente e não seja versionada no controle de código-fonte.
*   **Persistência de Dados:** A rota `POST /api/agendamentos` atualmente não salva os dados de agendamento. Para que o sistema seja funcional, seria necessário integrar um banco de dados (SQL ou NoSQL) para armazenar os agendamentos de forma persistente.
*   **Autenticação e Autorização:** Não há indícios de um sistema de autenticação ou autorização. Em um cenário real, seria necessário controlar quem pode visualizar horários e, principalmente, quem pode fazer agendamentos.
*   **Validação de Agendamentos:** A lógica de agendamento no backend precisa incluir validações para garantir que os agendamentos não se sobreponham e que respeitem as regras de negócio (ex: horários de funcionamento, capacidade dos espaços).
*   **Notificações:** Um sistema de notificação (e-mail, SMS) para confirmar agendamentos ou alertar sobre mudanças seria uma funcionalidade valiosa.

Este documento fornece uma visão geral do site de agendamento com base nos arquivos fornecidos. Para uma análise mais aprofundada, seria necessário executar o frontend e interagir com a aplicação.

