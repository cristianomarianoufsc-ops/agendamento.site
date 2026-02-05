import React, { useState, useEffect } from 'react';
import { FileText, Download, Search, Calendar, User, Mail, ArrowLeft, Theater, Church } from 'lucide-react';
import { Link } from 'react-router-dom';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const MeusComprovantes = () => {
  const [email, setEmail] = useState('');
  const [inscricoes, setInscricoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/inscricoes');
      const data = await response.json();
      
      // Filtrar inscrições pelo e-mail (case insensitive)
      const filtradas = (data.inscricoes || []).filter(
        ins => ins.email.toLowerCase() === email.toLowerCase()
      );
      
      setInscricoes(filtradas);
      setSearched(true);
    } catch (err) {
      console.error("Erro ao buscar inscrições:", err);
      setError("Ocorreu um erro ao buscar suas inscrições. Tente novamente mais tarde.");
    } finally {
      setLoading(false);
    }
  };

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
      
      // Título
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Comprovante de Inscrição - 1ª Etapa", 105, 20, { align: "center" });
      
      // Informações do local
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`Local: ${locaisNomes[u.local] || u.local}`, 20, 35);
      
      // Dados do responsável
      doc.setFont("helvetica", "bold");
      doc.text("Dados do Responsável:", 20, 45);
      doc.setFont("helvetica", "normal");
      doc.text(`Nome: ${u.nome}`, 20, 52);
      doc.text(`E-mail: ${u.email}`, 20, 59);
      doc.text(`Telefone: ${u.telefone || 'N/A'}`, 20, 66);
      doc.text(`Nome do Evento: ${u.evento_nome}`, 20, 73);
      
      // Tabela de agendamentos
      doc.setFont("helvetica", "bold");
      doc.text("Agendamentos Solicitados:", 20, 85);
      
      const tableData = [];
      
      if (u.ensaio_inicio) {
        tableData.push(["Ensaio", new Date(u.ensaio_inicio).toLocaleDateString("pt-BR"), `${new Date(u.ensaio_inicio).toLocaleTimeString("pt-BR", {hour:'2-digit', minute:'2-digit'})} - ${new Date(u.ensaio_fim).toLocaleTimeString("pt-BR", {hour:'2-digit', minute:'2-digit'})}`]);
      }
      if (u.montagem_inicio) {
        tableData.push(["Montagem", new Date(u.montagem_inicio).toLocaleDateString("pt-BR"), `${new Date(u.montagem_inicio).toLocaleTimeString("pt-BR", {hour:'2-digit', minute:'2-digit'})} - ${new Date(u.montagem_fim).toLocaleTimeString("pt-BR", {hour:'2-digit', minute:'2-digit'})}`]);
      }
      if (u.eventos_json) {
        try {
          const evs = JSON.parse(u.eventos_json);
          evs.forEach((ev, i) => {
            tableData.push([ev.nome || `Evento ${i + 1}`, new Date(ev.inicio).toLocaleDateString("pt-BR"), `${new Date(ev.inicio).toLocaleTimeString("pt-BR", {hour:'2-digit', minute:'2-digit'})} - ${new Date(ev.fim).toLocaleTimeString("pt-BR", {hour:'2-digit', minute:'2-digit'})}`]);
          });
        } catch (e) {}
      }
      if (u.desmontagem_inicio) {
        tableData.push(["Desmontagem", new Date(u.desmontagem_inicio).toLocaleDateString("pt-BR"), `${new Date(u.desmontagem_inicio).toLocaleTimeString("pt-BR", {hour:'2-digit', minute:'2-digit'})} - ${new Date(u.desmontagem_fim).toLocaleTimeString("pt-BR", {hour:'2-digit', minute:'2-digit'})}`]);
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
      
      doc.save(`Inscricao_1Etapa_${u.evento_nome.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Erro ao gerar PDF.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors font-medium">
            <ArrowLeft size={20} /> Voltar para o Início
          </Link>
          <h1 className="text-3xl font-extrabold text-gray-900">Meus Comprovantes</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
          <p className="text-gray-600 mb-6">
            Insira o e-mail utilizado na inscrição para localizar seus comprovantes da 1ª etapa.
          </p>
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
            <div className="flex-grow relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="email"
                required
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all"
                placeholder="seu-email@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <Search className="mr-2 h-5 w-5" /> Buscar
                </>
              )}
            </button>
          </form>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {searched && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800">
              {inscricoes.length === 0 
                ? "Nenhuma inscrição encontrada para este e-mail." 
                : `${inscricoes.length} inscrição(ões) localizada(s):`}
            </h2>

            {inscricoes.map((u) => (
              <div key={u.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-grow">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${u.local === 'teatro' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                          {u.local === 'teatro' ? <Theater size={12} /> : <Church size={12} />}
                          {u.local === 'teatro' ? 'Teatro' : 'Igrejinha'}
                        </span>
                        <span className="text-xs text-gray-400 font-mono">#{String(u.id).padStart(3, '0')}</span>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-1">{u.evento_nome}</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                          <User size={14} /> {u.nome}
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar size={14} /> {new Date(u.criado_em).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <button
                        onClick={() => handleDownloadPDF(u)}
                        className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 border border-blue-600 text-base font-medium rounded-xl text-blue-600 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all"
                      >
                        <Download className="mr-2 h-5 w-5" /> Baixar PDF
                      </button>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-6 py-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400 italic">
                    Este PDF contém os detalhes da 1ª etapa da sua inscrição.
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MeusComprovantes;
