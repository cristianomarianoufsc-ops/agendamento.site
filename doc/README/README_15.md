# 📌 Projeto: Sistema de Agendamento de Espaços Culturais (UFSC)

## 🏗️ Estrutura do Projeto

    📂 agendamento-site
    │
    ├── 📂 backend
    │   ├── server.js               # Servidor Node.js + Express + integração Google Calendar + GDrive + PDF + ZIP
    │   ├── package.json            # Dependências do backend
    │   ├── .env                    # Variáveis de ambiente (PORT, credenciais, etc)
    │   ├── agendamento-xxxx.json   # Credenciais da Service Account (Google Cloud)
    │   ├── inscricoes.db           # Banco SQLite para inscrições
    │
    ├── 📂 frontend
    │   ├── 📂 src
    │   │   ├── App.jsx             # Lógica principal React (seleção, etapas, envio EmailJS)
    │   │   ├── index.jsx           # Entrada principal React
    │   │   ├── 📂 components
    │   │   │   ├── Calendar.jsx    # Componente de calendário com dias ocupados/livres
    │   │   │   ├── TimeBlockSelector.jsx # Seleção de horários por etapa
    │   │   │   ├── Admin.jsx       # Painel administrativo (visualização de inscrições)
    │   │   └── ...                 # Outros componentes React
    │   ├── package.json            # Dependências do frontend
    │
    └── README.md                   # Documentação do projeto

---

## 📖 Resumo da Evolução (V1 → V15)

### 🔢 V1 a V3 – MVP de Agendamento
- Integração inicial com Google Calendar via **Service Account**.
- Frontend com seleção de local, etapas e horários.
- Criação de eventos no calendário ao confirmar.
- Integração com **EmailJS** para confirmação ao usuário e DAC.

### 🆕 V4 – Cancelamento de Eventos
- Criada rota `DELETE /api/cancel-event/:local/:eventId`.
- Cache de eventos atualizado automaticamente após remoção.
- Botão **Remover** no frontend remove do estado local e do Google Calendar.

### 📑 V5 – Painel Administrativo (Etapa 1)
- Tabela de inscrições exibindo eventos criados.
- Integração inicial com banco **SQLite** para persistência.
- Listagem de inscrições na tela do Admin.

### 📑 V6 – Integração com Google Sheets (Etapa 2)
- Backend lê planilha de respostas (CSV exportado via API).
- Unificação de dados da Etapa 1 (SQLite) com Etapa 2 (Google Forms).
- Exibição de status **validado** (✓/✗) no painel.

### 📑 V7 – Uploads e Anexos
- Suporte a links do Google Drive nos formulários.
- Download individual de anexos no Admin.
- Geração de **ZIP** com PDF da inscrição + anexos.

### ⚙️ V8 – Melhorias de UI/UX
- Painel com tabela responsiva.
- Botões de ação para excluir inscrição e abrir modal de contatos.
- Feedback visual para status de validação.

### 📑 V9 – Geração de PDF no Backend
- Criação de rota `/api/gerar-pdf/:id` para visualizar PDF de cada inscrição.
- Botão no painel para visualizar/baixar PDF.

### 📦 V10 – Download em Massa
- Rota `/api/download-all-zips` para baixar **todas as inscrições** em um único ZIP.

### 🔄 V11 – Limpeza de Dados
- Botão "🧨 Limpar dados" no painel para:
  - Excluir inscrições do banco.
  - Resetar autoincrement (contador volta ao zero).
  - Apagar anexos do Google Drive.

### 🔢 V12 – Numeração de Inscrições no Painel
- Coluna extra com numeração sequencial (01, 02, 03...).
- Numeração reseta ao usar botão de limpeza.

### 📝 V13 – Melhorias no PDF
- PDFs passam a incluir nome do inscrito e número da inscrição no nome do arquivo.
- Exemplo: `Cristiano - inscricao - 01.pdf`

### 📦 V14 – Nome Personalizado no ZIP
- Mesma lógica do PDF aplicada aos arquivos ZIP.
- Exemplo: `Cristiano - inscricao - 01.zip`

### 📚 V15 – Documentação Atualizada
- Consolidado histórico de versões no **README** e **CHANGELOG**.
- Melhor organização da descrição de endpoints e funcionalidades.
- Padronização do formato de nomes de arquivos.

---

## ✅ Status Atual (Setembro 2025)
- **Criação, visualização e cancelamento** de eventos funcionando.
- **PDFs e ZIPs personalizados** com nome do inscrito e número.
- **Painel administrativo completo** (tabela, modal de contatos, exclusão).
- **Botão de limpeza total** resetando banco e anexos.
- **Unificação Etapa 1 + Etapa 2** funcionando para validação.

---

## 🚀 Próximos Passos
1. Autenticação para separar usuários comuns e administradores.
2. Filtros e busca no painel administrativo.
3. Paginação para listas de inscrições extensas.
4. Interface de configuração de e-mails.
5. Deploy em servidor oficial da UFSC.

---

📌 Agora o sistema está **completo e pronto para produção**, com geração de PDFs, anexos, ZIPs e painel administrativo robusto.

