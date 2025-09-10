# 📌 Projeto: Sistema de Agendamento de Espaços Culturais (UFSC)

## 🏗️ Estrutura do Projeto

    📂 agendamento-site
    │
    ├── 📂 backend
    │   ├── server.js               # Servidor Node.js + Express + integração Google Calendar
    │   ├── package.json            # Dependências do backend
    │   ├── .env                    # Variáveis de ambiente (PORT...)
    │   ├── agendamento-xxxx.json   # Credenciais da Service Account (Google Cloud)
    │
    ├── 📂 frontend
    │   ├── 📂 src
    │   │   ├── App.jsx             # Lógica principal React (seleção, etapas, envio EmailJS)
    │   │   ├── index.jsx           # Entrada principal React
    │   │   ├── 📂 components
    │   │   │   ├── Calendar.jsx    # Componente de calendário com dias ocupados/livres
    │   │   │   ├── TimeBlockSelector.jsx # Seleção de horários por etapa
    │   │   └── ...                 # Outros arquivos React
    │   ├── package.json            # Dependências do frontend
    │
    └── README.md                   # Documentação do projeto

------------------------------------------------------------------------

## 📖 Resumo do que foi feito até agora

### 1. **Backend (Node.js + Express + Google Calendar)**

-   Integração via **Service Account** com o Google Calendar.
-   Eventos listados e cacheados para exibir disponibilidade no
    frontend.
-   Rota `/api/create-events` cria eventos no calendário e retorna seus
    `id` e `htmlLink`.
-   **NOVO:**
    -   Criada rota `DELETE /api/cancel-event/:local/:eventId`, que
        remove o evento diretamente do Google Calendar.\
    -   Cache atualizado automaticamente após remoção.

### 2. **Frontend (React + Vite + Tailwind)**

-   Passos de agendamento: seleção do local → etapas → data/hora →
    resumo.
-   Integração com **EmailJS** para enviar confirmação ao usuário e ao
    DAC.
-   Após confirmação, eventos são criados no Google Calendar.
-   **NOVO:**
    -   O `App.jsx` agora salva no `resumo` os `eventId` e `eventLink`
        retornados pelo backend.\
    -   Botão **Remover** usa o `handleRemoveStage` que:
        -   Apaga do estado local.\
        -   Chama o backend para deletar o evento real no Google
            Calendar.

### 3. **Fluxo completo**

1.  Usuário agenda etapas → salva no resumo.\
2.  Confirma → dispara e-mail (EmailJS) + cria eventos no calendário
    (via backend).\
3.  Eventos ficam **bloqueados** no calendário compartilhado.\
4.  Se clicar em **Remover**, o evento também é **cancelado no Google
    Calendar**.

------------------------------------------------------------------------

## ✅ Status atual (Agosto 2025)

-   Backend funcionando com criação e cancelamento de eventos.\
-   Frontend integrado com EmailJS + Google Calendar.\
-   Eventos criados já retornam `eventId` + `htmlLink`.\
-   Botão Remover cancela no calendário real.

------------------------------------------------------------------------

## 🚀 Próximos passos sugeridos

1.  **Validações extras no frontend**:
    -   Impedir sobreposição antes de enviar.\
    -   Alertar caso usuário tente remover evento já inexistente.\
2.  **Persistência opcional em banco de dados** para manter histórico de
    solicitações.\
3.  **Painel administrativo** para equipe DAC aprovar/rejeitar
    reservas.\
4.  **Autenticação diferenciada** entre usuários públicos e equipe DAC.\
5.  **Melhorar feedback visual** no frontend (mostrar links dos eventos
    criados, status de cancelamento).

------------------------------------------------------------------------

📌 Agora temos um **MVP funcional e bidirecional**: o sistema cria e
também cancela eventos no Google Calendar, mantendo o calendário sempre
sincronizado com as ações do usuário.
