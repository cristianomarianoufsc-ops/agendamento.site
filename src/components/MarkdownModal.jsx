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
        <div className="flex justify-between items-center mb-4 border-b-2 border-blue-500 pb-3 print:hidden">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FileText size={24} className="text-blue-600" /> {title}
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
          className="markdown-content space-y-6 text-gray-700 p-2 print:p-6 prose max-w-none"
          dangerouslySetInnerHTML={renderMarkdown()}
        >
          {/* Estilos adicionais para o conteúdo Markdown */}
          <style jsx global>{`
            .markdown-content h1 {
              font-size: 1.5rem; /* text-2xl */
              font-weight: 700; /* font-bold */
              color: #1f2937; /* gray-800 */
              border-bottom: 2px solid #3b82f6; /* blue-500 */
              padding-bottom: 0.5rem;
              margin-top: 1.5rem;
            }
            .markdown-content h2 {
              font-size: 1.25rem; /* text-xl */
              font-weight: 600; /* font-semibold */
              color: #1f2937; /* gray-800 */
              border-left: 4px solid #3b82f6; /* blue-500 */
              padding-left: 0.5rem;
              margin-top: 1.5rem;
            }
            .markdown-content table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 1rem;
              box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
            }
            .markdown-content th, .markdown-content td {
              padding: 0.75rem;
              border: 1px solid #e5e7eb; /* gray-200 */
              text-align: left;
            }
            .markdown-content th {
              background-color: #eff6ff; /* blue-50 */
              color: #1e40af; /* blue-800 */
              font-weight: 600;
              text-transform: uppercase;
              font-size: 0.75rem;
            }
            .markdown-content tr:nth-child(even) {
              background-color: #f9fafb; /* gray-50 */
            }
            .markdown-content ul {
              list-style-type: none;
              padding-left: 0;
            }
            .markdown-content ul li {
              margin-bottom: 0.5rem;
              padding-left: 1.5rem;
              position: relative;
            }
            .markdown-content ul li::before {
              content: "•";
              color: #3b82f6; /* blue-500 */
              font-weight: bold;
              display: inline-block;
              width: 1em;
              margin-left: -1.5em;
            }
          `}</style>
        </div>
        
      </motion.div>
    </motion.div>,
    document.getElementById("modal-root")
  );
};

export default MarkdownModal;
