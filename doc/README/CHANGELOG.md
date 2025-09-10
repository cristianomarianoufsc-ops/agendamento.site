# 📜 Changelog

Histórico de mudanças do sistema de agendamento e inscrições.

---

## 📌 V15
- Adicionada numeração de inscrição no painel administrativo.
- PDFs e arquivos ZIP agora incluem **primeiro nome + número da inscrição** no nome do arquivo.
- Limpar dados agora também **zera o contador de inscrições** (autoincrement no banco).
- Ajustado para não exibir mais "Nenhum outro anexo" no painel.
- Melhorias no endpoint de download de ZIP para suportar nomes personalizados.
- Manutenção geral e correções de bug.

---

## 📌 V14
- Melhorias na lógica de leitura do CSV.
- Tratamento de arquivos que estavam dentro do ZIP mas não apareciam individualmente no admin.
- Implementada busca robusta por `email` ou `telefone` para casar Etapa 1 e Etapa 2.
- Otimização da geração de PDFs, evitando duplicação de dados.
- Tratamento de anexos ausentes (não quebra o sistema).

---

## 📌 V13
- Atualização do README principal com passo a passo completo.
- Estrutura do projeto documentada (backend, frontend, variáveis de ambiente).
- Explicação de APIs usadas e fluxo de funcionamento.

---

## 📌 V12
- Implementada opção de baixar **todos os anexos em um único ZIP**.
- Adicionada visualização de anexos no admin via preview do Google Drive.
- Ajustes na geração de PDFs para exibir apenas campos preenchidos.

---

## 📌 V11
- Integração total com **Google Drive** para baixar anexos direto do servidor.
- Layout do painel admin atualizado para mostrar status da Etapa 2.
- Melhor tratamento de erros para links inválidos do Drive.

---

## 📌 V10
- Adicionado botão "Baixar PDF" direto no painel.
- Implementada visualização inline do PDF (abre em nova aba).
- Melhorias no parsing de datas/hora para exibição correta em português.

---

## 📌 V9
- Refatoração do backend para capturar dados do Forms via CSV.
- Removido acesso direto à API do Forms.
- Melhor compatibilidade com planilhas grandes.

---

## 📌 V8
- Documentação expandida com requisitos e configuração do `.env`.
- Explicação detalhada sobre Service Account, permissões e Google APIs.
- Adicionado checklist de verificação de instalação.

---

## 📌 V7
- Layout inicial do painel admin criado.
- Cadastro de Etapa 1 + Etapa 2 no banco SQLite.
- Exibição básica de inscrições.

---

## 📌 V6
- Primeira versão com geração automática de PDFs de inscrição.
- Inclusão de dados básicos (evento, local, datas).
- Integração inicial com Google Sheets.

---

## 📌 V5
- Implementação inicial do backend em Node.js + Express.
- Integração com Google Calendar API.
- Banco SQLite criado automaticamente.
- Agendamento e cache de eventos.

---

## 📌 V4
- Configuração inicial do frontend em React.
- Estruturação de rotas, componentes base e modal.

---

## 📌 V3
- Adicionado salvamento de inscrições no banco local.
- Persistência entre reinícios do servidor.
- Primeiros testes de integração com Google Sheets.

---

## 📌 V2
- Estrutura inicial do servidor criada.
- Endpoints básicos (`/api/create-events`, `/api/inscricoes`).
- Conexão com Google Calendar validada.

---

## 📌 V1
- Criação do projeto.
- Setup inicial de Node.js e dependências.
- Estrutura mínima de pastas.
