// backend/importador.js

import fs from 'fs';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

// ===================================================================
// 1. COLE OS DADOS DA SUA PLANILHA AQUI DENTRO DAS ASPAS
// ===================================================================
const dadosDaPlanilha = `
Data,Confirmação,Responsável/contato,Horário,Onde,Atividade,Título,Duração,Classificação,Necessidades,Bolsista,Servidor,Público,Situação,Observação
24/09,Sim,"Isabel Colucci Coelho (48) 99995-0985",12h,Teatro Carmen Fossari,Audiovisual,Documentário: Vem Cá Meu Boi! A Costa da Lagoa e Seu Boi de Mamão,20m,Livre,Projetor e Caixa de som,,,,Finalizado,Verificar se a caixa de som está disponível e se a proponente pode levar note e projetor
24/09,Pendente,"Graciela de Conti Pagliari (4898860-6054)",13h30,Teatro Carmen Fossari,Audiovisual,Exibição filme Oppenheimer com debate,2h,18 anos,Projetor e Caixa de som,,,,Finalizado,Projeto OK - fazer termo de empréstimo para proponente
24/09,Sim,Jéferson Silveira Dantas (48991042262),18h,Igrejinha,Música,Mar-essência,50m,12 anos,"Divulgação padrão para as redes sociais, e-mails etc. e caixa amplificadora com retorno para que sejam plugados um violão acústico e um microfone",,Oto,,Finalizado,
25/09,Sim,Dione de Freitas (48996222444),11h,Teatro Carmen Fossari,Teatro,A Vida Depois dos 50,40m,Livre,11 cadeiras,,Oto,,Finalizado,CONF FINAL
25/09,Sim,Alexandre Brandalise (48999127299),19h,Igrejinha,Música,Igrejinha Musical - Recital com o violonista Alisson Alípio,50m,Livre,Não se aplica,,Oto,,Pendente,
25/09,Sim,Oto Bezerra (4837212385),19h,Teatro Carmen Fossari,Audiovisual,Mostra Fílmica 100 anos Salim Miguel + Bate-papo + Relançamento de livro,2h,Livre,,,Oto,,Finalizado,CONF FINAL
26/09,Sim,Luiza da Costa Pereira (48998052449),14h,Igrejinha,Oficina,Atividade Vivencial “Tenda do Conto”,2h30,Livre,"impressões de fotos e escritos em A4 e A3, cerca de 15 folhas, para a atividade; 25 cadeiras e 15 almofadas, uma cadeira maior, um bloco para apoio",,Oto,,Finalizado,Necessárias as fotos para impressão
26/09,Sim,Oto Bezerra (4837212385),20h,Teatro Carmen Fossari,Teatro,Brecht²,90m,10 anos,Impressão de 10 cartazes A4,,Oto,,Pendente,Necessárias as fotos para impressão
27/09,Pendente,Elisa Dulce João Fundanga (48999998106),15h,Igrejinha,Oficina,Oficina de danças tradicionais angolanas,4h,Livre,"Mesas, caixa de som, projetores",,Oto,,Pendente,
28/09,Sim,Merlim Miriane Malacoski (48996493716),19h,Igrejinha,Teatro - Musical,Isteporas Ziriguidum,40m,Livre,Caixa de som e iluminação,,Oto,,Finalizado,CONF FINAL
28/09,Sim,Oto Bezerra (4837212385),19h,Teatro Carmen Fossari,Teatro,Brecht²,90m,10 anos,Impressão de 10 cartazes A4,,Oto,,Finalizado,
`;

// ===================================================================
// 2. CONFIGURAÇÃO (reutilizada do server.js)
// ===================================================================
const credentials = JSON.parse(fs.readFileSync('./credentials.json', 'utf-8'));

const auth = new google.auth.JWT({
  email: credentials.client_email,
  key: credentials.private_key,
  scopes: ["https://www.googleapis.com/auth/calendar"],
} );

const calendar = google.calendar({ version: 'v3', auth });

const calendarIds = {
  teatro: "cristianomariano.ufsc@gmail.com",
  igrejinha: "c_e19d30c40d4de176bc7d4e11ada96bfaffd130b3ed499d9807c88785e2c71c05@group.calendar.google.com",
};

// ===================================================================
// 3. LÓGICA DE PROCESSAMENTO E IMPORTAÇÃO
// ===================================================================
async function importarEventos() {
  console.log("🚀 Iniciando importação de eventos para o Google Calendar...");

  const linhas = dadosDaPlanilha.trim().split('\n').slice(1); // Ignora o cabeçalho
  let eventosCriados = 0;
  let eventosIgnorados = 0;

  for (const linha of linhas) {
    // Regex para lidar com vírgulas dentro de aspas
    const colunas = linha.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g).map(c => c.replace(/"/g, ''));

    const [data, confirmacao, , horario, onde, , titulo, duracao, classificacao] = colunas;

    // Pula a linha se a confirmação não for "Sim" ou se faltar dados essenciais
    if (confirmacao.toLowerCase() !== 'sim' || !data || !horario || !titulo) {
      console.warn(`🟡 Evento "${titulo || 'Sem Título'}" ignorado (Confirmação: ${confirmacao} / Dados incompletos).`);
      eventosIgnorados++;
      continue;
    }

    try {
      // --- Processamento dos dados ---
      const [dia, mes] = data.split('/');
      const ano = 2025; // Assumindo que todos os eventos são de 2025

      const [hora, minuto] = horario.replace('h', ':').split(':').map(Number);
      
      const dataInicio = new Date(ano, mes - 1, dia, hora, minuto || 0);

      const dataFim = new Date(dataInicio);
      let duracaoMinutos = 0;
      if (duracao.includes('h')) {
        duracaoMinutos = parseFloat(duracao.replace('h', '').replace(',', '.')) * 60;
      } else if (duracao.includes('m')) {
        duracaoMinutos = parseInt(duracao.replace('m', ''));
      }
      dataFim.setMinutes(dataFim.getMinutes() + duracaoMinutos);

      const local = onde.toLowerCase().includes('teatro') ? 'teatro' : 'igrejinha';
      const calendarId = calendarIds[local];

      const evento = {
        summary: titulo,
        start: {
          dateTime: dataInicio.toISOString(),
          timeZone: 'America/Sao_Paulo',
        },
        end: {
          dateTime: dataFim.toISOString(),
          timeZone: 'America/Sao_Paulo',
        },
        description: `Local: ${onde}\nClassificação: ${classificacao}`,
      };

      // --- Envio para a API do Google ---
      await calendar.events.insert({
        calendarId: calendarId,
        resource: evento,
      });

      console.log(`✅ Evento "${titulo}" criado com sucesso em ${data} às ${horario} no calendário da ${local}.`);
      eventosCriados++;

    } catch (error) {
      console.error(`❌ Erro ao criar o evento "${titulo}":`, error.message);
    }
  }

  console.log("\n✨ --- Importação Concluída! --- ✨");
  console.log(`Total de eventos criados: ${eventosCriados}`);
  console.log(`Total de eventos ignorados: ${eventosIgnorados}`);
}

// Executa a função principal
importarEventos();
