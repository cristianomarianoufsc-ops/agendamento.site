Resumo do Projeto: Sistema de Agendamento para Teatro Carmen Fossari e Igrejinha da UFSC

Objetivo:
Criar um sistema de agendamento online com:
- Seleção de local (Teatro ou Igrejinha)
- Seleção de etapas do evento (ensaio, montagem, evento, desmontagem)
- Seleção de datas e horários com blocos de 30 minutos
- Destaque visual para datas com eventos e horários ocupados
- Integração futura com Google Calendar para verificar ocupação
- Resumo do agendamento e possibilidade de remover etapas
- Envio de confirmação por e-mail

Estrutura de Pastas:
/agendamento-site
├─ src/
│  ├─ App.jsx
│  ├─ components/
│  │  ├─ Calendar.jsx
│  │  ├─ TimeBlockSelector.jsx
│  ├─ index.css
│  └─ main.jsx

Componentes Criados:
1. App.jsx
   - Componente principal que gerencia estados do usuário, local, etapa, datas, horários e resumo.
   - Exibe tela inicial, calendário, seletor de horários, botão de confirmar etapa e resumo.
   - Integração parcial com Google Calendar via API.

2. Calendar.jsx
   - Exibe calendário do mês atual com destaque para datas com eventos e desabilita dias ocupados ou passados.
   - Navegação entre meses.
   - Integração com App.jsx via props.

3. TimeBlockSelector.jsx
   - Permite escolher horários de início e fim em blocos de 30 minutos.
   - Desabilita horários ocupados, fora do limite da etapa ou que colidem com outros horários.
   - Visual: botões verdes para selecionados, cinza desabilitado, cinza claro disponível.

Fluxo do Usuário:
1. Entrar na página → ver instruções + escolher local.
2. Selecionar local → aparecer calendário + etapas.
3. Selecionar etapa → escolher data.
4. Selecionar horário inicial e final → horários ocupados são desabilitados.
5. Confirmar etapa → adiciona ao resumo.
6. Remover etapas do resumo se necessário.
7. (Futuro) Envio de confirmação por e-mail.

Funcionalidades Implementadas:
- Calendário navegável com destaques visuais
- Bloqueio de datas passadas ou totalmente ocupadas
- Controle de etapas do evento e limite de horários por etapa
- Resumo dinâmico das etapas selecionadas
- Integração parcial com Google Calendar para ocupação
- Regras de sobreposição de horários implementadas
- Layout com Tailwind responsivo

Pendências / Próximos Passos:
1. Validar envio de email (EmailJS ou outro serviço)
2. Melhorar interface visual
3. Garantir seleção múltipla de datas para uma mesma etapa (até 6 dias)
4. Ajustes finos nos horários ocupados e confirmação de conflitos
5. Possível integração com calendário iCal

