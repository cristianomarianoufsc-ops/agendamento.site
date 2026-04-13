import React, { useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// ─────────────────────────────────────────────
// Texto completo das cláusulas
// ─────────────────────────────────────────────
const CLAUSULAS = [
  {
    numero: "PRIMEIRA",
    titulo: "DO OBJETO E DO PRAZO DA AUTORIZAÇÃO",
    texto: `O objeto deste termo é a autorização de uso de dependências específicas de espaço cultural da AUTORIZADORA pelo(a) AUTORIZADO(A) para fim exclusivo de realização de evento, na forma especificada no preâmbulo acima, observado o calendário prioritário previamente estipulado pela Universidade Federal de Santa Catarina, por meio de Edital Público.

Parágrafo único. Excluem-se, expressamente, da autorização ora ajustada, quaisquer outras áreas e/ou dependências que não a referida no preâmbulo desta autorização.`,
  },
  {
    numero: "SEGUNDA",
    titulo: "DA TAXA DE UTILIZAÇÃO",
    texto: `Nos casos de locação do espaço para eventos particulares e/ou não gratuitos, a AUTORIZADORA cobrará as taxas referentes à utilização do espaço cultural objeto desta autorização, conforme valores definidos em Portaria editada pela Secretaria de Cultura, nos termos da legislação vigente à época da autorização.

Parágrafo primeiro. Havendo cancelamento de apresentação do evento objeto deste termo, por qualquer motivo que seja, a taxa de locação paga pelo(a) AUTORIZADO(A) à AUTORIZADORA não será devolvida, podendo o(a) AUTORIZADO(A) reagendar a data para outra disponível no calendário anexo ao Edital vigente.`,
  },
  {
    numero: "TERCEIRA",
    titulo: "DOS INGRESSOS E DOS VALORES FIXADOS",
    texto: `A comercialização dos ingressos do espetáculo é de total responsabilidade do AUTORIZADO(A), inclusive no que tange às regras de comercialização total ou meia entrada.`,
  },
  {
    numero: "QUARTA",
    titulo: "DAS OBRIGAÇÕES E DOS DIREITOS DA AUTORIZADORA",
    texto: `A AUTORIZADORA, além de outras condições previstas em normas específicas, compromete-se a:

a) autorizar o uso das dependências e equipamentos do espaço cultural objeto deste termo o(à) AUTORIZADO(A), o qual será liberado para montagem no(s) dia(s) do(s) evento(s), a partir das (8) oito horas;

b) autorizar os serviços da sua equipe técnica, nos termos e nos horários previamente acordados com a administração do espaço cultural objeto deste termo;

c) disponibilizar, dentro das condições previstas para o bom funcionamento do palco e suas instalações, os equipamentos de sonorização, iluminação e vídeo existentes e instalados no espaço cultural objeto deste termo, não compreendendo o transporte, o carregamento e o descarregamento de equipamentos e materiais do(a) AUTORIZADO(A);

d) promover a ordem e a guarda do espaço cultural objeto deste termo, não se responsabilizando por objetos de uso pessoal, material cênico e equipamentos do(a) AUTORIZADO(A) e de sua equipe.`,
  },
  {
    numero: "QUINTA",
    titulo: "DAS OBRIGAÇÕES E DOS DIREITOS DO(A) AUTORIZADO(A)",
    texto: `O(A) AUTORIZADO(A), além de outras condições previstas em normas específicas, compromete-se a:

a) realizar o evento descrito no preâmbulo desta autorização, utilizando as instalações do espaço cultural exclusivamente para os fins especificados;

b) restituir as instalações do espaço cultural à AUTORIZADORA nas mesmas condições físicas, técnicas e de limpeza em que foram recebidas;

c) indenizar a AUTORIZADORA pelos danos materiais e/ou morais porventura causados contra a mesma, por si ou por seus prepostos;

d) responsabilizar-se por quaisquer danos materiais e/ou pessoais que sejam causados contra terceiros nas instalações do espaço cultural objeto deste termo, quer sejam causados por si ou por seus prepostos;

e) cumprir as exigências legais da SBAT, ECAD, SATED, Ordem dos Músicos do Brasil, Juizado da Infância e Juventude e similares, apresentando as respectivas comprovações à AUTORIZADORA, no mínimo 48 (quarenta e oito) horas antes da primeira utilização do espaço cultural;

f) expirado o prazo ajustado para a utilização do espaço cultural objeto deste termo, retirar do mesmo todo o material de sua propriedade imediatamente após a última apresentação do espetáculo e restituir a área no máximo em até 04 (quatro) horas completamente desocupado, nas mesmas condições em que recebeu;

g) entregar e instalar cenários e equipamentos somente no(s) horário(s) previamente acordado(s) com a administração do espaço cultural;

h) observar a expressa proibição de veiculação de publicidade enganosa, em benefício próprio, acerca do objeto a que se refere este termo;

i) arcar com eventuais taxas, multas e outras sanções decorrentes da colocação de cartazes e propagandas, em geral expostas em locais públicos, sem a devida autorização;

j) observar que a entrada do público ao espaço cultural se dará obrigatoriamente no mínimo até 00:30 (trinta) minutos antes do início do espetáculo;

k) não colocar/depositar qualquer material nos corredores da plateia e nas saídas de emergência e rampas de acesso do espaço físico objeto deste termo que impeça o livre trânsito e evacuação nessas áreas;

l) substituir todo e qualquer proposto integrante de seu quadro de colaboradores, que esteja prestando serviço no espaço físico objeto deste termo, quando solicitado pela AUTORIZADORA;

m) submeter-se à fiscalização da AUTORIZADORA e de seus mandatários no que tange às suas obrigações ora pactuadas;

n) permitir à AUTORIZADORA, por meio de seus mandatários, devidamente credenciados, a fiscalização e o livre acesso às instalações onde será executado o objeto deste termo;

o) realizar, ao final do evento, juntamente com o servidor designado pelo Departamento Artístico Cultural da UFSC, a vistoria dos espaços utilizados;

p) cumprir rigorosamente as normas e orientações emanadas da AUTORIZADORA;

q) preencher e encaminhar, no prazo de até 7 (sete) dias após a realização do evento, o Registro de Atividades do DAC/2026, com as informações relativas à execução da proposta.

Parágrafo primeiro. Caso o evento proposto não se realize na data prevista, além de outras cominações de ordem legal e ora pactuadas, compete exclusivamente ao(à) AUTORIZADO(A) tomar as medidas necessárias visando comunicar ao público a forma de obter devido ressarcimento/devolução dos valores correspondentes aos ingressos vendidos.

Parágrafo segundo. Fica entendido que somente o(a) representante legal do(a) AUTORIZADO(A), constituído na forma da lei, é que poderá praticar qualquer tipo de ato perante a AUTORIZADORA.

Parágrafo terceiro. Caberá ao(à) AUTORIZADO(A) prover o espaço cultural objeto deste termo de: operadores de som, de luz, maquinista e demais profissionais que demandem para a realização do espetáculo.`,
  },
  {
    numero: "SEXTA",
    titulo: "DAS VEDAÇÕES",
    texto: `Fica vedado terminantemente ao(à) AUTORIZADO(A), no que se refere ao espaço cultural objeto deste termo e/ou a outras áreas da AUTORIZADORA:

I - fixar qualquer tipo de material nas paredes internas desses espaços, sendo ele de divulgação ou não, quer relacionado ao espetáculo, e/ou de seu(sua) produtor(a) e/ou de patrocinadores e apoiadores;

II - colocar estande, independente do tipo e do tamanho e por qualquer motivo que seja;

III - servir qualquer tipo de comida ou bebida nas dependências do Teatro, bem como a utilização de fogo, água, objetos perfurantes que venham colocar em risco ou danificar as dependências do Teatro, sem a expressa permissão da AUTORIZADORA.

Parágrafo único. Mediante pedido formal, devidamente protocolado, poderá a AUTORIZADORA liberar o uso ao(à) AUTORIZADO(A), observada o que a respeito dispuser as normas que disciplinam a matéria.`,
  },
  {
    numero: "SÉTIMA",
    titulo: "DAS SANÇÕES ADMINISTRATIVAS",
    texto: `A prática de ilícitos, as execuções deficientes, irregulares ou inadequadas dos serviços objeto deste termo, o descumprimento de prazos e condições estabelecidas, faculta à AUTORIZADORA, nos termos da Lei, a aplicação das seguintes penalidades:

I - advertência;

II - multa de 50,00% (cinquenta por cento) sobre o valor global da taxa máxima de ocupação do respectivo espaço cultural e tipo de evento, no caso da rescisão por inexecução ou eventual pedido de rescisão sem justo e formal motivo;

III - suspensão temporária de autorização de uso de espaço cultural da AUTORIZADORA, pelo prazo de até 02 (dois) anos;

IV - declaração de inidoneidade para utilização de outros espaços culturais da administração pública federal.

Parágrafo único. As sanções previstas no caput desta cláusula poderão ser aplicadas juntamente, facultada a defesa prévia do(a) AUTORIZADO(A), no prazo de 5 (cinco) dias úteis, a contar da notificação da AUTORIZADORA.`,
  },
  {
    numero: "OITAVA",
    titulo: "DAS DISPOSIÇÕES GERAIS",
    texto: `Na hipótese da superveniência de fatos alheios que obriguem a AUTORIZADORA a manter fechadas suas dependências, por força de Lei, Decreto, Instrução Normativa, Portaria, caso fortuito ou força maior, greve ou qualquer outra causa impeditiva devidamente comprovada, durante o período previsto neste termo, a presente autorização será rescindida de pleno direito, sem que tal importe na incidência de qualquer apenação, encargos ou outros tipos de obrigação às partes.

Parágrafo primeiro. A infringência de qualquer das cláusulas ora pactuadas importará na rescisão imediata da presente autorização, independentemente de notificação judicial ou extrajudicial, sem prejuízo da aplicação das penalidades previstas neste termo e nas disposições legais aplicáveis.

Parágrafo segundo. O espaço cultural ora disponibilizado não possui seguro para cobrir o patrimônio do(a) AUTORIZADO(A), razão pela qual este(a) deverá providenciar o respectivo seguro, se for de seu interesse.

Parágrafo terceiro. A desistência da data de realização do evento objeto deste termo deverá ser comunicada por escrito. A cobrança está submetida ao Parágrafo primeiro da Cláusula II.

Parágrafo quarto. O(A) AUTORIZADO(A) é o(a) único(a) responsável pela remuneração, obrigações sociais e trabalhistas de sua equipe técnica e do elenco utilizado no espetáculo/evento, inexistindo quaisquer vínculos com a AUTORIZADORA, sejam eles de caráter empregatício ou não.

Parágrafo sexto. O(A) AUTORIZADO(A), na oportunidade da assinatura deste termo, declara expressamente conhecer e aceitar as condições aqui fixadas, assim como em relação às normas que dispõem sobre a utilização de espaços da AUTORIZADORA para a realização de eventos, vigentes nesta data.

Parágrafo sétimo. O(A) AUTORIZADO(A) dará conhecimento das condições estabelecidas neste termo aos propostos integrantes de seu quadro de colaboradores.`,
  },
  {
    numero: "NONA",
    titulo: "DO FORO",
    texto: `Fica eleito o foro da Comarca de Florianópolis, Capital do Estado de Santa Catarina, para dirimir eventuais dúvidas oriundas da aplicação deste Termo, com renúncia de qualquer outro, por mais privilegiado que seja.

E, por estarem justos e concordados, assinam o presente instrumento em 02 (duas) vias de igual teor e forma, para um só efeito.`,
  },
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function formatDT(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso.includes("Z") ? iso : iso + "-03:00");
    const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });
    const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
    return { date, time, full: `${date} ${time}` };
  } catch { return null; }
}

