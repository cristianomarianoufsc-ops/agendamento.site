import React from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileText, CheckCircle, AlertTriangle, Loader, Download } from "lucide-react";

// Componente auxiliar para renderizar a lista de inscrições
const InscricaoList = ({ title, list, color }) => (
  <div className="mt-4 p-4 border rounded-lg shadow-sm" style={{ borderColor: color.border, backgroundColor: color.bg }}>
    <h4 className="text-lg font-semibold mb-2" style={{ color: color.text }}>{title} ({list.length})</h4>
    <ul className="list-disc list-inside space-y-1 text-sm max-h-60 overflow-y-auto">
      {list.length === 0 ? (
        <li className="text-gray-500">Nenhuma inscrição nesta categoria.</li>
      ) : (
        list.map((inscricao, index) => {
          const nota = inscricao.finalScore !== null ? parseFloat(inscricao.finalScore).toFixed(2) : 'N/A';
          const eventoNome = inscricao.evento_nome || 'Evento Sem Nome';
          return (
            <li key={inscricao.id} className="text-gray-700">
              <span className="font-medium">{eventoNome}</span> ({inscricao.local}) - Nota: {nota}
              <span className="text-xs text-gray-500 ml-2">ID: {inscricao.id}</span>
            </li>
          );
        })
      )}
    </ul>
  </div>
);

