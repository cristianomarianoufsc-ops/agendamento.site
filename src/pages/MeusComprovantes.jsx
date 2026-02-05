import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Download, Search, Calendar, User, Mail, ArrowLeft, Theater, Church, CheckCircle, Table } from 'lucide-react';
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

  const renderEtapas = (u) => {
    const etapas = [];
    if (u.ensaio_inicio) etapas.push({ nome: 'Ensaio', inicio: u.ensaio_inicio, fim: u.ensaio_fim });
    if (u.montagem_inicio) etapas.push({ nome: 'Montagem', inicio: u.montagem_inicio, fim: u.montagem_fim });
    if (u.eventos_json) {
      try {
        const evs = JSON.parse(u.eventos_json);
        evs.forEach((ev, i) => {
          etapas.push({ nome: ev.nome || `Evento ${i + 1}`, inicio: ev.inicio, fim: ev.fim });
        });
      } catch (e) {}
    }
    if (u.desmontagem_inicio) etapas.push({ nome: 'Desmontagem', inicio: u.desmontagem_inicio, fim: u.desmontagem_fim });
    
    return etapas.map((et, idx) => (
      <div key={idx} className="text-xs border-b border-gray-100 last:border-0 py-1">
        <span className="font-semibold text-blue-600">{et.nome}:</span> {new Date(et.inicio).toLocaleDateString('pt-BR')} {new Date(et.inicio).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}-{new Date(et.fim).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}
      </div>
    ));
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Cabeçalho */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight flex items-center justify-center gap-3">
            <Table className="text-blue-600" size={40} /> Meus Comprovantes
          </h1>
          <p className="text-lg text-gray-500 mt-3">Visualização em planilha das inscrições realizadas (1ª Etapa)</p>
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
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-2 mb-10 max-w-3xl mx-auto">
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

        {/* Tabela de Comprovantes */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-14 w-14 border-b-4 border-blue-600"></div>
            <p className="mt-6 text-gray-500 font-bold text-xl">Carregando dados da planilha...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border-2 border-red-100 rounded-2xl p-8 text-center max-w-3xl mx-auto">
            <p className="text-red-700 font-bold text-lg">{error}</p>
            <button 
              onClick={fetchInscricoes}
              className="mt-4 px-6 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all"
            >
              Tentar Novamente
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="px-6 py-4 font-bold uppercase text-sm">ID</th>
                    <th className="px-6 py-4 font-bold uppercase text-sm">Evento</th>
                    <th className="px-6 py-4 font-bold uppercase text-sm">Responsável</th>
                    <th className="px-6 py-4 font-bold uppercase text-sm">Local</th>
                    <th className="px-6 py-4 font-bold uppercase text-sm">Data de Inscrição</th>
                    <th className="px-6 py-4 font-bold uppercase text-sm">Agendamentos</th>
                    <th className="px-6 py-4 font-bold uppercase text-sm text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {inscricoesFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-20 text-center">
                        <FileText size={64} className="mx-auto text-gray-200 mb-6" />
                        <h3 className="text-2xl font-bold text-gray-800 mb-2">Nenhum dado encontrado</h3>
                        <p className="text-gray-500">Você ainda não realizou nenhuma inscrição ou o termo pesquisado não retornou resultados.</p>
                      </td>
                    </tr>
                  ) : (
                    inscricoesFiltradas.map((u) => (
                      <tr key={u.id} className="hover:bg-blue-50 transition-colors">
                        <td className="px-6 py-4 font-mono text-gray-400 text-sm">#{String(u.id).padStart(3, '0')}</td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900">{u.evento_nome || "Sem nome"}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-700">{u.nome}</div>
                          <div className="text-xs text-gray-500">{u.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${u.local === 'teatro' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                            {u.local === 'teatro' ? <Theater size={14} /> : <Church size={14} />}
                            {u.local === 'teatro' ? 'Teatro' : 'Igrejinha'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(u.criado_em || u.created_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 min-w-[250px]">
                          {renderEtapas(u)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleDownloadPDF(u)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all active:scale-95 shadow-md shadow-blue-100"
                            title="Baixar PDF"
                          >
                            <Download size={18} /> PDF
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {inscricoesFiltradas.length > 0 && (
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-100">
                <p className="text-gray-500 text-sm font-medium">
                  Mostrando {inscricoesFiltradas.length} registro(s) na planilha.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MeusComprovantes;
