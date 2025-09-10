# 📌 Projeto: Sistema de Agendamento de Espaços Culturais (UFSC)

## 🏗️ Estrutura do Projeto

```
📂 agendamento-site
│
├── 📂 backend
│   ├── server.js               # Servidor Node.js + Express + integração Google Calendar
│   ├── package.json            # Dependências do backend
│   ├── .env                    # Variáveis de ambiente (GOOGLE_API_KEY, PORT...)
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
- Criado servidor em `server.js` com rotas REST para buscar horários ocupados.
- Integração com **Google Calendar API** para obter eventos reais dos espaços (Teatro e Igrejinha).
- Uso de `.env` para armazenar:
  ```env
  GOOGLE_API_KEY=xxxx
  PORT=4000
  ```
- Dependências principais: `express`, `axios`, `node-cron`, `dotenv`.

### 2. **Frontend (React + Vite + Tailwind)**
- Página inicial (`App.jsx`) com **passos de agendamento**:
  - Seleção do local (Teatro ou Igrejinha).
  - Seleção de etapas (ensaio, montagem, evento, desmontagem).
  - Cada etapa abre o **Calendar.jsx** para escolher a data.
  - Em seguida, escolhe os horários no **TimeBlockSelector.jsx**.
- Bloqueio automático de horários já ocupados (vindos do backend).
- Resumo dinâmico de todas as etapas escolhidas.
- Opção de remover etapas já adicionadas.

### 3. **Integração com EmailJS**
- Configurado **EmailJS** com:
  - `service_av5yggt` (Service ID)
  - `template_78u0pe2` (Template ID)
  - `YPflPLhFzNXY3iSd-` (Public Key)
- O app coleta dados do formulário (**nome, e-mail, telefone, título do evento**) e envia o resumo por email.
- **Agora envia para dois destinatários**:
  - O e-mail institucional do DAC (fixo).
  - O e-mail informado no formulário pelo usuário.

### 4. **Template de E-mail (HTML no EmailJS)**
- Criado template em HTML com tabela organizada:
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
- O campo `{{{etapasHTML}}}` é preenchido dinamicamente no frontend, garantindo que **datas e horários** apareçam formatados corretamente.

### 5. **Status atual**
✅ Backend funcionando e puxando eventos do Google Calendar.
✅ Frontend mostra calendário, bloqueia horários ocupados e permite selecionar etapas.
✅ EmailJS integrado, envia para o **DAC** e também para o **usuário do formulário**.
✅ Template organizado com tabela.
⚠️ Ponto de atenção: revisar consistência do `resumo` para garantir que sempre leve datas/horas corretas.

---

## 🚀 Próximos passos sugeridos
1. **Validações extras** no frontend (evitar envio sem preencher campos obrigatórios).
2. **Persistência no backend** (salvar solicitações em banco de dados para histórico).
3. **Autenticação** (usuários logados X solicitações públicas).
4. **Melhoria no design** do resumo dentro do app antes do envio.
5. Testar integração com múltiplos ambientes (produção, testes, dev).

---

📌 Com isso, já temos um **MVP funcional**: o sistema agenda, bloqueia horários ocupados e envia e-mails para ambas as partes.