// Componente principal do Modal
const ConsolidacaoModal = ({ data, onClose }) => {
  if (!data) return null;

  const { totalInscricoes, aprovadas, reprovadas, naoAvaliadas, listaAprovadas, listaReprovadas, listaNaoAvaliadas } = data;

  // Função para gerar o PDF (reutilizando a lógica anterior de Markdown)
  const handleGeneratePDF = async () => {
    // 1. Gerar o conteúdo em Markdown
    let content = `# Simulação de Consolidação da Agenda Final\n\n`;
    content += `Gerado em: ${new Date().toLocaleString('pt-BR')}\n\n`;

    // Resumo
    content += `## Resumo da Classificação\n\n`;
    content += `| Categoria | Quantidade |\n`;
    content += `| :--- | :--- |\n`;
    content += `| Total de Inscrições | ${totalInscricoes} |\n`;
    content += `| Aprovadas (Nota >= 2.00) | ${aprovadas} |\n`;
    content += `| Reprovadas (Nota < 2.00) | ${reprovadas} |\n`;
    content += `| Não Avaliadas | ${naoAvaliadas} |\n\n`;

    // Lista de Aprovadas
    content += `## Inscrições Aprovadas\n\n`;
    if (listaAprovadas.length === 0) {
      content += `Nenhuma inscrição aprovada nesta simulação.\n\n`;
    } else {
      listaAprovadas.forEach((inscricao, index) => {
        const nota = inscricao.finalScore !== null ? parseFloat(inscricao.finalScore).toFixed(2) : 'N/A';
        const eventoNome = inscricao.evento_nome || 'Evento Sem Nome';
        content += `${index + 1}. **${eventoNome}** (${inscricao.local}) - Nota: ${nota}\n`;
        content += `   *Proponente: ${inscricao.nome || 'Desconhecido'} | ID: ${inscricao.id}*\n`;
      });
      content += `\n`;
    }

    // Lista de Reprovadas
    content += `## Inscrições Reprovadas\n\n`;
    if (listaReprovadas.length === 0) {
      content += `Nenhuma inscrição reprovada nesta simulação.\n\n`;
    } else {
      listaReprovadas.forEach((inscricao, index) => {
        const nota = inscricao.finalScore !== null ? parseFloat(inscricao.finalScore).toFixed(2) : '0.00';
        const eventoNome = inscricao.evento_nome || 'Evento Sem Nome';
        content += `${index + 1}. **${eventoNome}** (${inscricao.local}) - Nota: ${nota}\n`;
        content += `   *Proponente: ${inscricao.nome || 'Desconhecido'} | ID: ${inscricao.id}*\n`;
      });
      content += `\n`;
    }

    // Lista de Não Avaliadas
    content += `## Inscrições Não Avaliadas\n\n`;
    if (listaNaoAvaliadas.length === 0) {
      content += `Nenhuma inscrição não avaliada.\n\n`;
    } else {
      listaNaoAvaliadas.forEach((inscricao, index) => {
        const eventoNome = inscricao.evento_nome || 'Evento Sem Nome';
        content += `${index + 1}. **${eventoNome}** (${inscricao.local}) - Nota: N/A\n`;
        content += `   *Proponente: ${inscricao.nome || 'Desconhecido'} | ID: ${inscricao.id}*\n`;
      });
      content += `\n`;
    }

    // 2. Enviar o conteúdo Markdown para o backend para conversão em PDF
    try {
      // Usar um estado local para o loading do download, se necessário, mas por enquanto vamos simplificar
      // setIsDownloading(true);
      const response = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ markdown: content }),
      });

      if (!response.ok) {
        throw new Error(`Erro ao gerar PDF: ${response.statusText}`);
      }

      // 3. Receber o PDF e forçar o download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Agenda_Final_Consolidada_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      alert("✅ PDF da Agenda Final Consolidada gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar PDF da Agenda Final:", error);
      alert(`❌ Erro ao gerar PDF da Agenda Final: ${error.message}`);
    } finally {
      // setIsDownloading(false);
    }
  };

  return ReactDOM.createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        className="bg-white rounded-xl shadow-2xl p-6 m-4 w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h3 className="text-2xl font-extrabold text-indigo-700 flex items-center gap-2">
            <FileText size={24} /> Consolidação da Agenda Final
          </h3>
          <button onClick={onClose} className="p-2 rounded-full text-gray-500 hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto pr-2">
          <p className="text-gray-600 mb-4">
            Esta é uma **simulação** da consolidação da agenda final com base nas notas de avaliação.
            A nota de corte utilizada é **2.00**.
          </p>

          {/* Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
              <p className="text-sm font-medium text-gray-500">Total de Inscrições</p>
              <p className="text-3xl font-bold text-gray-800">{totalInscricoes}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200 text-center">
              <p className="text-sm font-medium text-green-600">Aprovadas (≥ 2.00)</p>
              <p className="text-3xl font-bold text-green-700">{aprovadas}</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg border border-red-200 text-center">
              <p className="text-sm font-medium text-red-600">Reprovadas (&lt; 2.00)</p>
              <p className="text-3xl font-bold text-red-700">{reprovadas}</p>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 text-center">
              <p className="text-sm font-medium text-yellow-600">Não Avaliadas</p>
              <p className="text-3xl font-bold text-yellow-700">{naoAvaliadas}</p>
            </div>
          </div>

          {/* Listas Detalhadas */}
          <div className="space-y-6">
            <InscricaoList
              title="Inscrições Aprovadas"
              list={listaAprovadas}
              color={{ border: '#a7f3d0', bg: '#ecfdf5', text: '#059669' }} // Green
            />
            <InscricaoList
              title="Inscrições Reprovadas"
              list={listaReprovadas}
              color={{ border: '#fecaca', bg: '#fef2f2', text: '#ef4444' }} // Red
            />
            <InscricaoList
              title="Inscrições Não Avaliadas"
              list={listaNaoAvaliadas}
              color={{ border: '#fde68a', bg: '#fffdf0', text: '#f59e0b' }} // Yellow
            />
          </div>
        </div>

        {/* Rodapé com botão de download */}
        <div className="border-t pt-4 mt-4 flex justify-end">
          <button
            onClick={handleGeneratePDF}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-md"
          >
            <Download size={20} />
            Baixar PDF da Simulação
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.getElementById("modal-root") || document.body // Fallback para document.body
  );
};

export default ConsolidacaoModal;
