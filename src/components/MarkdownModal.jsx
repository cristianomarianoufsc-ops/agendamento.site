import React from "react";
import ReactDOM from "react-dom";
import { motion } from "framer-motion";
import { FileText, X, Printer } from "lucide-react";
import { marked } from 'marked'; // Importar marked para renderizar Markdown

// --- COMPONENTE PRINCIPAL: Modal para Conteúdo Markdown ---
const MarkdownModal = ({ title, markdownContent, onClose }) => {

  const handlePrint = () => {
    window.print();
  };

  // Função para renderizar o Markdown em HTML
  const renderMarkdown = () => {
    // marked.parse é a função correta para a versão mais recente do marked
    return { __html: marked.parse(markdownContent || '') };
  };

  return ReactDOM.createPortal(
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 print:hidden" 
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: -30, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }} 
        exit={{ y: 30, opacity: 0 }} 
        className="bg-white rounded-2xl shadow-xl p-6 m-4 w-full max-w-4xl max-h-[90vh] overflow-y-auto print:max-w-full print:max-h-full print:p-0 print:shadow-none print:m-0" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4 border-b pb-3 print:hidden">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FileText size={24} /> {title}
          </h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={handlePrint} 
              className="p-2 rounded-full text-gray-500 hover:bg-gray-200 transition-colors" 
              title="Imprimir"
            >
              <Printer size={20} />
            </button>
            <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-200 transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>
        
        {/* Conteúdo Renderizado do Markdown */}
        <div 
          className="markdown-content space-y-4 text-gray-700 p-2 print:p-6"
          dangerouslySetInnerHTML={renderMarkdown()}
        />
        
      </motion.div>
    </motion.div>,
    document.getElementById("modal-root")
  );
};

export default MarkdownModal;
