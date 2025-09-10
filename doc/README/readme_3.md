# 📌 Projeto: Sistema de Agendamento de Espaços Culturais (UFSC)

## 🏗️ Estrutura do Projeto

```
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
```

---

## 📖 Resumo do que foi feito até agora

### 1. **Backend (Node.js + Express + Google Calendar)**
- Inicialmente, integração com Google Calendar era feita via **API Key + fetch**.
- Evoluímos para uso de **Service Account (Google Cloud)**, garantindo segurança e permissões adequadas.
- Configuração atual:
  - Arquivo JSON da Service Account salvo no backend.
  - Autenticação feita com `googleapis` + `JWT`.
  - `server.js` refeito para não depender mais de `apiKey`.
- A função `atualizarCache` agora usa:
  ```js
  const res = await calendar.events.list({
    calendarId,
    timeMin: start,
    timeMax: end,
    singleEvents: true,
    orderBy: "startTime",
  });
  ```
  retornando os eventos reais e populando o cache.

### 2. **Frontend (React + Vite + Tailwind)**
- Página inicial (`App.jsx`) com **passos de agendamento**:
  - Seleção do local (Teatro ou Igrejinha).
  - Seleção de etapas (ensaio, montagem, evento, desmontagem).
  - Cada etapa abre o **Calendar.jsx** para escolher a data.
  - Em seguida, escolha dos horários no **TimeBlockSelector.jsx**.
- Horários ocupados são consultados via backend e bloqueados no calendário.
- Resumo dinâmico com opção de remover etapas antes de confirmar.

### 3. **Integração com EmailJS**
- Configurado **EmailJS** com:
  - `service_av5yggt` (Service ID)
  - `template_78u0pe2` (Template ID)
  - `YPflPLhFzNXY3iSd-` (Public Key)
- Envia resumo do agendamento para:
  - E-mail institucional do DAC (fixo).
  - E-mail do usuário que preenche o formulário.

### 4. **Template de E-mail (HTML no EmailJS)**
- Criado template com tabela organizada:
  ```html
  <h2>Novo Agendamento - UFSC</h2>

  <p><strong>👤 Nome:</strong> {{name}}</p>
  <p><strong>📧 E-mail:</strong> {{email}}</p>
  <p><strong>📞 Telefone:</strong> {{phone}}</p>
  <p><strong>📌 Evento:</strong> {{eventName}}</p>

  <hr>

  <h3>📋 Resumo do Agendamento</h3>
  <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; width: 100%;">
    <thead>
      <tr style="background-color:#003366; color:white;">
        <th>Etapa</th>
        <th>Data</th>
        <th>Horário</th>
      </tr>
    </thead>
    <tbody>
      {{{etapasHTML}}}
    </tbody>
  </table>
  ```
- `{{{etapasHTML}}}` é preenchido dinamicamente no frontend, garantindo que **datas e horários** apareçam formatados corretamente.

### 5. **Avanços recentes (Agosto 2025)**
- ✅ Criada e configurada a **Service Account** no Google Cloud.
- ✅ Compartilhada a agenda com `client_email` da Service Account.
- ✅ Substituído o uso de API Key por autenticação segura.
- ✅ Corrigido bug de ID da agenda (ponto em `testecris.0001@gmail.com`).
- ✅ Ajustado `server.js` para usar `googleapis` e `JWT`.
- ✅ Confirmado que o cache atualiza e lista eventos reais do calendário de teste.

### 6. **Status atual**
✅ Backend funcionando com autenticação via Service Account.  
✅ Frontend exibe calendário, bloqueia horários ocupados e permite escolher etapas.  
✅ EmailJS envia confirmação para DAC e usuário.  
✅ Template de e-mail organizado.  
⚠️ Próximos passos: implementar rota `/reservar` para criar eventos e `/cancelar` para remover eventos.

---

## 🚀 Próximos passos sugeridos
1. **Rota de criação de eventos** no backend (`/ical/:local/reservar`) para inserir reservas no Google Calendar.
2. **Rota de cancelamento de eventos** (`/ical/:local/cancelar/:eventId`).
3. **Validações extras no frontend** (campos obrigatórios, conflito de horário antes do envio).
4. **Persistência** (opcional) em banco de dados para histórico de agendamentos.
5. **Autenticação diferenciada** (usuários logados vs solicitações públicas).
6. **Melhoria no design** do resumo antes do envio do formulário.

---

📌 Agora temos um **MVP funcional** que já consulta eventos ocupados no Google Calendar via Service Account e envia confirmações por e-mail.  
O próximo grande marco é permitir que o sistema **crie e cancele reservas automaticamente** no Google Calendar.

