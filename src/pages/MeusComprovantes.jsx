import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Download, Search, Calendar, User, Mail, ArrowLeft, Theater, Church, Filter } from 'lucide-react';
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
  }, []);

  const fetchInscricoes = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/inscricoes');
      const data = await response.json();
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
      ins.nome.toLowerCase().includes(term) || 
      ins.email.toLowerCase().includes(term) || 
      ins.evento_nome.toLowerCase().includes(term)
    );
  }, [searchTerm, todasInscricoes]);

  const formatarDataHora = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

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
      if (u.ensaio_inicio) tableData.push(["Ensaio", new Date(u.ensaio_inicio).toLocaleDateString("pt-BR"), `${new Date(u.ensaio_inicio).toLocaleTimeString("pt-BR", {hour:'2-digit', minute:'2-digit'})} - ${new Date(u.ensaio_fim).toLocaleTimeString("pt-BR", {hour:'2-digit', minute:'2-digit'})}`]);
      if (u.montagem_inicio) tableData.push(["Montagem", new Date(u.montagem_inicio).toLocaleDateString("pt-BR"), `${new Date(u.montagem_inicio).toLocaleTimeString("pt-BR", {hour:'2-digit', minute:'2-digit'})} - ${new Date(u.montagem_fim).toLocaleTimeString("pt-BR", {hour:'2-digit', minute:'2-digit'})}`]);
      
      if (u.eventos_json) {
        try {
          const evs = JSON.parse(u.eventos_json);
          evs.forEach((ev, i) => {
            tableData.push([ev.nome || `Evento ${i + 1}`, new Date(ev.inicio).toLocaleDateString("pt-BR"), `${new Date(ev.inicio).toLocaleTimeString("pt-BR", {hour:'2-digit', minute:'2-digit'})} - ${new Date(ev.fim).toLocaleTimeString("pt-BR", {hour:'2-digit', minute:'2-digit'})}`]);
          });
        } catch (e) {}
      }
      if (u.desmontagem_inicio) tableData.push(["Desmontagem", new Date(u.desmontagem_inicio).toLocaleDateString("pt-BR"), `${new Date(u.desmontagem_inicio).toLocaleTimeString("pt-BR", {hour:'2-digit', minute:'2-digit'})} - ${new Date(u.desmontagem_fim).toLocaleTimeString("pt-BR", {hour:'2-digit', minute:'2-digit'})}`]);
      
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
      
      doc.save(`Inscricao_1Etapa_${u.evento_nome.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Erro ao gerar PDF.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">Comprovantes da 1ª Etapa</h1>
            <p className="text-gray-500 mt-1">Lista completa de inscrições realizadas no sistema.</p>
          </div>
          <button 
            onClick={() => window.close()} 
            className="hidden md:flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors font-medium"
          >
            Fechar aba
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-11 pr-4 py-4 border border-gray-200 rounded-2xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white sm:text-sm transition-all"
              placeholder="Pesquisar por nome, e-mail ou nome do evento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-500 font-medium">Carregando inscrições...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-8">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-lg font-bold text-gray-800">
                {inscricoesFiltradas.length === 0 
                  ? "Nenhuma inscrição encontrada." 
                  : `${inscricoesFiltradas.length} inscrição(ões) encontrada(s)`}
              </h2>
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Limpar filtro
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4">
              {inscricoesFiltradas.map((u) => (
                <div key={u.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:border-blue-300 hover:shadow-md transition-all">
                  <div className="p-5 md:p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-grow">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${u.local === 'teatro' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                            {u.local === 'teatro' ? <Theater size={12} /> : <Church size={12} />}
                            {u.local === 'teatro' ? 'Teatro' : 'Igrejinha'}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono bg-gray-100 px-2 py-1 rounded">#{String(u.id).padStart(3, '0')}</span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">{u.evento_nome || "Sem nome do evento"}</h3>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                          <div className="flex items-center gap-1.5">
                            <User size={14} className="text-gray-400" /> {u.nome}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Mail size={14} className="text-gray-400" /> {u.email}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Calendar size={14} className="text-gray-400" /> {new Date(u.criado_em).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <button
                          onClick={() => handleDownloadPDF(u)}
                          className="w-full md:w-auto inline-flex items-center justify-center px-5 py-2.5 border border-transparent text-sm font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm transition-all"
                        >
                          <Download className="mr-2 h-4 w-4" /> Baixar PDF
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MeusComprovantes;