function ReadOnly({ label, value, className = "" }) {
  return (
    <div className={`mb-3 ${className}`}>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      <div className="w-full border border-gray-200 rounded px-3 py-2 bg-gray-50 text-gray-800 text-sm min-h-[36px]">
        {value || <span className="text-gray-400 italic text-xs">Não informado</span>}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, required, type = "text", placeholder = "" }) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// Componente Cláusula Acordeão
// ─────────────────────────────────────────────
function ClausulaItem({ clausula, index, aceita, onAceitar }) {
  const [aberta, setAberta] = useState(false);

  return (
    <div className={`border rounded-lg overflow-hidden mb-2 transition-all ${aceita ? "border-green-400 bg-green-50" : "border-gray-200 bg-white"}`}>
      <button
        type="button"
        onClick={() => setAberta(!aberta)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-semibold text-sm text-gray-800">
          {aceita && <span className="text-green-600 mr-2">✓</span>}
          Cláusula {clausula.numero} – {clausula.titulo}
        </span>
        <span className="text-gray-400 ml-2">{aberta ? "▲" : "▼"}</span>
      </button>

      {aberta && (
        <div className="px-4 pb-4">
          <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-line border-t border-gray-100 pt-3 max-h-56 overflow-y-auto">
            {clausula.texto}
          </div>
          {!aceita && (
            <button
              type="button"
              onClick={() => { onAceitar(index); setAberta(false); }}
              className="mt-3 px-4 py-2 bg-blue-700 text-white text-xs font-bold rounded hover:bg-blue-800 transition-colors"
            >
              Li e aceito esta cláusula
            </button>
          )}
          {aceita && (
            <p className="mt-3 text-green-700 text-xs font-semibold">✓ Cláusula aceita</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Geração do PDF
// ─────────────────────────────────────────────
function gerarPDF({ local, evento, etapas, nome, cpfCnpj, rg, telefone, endereco, numero, complemento, bairro, cidade, outrasInfo }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const margin = 20;
  const usable = W - margin * 2;
  let y = 18;

  const addText = (text, options = {}) => {
    const { fontSize = 10, align = "left", bold = false, indent = 0, lineHeight = 5, justify = false } = options;
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    const lines = doc.splitTextToSize(text, usable - indent);
    if (align === "center") {
      lines.forEach(line => {
        doc.text(line, W / 2, y, { align: "center" });
        y += lineHeight;
      });
    } else if (justify) {
      lines.forEach((line, i) => {
        const isLast = i === lines.length - 1;
        doc.text(line, margin + indent, y, isLast ? {} : { maxWidth: usable - indent, align: "justify" });
        y += lineHeight;
      });
    } else {
      lines.forEach(line => {
        doc.text(line, margin + indent, y);
        y += lineHeight;
      });
    }
  };

  // Draws a checkbox at (cx, cy) with size s. If checked, draws an X inside.
  const drawCheckbox = (cx, cy, s, checked) => {
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.rect(cx, cy - s + 0.5, s, s);
    if (checked) {
      doc.setLineWidth(0.5);
      doc.line(cx + 0.8, cy - s + 1.2, cx + s - 0.8, cy - 0.3);
      doc.line(cx + s - 0.8, cy - s + 1.2, cx + 0.8, cy - 0.3);
    }
  };

  const checkPage = (needed = 10) => {
    if (y + needed > 280) { doc.addPage(); y = 18; }
  };

  // Cabeçalho
  addText("SERVIÇO PÚBLICO FEDERAL MINISTÉRIO DA EDUCAÇÃO", { fontSize: 9, align: "center", bold: true, lineHeight: 5 });
  addText("UNIVERSIDADE FEDERAL DE SANTA CATARINA", { fontSize: 9, align: "center", bold: true, lineHeight: 5 });
  addText("SECRETARIA DE CULTURA, ARTE E ESPORTE", { fontSize: 9, align: "center", lineHeight: 5 });
  addText("Departamento Artístico Cultural", { fontSize: 9, align: "center", lineHeight: 5 });
  addText("Praça Santos Dumont - Rua Desembargador Vitor Lima, 117 - Trindade", { fontSize: 8, align: "center", lineHeight: 5 });
  addText("CEP 88040-400 Florianópolis - SC - Brasil", { fontSize: 8, align: "center", lineHeight: 6 });

  y += 4;
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(margin, y, W - margin, y);
  y += 6;

  addText("TERMO DE AUTORIZAÇÃO PARA OCUPAÇÃO DOS ESPAÇOS DO DEPARTAMENTO ARTÍSTICO CULTURAL", { fontSize: 11, align: "center", bold: true, lineHeight: 6 });
  y += 2;
  addText("*Este documento é parte integrante do Edital Mais Arte - N° 002/2026/DAC/SeCArtE", { fontSize: 8, align: "center", lineHeight: 6 });
  y += 4;

  // Seção I
  addText("I – PREÂMBULO", { fontSize: 10, bold: true, lineHeight: 6 });
  y += 2;

  addText("1. Espaço físico objeto desta autorização:", { fontSize: 10, lineHeight: 6 });
  y += 1;
  const isTeatro = (local || "").toLowerCase().includes("teatro");
  const isIgreja = (local || "").toLowerCase().includes("igrej");

  // Teatro Carmen Fossari — checkbox drawn manually to avoid spaced-letter rendering
  const cbSize = 3.5;
  drawCheckbox(margin + 4, y, cbSize, isTeatro);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Teatro Carmen Fossari", margin + 4 + cbSize + 2, y);
  y += 5;
  drawCheckbox(margin + 4, y, cbSize, isIgreja);
  doc.text("Igrejinha da UFSC", margin + 4 + cbSize + 2, y);
  y += 7;

  addText("2. Evento a ser realizado no espaço físico objeto desta autorização:", { fontSize: 10, lineHeight: 6 });
  addText(evento || "—", { fontSize: 10, indent: 4, lineHeight: 6 });
  y += 2;

  addText("3. Data e horário de realização do evento, conforme informado na inscrição, incluindo os horários de ensaio e montagem, caso tenham sido previstos.", { fontSize: 10, lineHeight: 5 });
  y += 2;

  checkPage(30);
  autoTable(doc, {
    startY: y,
    head: [["Etapa", "Data", "Horário"]],
    body: etapas.map(e => [e.etapa, e.data, e.horario]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [30, 60, 120], textColor: 255, fontStyle: "bold" },
    margin: { left: margin, right: margin },
    tableWidth: usable,
  });
  y = doc.lastAutoTable.finalY + 6;

  addText("4. Outras informações:", { fontSize: 10, lineHeight: 6 });
  if (outrasInfo) addText(outrasInfo, { fontSize: 10, indent: 4, lineHeight: 5 });
  y += 4;

  // Seção II
  checkPage(20);
  addText("II - PARTES ENVOLVIDAS:", { fontSize: 10, bold: true, lineHeight: 6 });
  y += 2;

  const enderecoCompleto = [
    endereco, numero ? `n.${numero}` : "", complemento || "", bairro ? `bairro ${bairro}` : ""
  ].filter(Boolean).join(" ");

  const partesTextoIntro =
    `Termo de autorização de uso do espaço cultural acima especificado, que entre si celebram, de um lado, a UNIVERSIDADE FEDERAL DE SANTA CATARINA, com sede no Campus Universitário Florianópolis, s/n Trindade Florianópolis (SC) - CEP.: 88040-900, inscrita no CNPJ sob o nº 83.899.526/0001-82, doravante denominada simplesmente de AUTORIZADORA, neste ato representada por Andréa Búrigo Ventura, Secretaria de Cultura, Arte e Esporte - DAC/SeCArte, e de outro lado:`;

  const partesTextoProponente =
    `${nome || "_______________"}, portador(a) do CPF/CNPJ sob o nº ${cpfCnpj || "_______________"}, RG nº ${rg || "_______________"} expedida pela SSP/SC, residente à ${enderecoCompleto || "_______________"}, Telefone ${telefone || "_______________"}, na cidade ${cidade || "_______________"}, doravante denominado(a) AUTORIZADO(A), mediante as seguintes cláusulas:`;

  addText(partesTextoIntro, { fontSize: 10, lineHeight: 5, justify: true });
  addText(partesTextoProponente, { fontSize: 10, bold: true, lineHeight: 5, justify: true });
  y += 4;

  // Linha divisória antes das cláusulas
  doc.setDrawColor(180);
  doc.setLineWidth(0.4);
  doc.line(margin, y, W - margin, y);
  y += 5;

  // Seção III – Cláusulas
  checkPage(10);
  addText("III - CLÁUSULAS PACTUADAS ENTRE AS PARTES ENVOLVIDAS:", { fontSize: 10, bold: true, lineHeight: 6 });
  y += 2;

  CLAUSULAS.forEach((cl) => {
    checkPage(15);
    addText(`CLÁUSULA ${cl.numero} – ${cl.titulo}`, { fontSize: 10, bold: true, lineHeight: 6 });
    y += 1;
    addText(cl.texto, { fontSize: 9.5, lineHeight: 5, justify: true });
    y += 3;
  });

  // Assinaturas
  checkPage(60);
  y += 10;
  const hoje = new Date();
  addText(
    `Florianópolis (SC), ${hoje.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}`,
    { fontSize: 10, align: "center", lineHeight: 8 }
  );
  y += 24;

  doc.line(margin, y, margin + 70, y);
  doc.line(W - margin - 70, y, W - margin, y);
  y += 5;
  addText("AUTORIZADORA", { fontSize: 9, indent: 10, lineHeight: 5 });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("AUTORIZADO (A)", W - margin - 60, y - 5);
  y += 3;
  doc.text(`CPF – ${cpfCnpj || ""}`, W - margin - 60, y + 2);

  doc.save(`Termo_de_Autorizacao_DAC_${(nome || "proponente").replace(/\s+/g, "_")}.pdf`);
}

// ─────────────────────────────────────────────
// Componente Principal
// ─────────────────────────────────────────────
export default function TermoDigital() {
  const [searchParams] = useSearchParams();

  // Campos pré-preenchidos (somente leitura)
  const local = searchParams.get("local") || "";
  const evento = searchParams.get("evento") || "";
  const ensaioInicio = searchParams.get("ensaioInicio") || "";
  const ensaioFim = searchParams.get("ensaioFim") || "";
  const montagemInicio = searchParams.get("montagemInicio") || "";
  const montagemFim = searchParams.get("montagemFim") || "";
  const desmontagemInicio = searchParams.get("desmontagemInicio") || "";
  const desmontagemFim = searchParams.get("desmontagemFim") || "";
  const eventosJsonRaw = searchParams.get("eventosJson") || "";

  let eventosPrincipais = [];
  try { if (eventosJsonRaw) eventosPrincipais = JSON.parse(eventosJsonRaw); } catch {}

  // Monta tabela de etapas
  const etapas = [];
  if (ensaioInicio) {
    const ini = formatDT(ensaioInicio), fim = formatDT(ensaioFim);
    if (ini) etapas.push({ etapa: "Ensaio", data: ini.date, horario: `${ini.time}${fim ? " - " + fim.time : ""}` });
  }
  if (montagemInicio) {
    const ini = formatDT(montagemInicio), fim = formatDT(montagemFim);
    if (ini) etapas.push({ etapa: "Montagem", data: ini.date, horario: `${ini.time}${fim ? " - " + fim.time : ""}` });
  }
  eventosPrincipais.forEach((ev, i) => {
    const ini = formatDT(ev.inicio), fim = formatDT(ev.fim);
    if (ini) etapas.push({ etapa: `Evento${eventosPrincipais.length > 1 ? " " + (i + 1) : ""}`, data: ini.date, horario: `${ini.time}${fim ? " - " + fim.time : ""}` });
  });
  if (desmontagemInicio) {
    const ini = formatDT(desmontagemInicio), fim = formatDT(desmontagemFim);
    if (ini) etapas.push({ etapa: "Desmontagem", data: ini.date, horario: `${ini.time}${fim ? " - " + fim.time : ""}` });
  }

  // Campos somente leitura (pré-preenchidos)
  const nome = searchParams.get("nome") || "";
  const cpfCnpj = searchParams.get("cpfCnpj") || "";
  const telefone = searchParams.get("telefone") || "";
  const email = searchParams.get("email") || "";

  // Campos editáveis
  const [rg, setRg] = useState(searchParams.get("rg") || "");
  const [endereco, setEndereco] = useState(searchParams.get("endereco") || "");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState(searchParams.get("bairro") || "");
  const [cidade, setCidade] = useState(searchParams.get("cidade") || "");
  const [outrasInfo, setOutrasInfo] = useState("");

  // Cláusulas aceitas
  const [clausulasAceitas, setClausulasAceitas] = useState(Array(CLAUSULAS.length).fill(false));
  const todasAceitas = clausulasAceitas.every(Boolean);

  const handleAceitar = (index) => {
    setClausulasAceitas(prev => {
      const novo = [...prev];
      novo[index] = true;
      return novo;
    });
  };

  const limparFormulario = () => {
    setRg("");
    setEndereco(""); setNumero(""); setComplemento(""); setBairro(""); setCidade("");
    setOutrasInfo(""); setClausulasAceitas(Array(CLAUSULAS.length).fill(false));
  };

  const handleGerarPDF = () => {
    if (!nome || !cpfCnpj) { alert("Preencha pelo menos Nome e CPF/CNPJ antes de gerar o PDF."); return; }
    if (!todasAceitas) { alert("Você precisa aceitar todas as cláusulas antes de gerar o PDF."); return; }
    gerarPDF({ local, evento, etapas, nome, cpfCnpj, rg, telefone, endereco, numero, complemento, bairro, cidade, outrasInfo });
  };

  const totalAceitas = clausulasAceitas.filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gray-100 py-6 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Cabeçalho oficial */}
        <div className="bg-white border border-gray-200 rounded-t-xl px-8 py-5 text-center shadow-sm">
          <p className="text-xs font-bold text-gray-600 uppercase tracking-widest">Serviço Público Federal — Ministério da Educação</p>
          <p className="text-sm font-bold text-gray-800 mt-1">Universidade Federal de Santa Catarina</p>
          <p className="text-xs text-gray-600">Secretaria de Cultura, Arte e Esporte — Departamento Artístico Cultural</p>
          <div className="border-t border-gray-300 mt-3 pt-3">
            <h1 className="text-base font-bold text-gray-900 uppercase leading-snug">
              Termo de Autorização para Ocupação dos Espaços do<br />Departamento Artístico Cultural
            </h1>
            <p className="text-xs text-gray-500 mt-1 italic">*Este documento é parte integrante do Edital Mais Arte - N° 002/2026/DAC/SeCArtE</p>
          </div>
        </div>

        {/* I – PREÂMBULO */}
        <div className="bg-white border-x border-gray-200 px-8 py-6 shadow-sm">
          <h2 className="text-sm font-bold text-blue-800 uppercase tracking-wide border-b border-blue-100 pb-2 mb-4">I – Preâmbulo</h2>
          <p className="text-xs text-gray-500 mb-4">Informações sobre o evento e o espaço</p>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">1. Espaço físico objeto desta autorização</label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <span className={`w-4 h-4 border-2 rounded-sm flex items-center justify-center text-xs font-bold ${local.toLowerCase().includes("teatro") ? "border-blue-700 bg-blue-700 text-white" : "border-gray-400"}`}>
                  {local.toLowerCase().includes("teatro") ? "✓" : ""}
                </span>
                Teatro Carmen Fossari
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <span className={`w-4 h-4 border-2 rounded-sm flex items-center justify-center text-xs font-bold ${local.toLowerCase().includes("igrej") ? "border-blue-700 bg-blue-700 text-white" : "border-gray-400"}`}>
                  {local.toLowerCase().includes("igrej") ? "✓" : ""}
                </span>
                Igrejinha da UFSC
              </label>
            </div>
            {local && !local.toLowerCase().includes("teatro") && !local.toLowerCase().includes("igrej") && (
              <p className="text-xs text-gray-500 mt-1">{local}</p>
            )}
          </div>

          <ReadOnly label="2. Evento a ser realizado no espaço físico objeto desta autorização" value={evento} />

          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
              3. Data e horário de realização do evento
            </label>
            {etapas.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-xs">
                  <thead className="bg-blue-800 text-white">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Etapa</th>
                      <th className="text-left px-3 py-2 font-semibold">Data</th>
                      <th className="text-left px-3 py-2 font-semibold">Horário</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {etapas.map((e, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="px-3 py-2 font-medium text-gray-700">{e.etapa}</td>
                        <td className="px-3 py-2 text-gray-600">{e.data}</td>
                        <td className="px-3 py-2 text-gray-600">{e.horario}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">Nenhuma etapa informada</p>
            )}
          </div>

          <div className="mb-2">
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">4. Outras informações</label>
            <textarea
              value={outrasInfo}
              onChange={e => setOutrasInfo(e.target.value)}
              rows={2}
              placeholder="Informações adicionais relevantes (opcional)"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* II – PARTES ENVOLVIDAS */}
        <div className="bg-white border-x border-gray-200 px-8 py-6 shadow-sm mt-px">
          <h2 className="text-sm font-bold text-blue-800 uppercase tracking-wide border-b border-blue-100 pb-2 mb-4">II – Partes Envolvidas</h2>
          <p className="text-xs text-gray-500 mb-4">Dados do Proponente (AUTORIZADO/A)</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
            <div className="md:col-span-2">
              <ReadOnly label="Nome Completo" value={nome} />
            </div>
            <ReadOnly label="CPF/CNPJ" value={cpfCnpj} />
            <Field label="RG" value={rg} onChange={setRg} required />
            <ReadOnly label="Telefone" value={telefone} />
            <ReadOnly label="E-mail" value={email} />
          </div>
          <div className="grid grid-cols-3 gap-x-4">
            <div className="col-span-2">
              <Field label="Endereço" value={endereco} onChange={setEndereco} required />
            </div>
            <Field label="Nº" value={numero} onChange={setNumero} placeholder="Ex: 123" />
          </div>
          <div className="grid grid-cols-3 gap-x-4">
            <Field label="Complemento" value={complemento} onChange={setComplemento} />
            <Field label="Bairro" value={bairro} onChange={setBairro} required />
            <Field label="Cidade" value={cidade} onChange={setCidade} required />
          </div>
        </div>

        {/* III – CLÁUSULAS */}
        <div className="bg-white border-x border-gray-200 px-8 py-6 shadow-sm mt-px">
          <h2 className="text-sm font-bold text-blue-800 uppercase tracking-wide border-b border-blue-100 pb-2 mb-1">III – Cláusulas Pactuadas</h2>
          <p className="text-xs text-gray-500 mb-4">Clique para expandir e ler cada cláusula</p>

          {CLAUSULAS.map((cl, i) => (
            <ClausulaItem
              key={i}
              clausula={cl}
              index={i}
              aceita={clausulasAceitas[i]}
              onAceitar={handleAceitar}
            />
          ))}

          <div className={`mt-4 p-3 rounded-lg border text-sm font-medium text-center ${todasAceitas ? "bg-green-50 border-green-400 text-green-800" : "bg-yellow-50 border-yellow-300 text-yellow-800"}`}>
            {todasAceitas
              ? "✓ Todas as cláusulas foram aceitas"
              : `${totalAceitas} de ${CLAUSULAS.length} cláusulas aceitas — expanda e aceite todas para gerar o PDF`}
          </div>
        </div>

        {/* Botões */}
        <div className="bg-white border border-gray-200 rounded-b-xl px-8 py-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 mt-px">
          <p className="text-xs text-gray-400">* Campos obrigatórios</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={limparFormulario}
              className="px-5 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 font-semibold hover:bg-gray-50 transition-colors"
            >
              Limpar Formulário
            </button>
            <button
              type="button"
              onClick={handleGerarPDF}
              className={`px-6 py-2 rounded-lg text-sm font-bold text-white transition-colors ${todasAceitas ? "bg-blue-800 hover:bg-blue-900" : "bg-gray-400 cursor-not-allowed"}`}
            >
              Gerar PDF
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
