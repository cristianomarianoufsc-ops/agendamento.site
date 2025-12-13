import React from "react";
import ReactDOM from "react-dom";
import { motion } from "framer-motion";
import { FileText, X } from "lucide-react";

// --- COMPONENTE AUXILIAR: SmartInfoRow (Replicado do EvaluationDrawer) ---
const SmartInfoRow = ({ label, value }) => {
  const isLink = (text) => typeof text === 'string' && (text.startsWith('http://' ) || text.startsWith('https://' ));
  const renderValue = () => {
    if (!value) return <span className="italic text-gray-400">Não informado</span>;
    const parts = value.split(', ');
    return (
      <div className="flex flex-col gap-1">
        {parts.map((part, index) => isLink(part) ? (
          <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">
            {part.split('/').pop().split('?')[0] || part}
          </a>
        ) : <span key={index}>{part}</span>)}
      </div>
    );
  };
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 py-2 border-b border-gray-100">
      <div className="text-sm font-bold text-gray-600">{label}</div>
      <div className="col-span-2 text-sm text-gray-800">{renderValue()}</div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL: Modal para Ficha Detalhada ---
const FormDataModal = ({ inscricao, onClose }) => {
  const renderAllFormsData = () => {
    if (!inscricao?.formsData) {
      return <div className="text-center py-4 text-gray-500">Proponente ainda não preencheu o formulário (Etapa 2).</div>;
    }
    const formKeys = Object.keys(inscricao.formsData);
    const keysToIgnore = ["carimbo de data/hora", "timestamp"];
    
    return formKeys.map(key => {
      if (keysToIgnore.some(ignored => key.toLowerCase().includes(ignored)) || !inscricao.formsData[key]) {
        return null;
      }
      return <SmartInfoRow key={key} label={key} value={inscricao.formsData[key]} />;
    });
  };

  return ReactDOM.createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
      <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} className="bg-white rounded-2xl shadow-xl p-6 m-4 w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4 border-b pb-3">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FileText size={24} /> Ficha de Inscrição Detalhada (Etapa 2)
          </h3>
          <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-200 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-4 text-gray-700">
          <div className="bg-gray-50 p-3 rounded-lg mb-4">
            <p className="text-sm font-semibold">Inscrição ID: {inscricao?.id} | Evento: {inscricao?.evento_nome}</p>
          </div>
          {renderAllFormsData()}
        </div>
      </motion.div>
    </motion.div>,
    document.getElementById("modal-root")
  );
};

export default FormDataModal;
