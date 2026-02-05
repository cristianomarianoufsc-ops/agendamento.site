import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Download, Search, Calendar, User, Mail, ArrowLeft, Theater, Church, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const MeusComprovantes = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [todasInscricoes, setTodasInscricoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchInscricoes();

    // Atualiza os dados sempre que o usuário volta para esta aba
    const handleFocus = () => fetchInscricoes();
    window.addEventListener('focus', handleFocus);
    
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const fetchInscricoes = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/inscricoes');
      const data = await response.json();
      // Filtramos apenas as inscrições que têm os dados básicos necessários
      setTodasInscricoes(data.inscricoes || []);
    } catch (err) {
      console.error("Erro ao buscar inscrições:", err);
      setError("Ocorreu um erro ao carregar as inscrições. Tente novamente mais tarde.");
    } finally {
      setLoading(false);
    }
  };

  const inscricoesFiltradas = useMemo(() => {
    if (!searchTerm.trim()) return todasInscricoes;
    
    const term = searchTerm.toLowerCase();
    return todasInscricoes.filter(ins => 
      (ins.nome && ins.nome.toLowerCase().includes(term)) || 
      (ins.email && ins.email.toLowerCase().includes(term)) || 
      (ins.evento_nome && ins.evento_nome.toLowerCase().includes(term))
    );
  }, [searchTerm, todasInscricoes]);

  const handleDownloadPDF = (u) => {
    try {
      const doc = new jsPDF();
      const locaisNomes = { teatro: "Teatro Carmen Fossari", igrejinha: "Igrejinha da UFSC" };
      
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Comprovante de Inscrição - 1ª Etapa", 105, 20, { align: "center" });
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`Local: ${locaisNomes[u.local] || u.local}`, 20, 35);
      
      doc.setFont("helvetica", "bold");
      doc.text("Dados do Responsável:", 20, 45);
      doc.setFont("helvetica", "normal");
      doc.text(`Nome: ${u.nome}`, 20, 52);
      doc.text(`E-mail: ${u.email}`, 20, 59);
      doc.text(`Telefone: ${u.telefone || 'N/A'}`, 20, 66);
      doc.text(`Nome do Evento: ${u.evento_nome}`, 20, 73);
      
      doc.setFont("helvetica", "bold");
      doc.text("Agendamentos Solicitados:", 20, 85);
      
      const tableData = [];
      
      // Ensaio
      if (u.ensaio_inicio) {
        tableData.push([
          "Ensaio", 
          new Date(u.ensaio_inicio).toLocaleDateString("pt-BR"), 
          `${new Date(u.ensaio_inicio).toLocaleTimeString("pt-BR", {hour:'2-digit', minute:'2-digit'})} - ${new Date(u.ensaio_fim).toLocaleTimeString("pt-BR", {hour:'2-digit', minute:'2-digit'})}`
        ]);
      }
      
      // Montagem
      if (u.montagem_inicio) {
        tableData.push([
          "Montagem", 
          new Date(u.montagem_inicio).toLocaleDateString("pt-BR"), 
          `${new Date(u.montagem_inicio).toLocaleTimeString("pt-BR", {hour:'2-digit', minute:'2-digit'})} - ${new Date(u.montagem_fim).toLocaleTimeString("pt-BR", {hour:'2-digit', minute:'2-digit'})}`
        ]);
      }
      
      // Eventos (JSON)
      if (u.eventos_json) {
        try {
          const evs = JSON.parse(u.eventos_json);
          evs.forEach((ev, i) => {
            tableData.push([
              ev.nome || `Evento ${i + 1}`, 
              new Date(ev.inicio).toLocaleDateString("pt-BR"), 
              `${new Date(ev.inicio).toLocaleTimeString("pt-BR", {hour:'2-digit', minute:'2-digit'})} - ${new Date(ev.fim).toLocaleTimeString("pt-BR", {hour:'2-digit', minute:'2-digit'})}`
            ]);
          });
        } catch (e) {
          console.error("Erro ao processar eventos_json:", e);
        }
      }
      
      // Desmontagem
      if (u.desmontagem_inicio) {
        tableData.push([
          "Desmontagem", 
          new Date(u.desmontagem_inicio).toLocaleDateString("pt-BR"), 
          `${new Date(u.desmontagem_inicio).toLocaleTimeString("pt-BR", {hour:'2-digit', minute:'2-digit'})} - ${new Date(u.desmontagem_fim).toLocaleTimeString("pt-BR", {hour:'2-digit', minute:'2-digit'})}`
        ]);
      }
      
      doc.autoTable({
        startY: 90,
        head: [["Etapa", "Data", "Horário"]],
        body: tableData,
        theme: "striped",
        headStyles: { fillColor: [37, 99, 235] },
        margin: { left: 20, right: 20 }
      });
      
      const finalY = doc.lastAutoTable.finalY || 90;
      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.text(`Reemitido em: ${new Date().toLocaleString("pt-BR")}`, 20, finalY + 15);
      doc.text("Este é um comprovante de inscrição da 1ª etapa.", 20, finalY + 22);
      
      doc.save(`Inscricao_1Etapa_${(u.evento_nome || 'Evento').replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Erro ao gerar PDF.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto">
        {/* Cabeçalho */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Meus Comprovantes</h1>
          <p className="text-lg text-gray-500 mt-3">Histórico de inscrições e downloads de comprovantes (1ª Etapa)</p>
          <div className="mt-6 flex justify-center">
            <Link 
              to="/" 
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors font-bold"
            >
              <ArrowLeft size={20} /> Voltar para o Início
            </Link>
          </div>
        </div>

        {/* Barra de Pesquisa */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-2 mb-10">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <Search className="h-6 w-6 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-14 pr-6 py-5 border-none rounded-3xl leading-5 bg-transparent placeholder-gray-400 focus:outline-none focus:ring-0 text-lg transition-all"
              placeholder="Pesquisar por nome ou evento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Lista de Comprovantes */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-14 w-14 border-b-4 border-blue-600"></div>
            <p className="mt-6 text-gray-500 font-bold text-xl">Carregando seus comprovantes...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border-2 border-red-100 rounded-2xl p-8 text-center">
            <p className="text-red-700 font-bold text-lg">{error}</p>
            <button 
              onClick={fetchInscricoes}
              className="mt-4 px-6 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all"
            >
              Tentar Novamente
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {inscricoesFiltradas.length === 0 ? (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-16 text-center">
                <FileText size={64} className="mx-auto text-gray-200 mb-6" />
                <h3 className="text-2xl font-bold text-gray-800 mb-2">Nenhum comprovante encontrado</h3>
                <p className="text-gray-500">Você ainda não realizou nenhuma inscrição ou o termo pesquisado não retornou resultados.</p>
              </div>
            ) : (
              inscricoesFiltradas.map((u) => (
                <div key={u.id} className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
                  <div className="p-8">
                    <div className="flex flex-col gap-6">
                      {/* Status e ID */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="bg-green-100 text-green-700 px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-2">
                            <CheckCircle size={18} /> Etapa 1 Concluída!
                          </div>
                          <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider ${u.local === 'teatro' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                            {u.local === 'teatro' ? <Theater size={16} /> : <Church size={16} />}
                            {u.local === 'teatro' ? 'Teatro' : 'Igrejinha'}
                          </span>
                        </div>
                        <span className="text-sm text-gray-400 font-mono bg-gray-50 px-3 py-1 rounded-lg border border-gray-100">ID #{String(u.id).padStart(3, '0')}</span>
                      </div>

                      {/* Título do Evento */}
                      <div>
                        <h3 className="text-2xl font-black text-gray-900 leading-tight">{u.evento_nome || "Sem nome do evento"}</h3>
                        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-gray-500 font-medium">
                          <div className="flex items-center gap-2">
                            <User size={18} className="text-blue-500" /> {u.nome}
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar size={18} className="text-blue-500" /> {new Date(u.criado_em || u.created_at).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                      </div>

                      {/* Botão de Download - O "Backup" solicitado */}
                      <div className="pt-4 border-t border-gray-50">
                        <button
                          onClick={() => handleDownloadPDF(u)}
                          className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-blue-600 text-white text-lg font-black rounded-2xl hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 shadow-lg shadow-blue-200 transition-all active:scale-95"
                        >
                          <Download size={24} /> Baixar Comprovante em PDF
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
            
            {inscricoesFiltradas.length > 0 && (
              <p className="text-center text-gray-400 text-sm font-medium pb-10">
                Mostrando {inscricoesFiltradas.length} comprovante(s) disponível(is) para download.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MeusComprovantes;
