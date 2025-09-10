# 📌 Projeto de Agendamento de Espaços Culturais (README 6)

Este documento descreve o estado atual do projeto após as últimas atualizações e implementações.

---

## 🚀 Funcionalidades Implementadas

### 1. Seleção de Local
- O usuário pode escolher entre **Teatro Carmen Fossari** e **Igrejinha da UFSC**.
- Após a seleção, o calendário é carregado com as datas e horários ocupados vindos do backend.

### 2. Fluxo de Etapas
- Etapas disponíveis: **ensaio, montagem, evento, desmontagem**.
- O usuário seleciona a etapa, a data e os horários desejados.
- As etapas são exibidas no **Resumo da Solicitação**.

### 3. Confirmação de Agendamento (1ª Etapa)
- O usuário insere seus **dados básicos** (nome, e-mail, telefone, nome do evento).
- É feita a validação do formulário.
- Ao confirmar:
  - Um **e-mail** é enviado via **EmailJS** com uma tabela em HTML contendo todas as etapas selecionadas.
  - Os eventos são enviados ao backend e cadastrados no **Google Calendar**.
  - IDs dos eventos são retornados pelo backend e armazenados no resumo (para futura exclusão).

### 4. Cancelamento de Etapas/Eventos
- O botão **"Remover"** agora **não apaga diretamente**.
- O item fica marcado em uma lista de **remoções pendentes**.
- Um bloco de confirmação aparece com a mensagem:
  > "Você marcou X item(ns) para remoção."
- Apenas ao clicar em **"Confirmar Cancelamento"**:
  - O evento/etapa é apagado do resumo.
  - É feita requisição `DELETE` para o backend.
  - O evento é apagado do **Google Calendar**.
  - Uma mensagem de sucesso ✅ é exibida.

### 5. Exportação de Resumo
- Implementada a geração de **PDF** com as informações da solicitação.
- Uso da lib **html2pdf.js** para conversão.
- Botões disponíveis:
  - **Gerar PDF**
  - **Imprimir**

### 6. Segunda Etapa
- Após concluir a primeira etapa, o sistema exibe mensagem de sucesso e permite avançar.
- A segunda etapa está preparada para futuras funcionalidades.

---

## 📂 Estrutura do Projeto
- **Frontend (React + Vite)**
  - `App.jsx`: fluxo principal do app
  - `Calendar.jsx`: seleção de datas
  - `TimeBlockSelector.jsx`: seleção de horários
- **Backend (Node.js + Express)**
  - `server.js`: integrações com Google Calendar (criação/cancelamento de eventos)

---

## 🔧 Tecnologias Utilizadas
- **React + Vite** (frontend)
- **TailwindCSS** (estilização)
- **Node.js + Express** (backend)
- **Google Calendar API** (agendamento real)
- **EmailJS** (envio de e-mails automáticos)
- **html2pdf.js** (geração de PDF)
- **html2canvas + jsPDF** (alternativa futura para PDF)

---

## ✅ Status Atual
- [x] Seleção de local
- [x] Exibição de horários ocupados
- [x] Seleção e resumo de etapas
- [x] Envio de e-mail com tabela
- [x] Geração de PDF
- [x] Integração com Google Calendar (criação e remoção)
- [x] Cancelamento com confirmação
- [x] Estrutura para segunda etapa

---

## 📌 Próximos Passos
- Melhorar UX da tela de confirmação de cancelamento
- Adicionar histórico de agendamentos
- Implementar funções da **Segunda Etapa**
- Revisar uso do **html2pdf.js** (avaliar substituição por `jsPDF + html2canvas` para evitar conflitos em Vite)

---

## 👨‍💻 Contribuição
- Desenvolvido em colaboração, este projeto segue evoluindo a cada iteração.
- Alterações devem ser documentadas em novos READMEs sequenciais (README 6, README 7...).



### 7. Botão "Deletar Tudo"
- Após a conclusão da **primeira etapa**, os botões individuais de **Remover** deixam de aparecer.
- Surge apenas um botão **"Deletar Tudo"** que:
  - Remove **todos os eventos** (ensaio, montagem, evento, desmontagem) do Google Calendar.
  - Limpa o resumo da solicitação.
  - Mantém apenas os **dados do usuário** (nome, telefone, email e título do evento).
  - Permite que o usuário recomece um novo agendamento do zero.

---

## 🔄 Alterações no Fluxo de Cancelamento
- Antes da conclusão da primeira etapa:
  - O usuário pode remover **etapas individuais** usando o botão **Remover** e confirmar no bloco de cancelamento.
- Depois da conclusão da primeira etapa:
  - Só existe o botão **"Deletar Tudo"**, que limpa a agenda no Google Calendar e reinicia o fluxo.
