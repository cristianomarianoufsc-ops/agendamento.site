import React, { useState, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Settings, Save, Download, Trash2, Contact, Loader, X, FileText, Archive, AlertTriangle, CheckCircle, Search, Theater, Church, Eye, EyeOff,
  SlidersHorizontal, Scale, ChevronsUpDown, Edit, Type, FileClock, 
  PlusCircle, UserCheck, Presentation
} from "lucide-react";
import EvaluationDrawer from './EvaluationDrawer';
import FormDataModal from './FormDataModal';
import SlidesViewer from './SlidesViewer';
import ConsolidacaoModal from './ConsolidacaoModal';
import InscricoesRecebidasNew from './InscricoesRecebidasNew'; // ✅ NOVO COMPONENTE
import { v4 as uuidv4 } from 'uuid';

// Componente Modal (sem alterações)
const Modal = ({ user, onClose }) => {
  const findFormsEmail = (formData) => { if (!formData) return null; const emailKey = Object.keys(formData).find((k) => k.toLowerCase().includes("mail")); return emailKey ? formData[emailKey] : null; };
  const findFormsPhone = (formData) => { if (!formData) return null; const telKey = Object.keys(formData).find((k) => k.toLowerCase().includes("fone")); return telKey ? formData[telKey] : null; };
  return ReactDOM.createPortal( <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}> <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} className="bg-white rounded-2xl shadow-xl p-6 m-4 w-full max-w-md" onClick={(e) => e.stopPropagation()}> <div className="flex justify-between items-center mb-4"> <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"> <Contact size={24} /> Contatos de {user?.nome || "Usuário"} </h3> <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"> <X size={20} /> </button> </div> <div className="space-y-4 text-gray-700"> <p><strong>Nome:</strong> {user?.nome}</p> <div> <p><strong>Telefone(s):</strong></p> <ul className="list-disc list-inside ml-2 text-gray-600"> {findFormsPhone(user?.formsData) ? ( <li>{findFormsPhone(user.formsData)} (Etapa 2)</li> ) : ( <li>{user?.telefone || "N/A"} (Etapa 1)</li> )} </ul> </div> <div> <p><strong>E-mail(s):</strong></p> <ul className="list-disc list-inside ml-2 text-gray-600"> <li>{user?.email || "N/A"} (Etapa 1)</li> {user?.formsData && findFormsEmail(user.formsData) && findFormsEmail(user.formsData).toLowerCase() !== user?.email?.toLowerCase() && ( <li>{findFormsEmail(user.formsData)} (Etapa 2)</li> )} </ul> </div> </div> </motion.div> </motion.div>, document.getElementById("modal-root") );
};

// Função auxiliar para extrair o ID do Google Forms ou Sheets
const extractIdFromUrl = (url) => {
  if (!url) return "";
  const match = url.match(/(?:forms\/d\/e\/|spreadsheets\/d\/)([a-zA-Z0-9_-]+)/);
  return match ? match[1] : url;
};

// --- COMPONENTE PRINCIPAL ---
const Admin = ({ viewOnly = false }) => {
  // --- ESTADOS ---
  const [unificados, setUnificados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isGeneratingSlides, setIsGeneratingSlides] = useState(false);
  const [showSlidesViewer, setShowSlidesViewer] = useState(false);
  const [showFormDataModal, setShowFormDataModal] = useState(false);
  const [showConsolidacaoModal, setShowConsolidacaoModal] = useState(false);
  const [consolidacaoData, setConsolidacaoData] = useState(null);
  const [selectedFormData, setSelectedFormData] = useState(null);
  const [slidesData, setSlidesData] = useState(null);
  const [openAccordionId, setOpenAccordionId] = useState(null);
  
  // Estados de Configuração
  const [formsLink, setFormsLink] = useState("");
  const [sheetLink, setSheetLink] = useState("");
  const [useFixedLinks, setUseFixedLinks] = useState(true);
  const [pageTitle, setPageTitle] = useState("Sistema de Agendamento de Espaços");
  const [evaluationCriteria, setEvaluationCriteria] = useState([]);
  const [evaluators, setEvaluators] = useState([]);
  const [allowBookingOverlap, setAllowBookingOverlap] = useState(false);
  const [blockedDates, setBlockedDates] = useState([]);
  const [dateToToggle, setDateToToggle] = useState('');
  const [stageTimes, setStageTimes] = useState({
    ensaio: { start: "08:00", end: "21:00" },
    montagem: { start: "08:00", end: "21:00" },
    evento: { start: "08:00", end: "21:00" },
    desmontagem: { start: "08:00", end: "21:00" },
  });

  const [enableInternalEdital, setEnableInternalEdital] = useState(false);
  const [enableExternalEdital, setEnableExternalEdital] = useState(true);
  const [enableRehearsal, setEnableRehearsal] = useState(true);
  const [buttonExternalEditalText, setButtonExternalEditalText] = useState("Edital Externo");
  const [requiredAssessments, setRequiredAssessments] = useState(3);

  // Estados de Navegação e Filtro
  const [mainTab, setMainTab] = useState('inscricoes');
  const [inscricoesTab, setInscricoesTab] = useState('eventos');
  const [localFilters, setLocalFilters] = useState({ teatro: true, igrejinha: true });
  const [sortOrder, setSortOrder] = useState('id_asc');
  const [assessmentFilter, setAssessmentFilter] = useState('todos');
  const [evaluatorEmail, setEvaluatorEmail] = useState(localStorage.getItem('evaluatorEmail') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [evaluatorPassword, setEvaluatorPassword] = useState('');
  const [conflictFilter, setConflictFilter] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(!!sessionStorage.getItem('adminAuth'));
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showEvaluatorPassword, setShowEvaluatorPassword] = useState(false);

  // --- FUNÇÕES DE API ---
  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/inscricoes");
      const data = await response.json();
      setUnificados(data.inscricoes || []);
      setEvaluationCriteria(data.criteria || []);
    } catch (err) { 
      console.error("Erro ao carregar dados:", err);
      setUnificados([]);
    } finally { 
      setLoading(false); 
    }
  };

  const fetchEvaluators = async () => {
    if (viewOnly) return;
    try {
        const response = await fetch("/api/evaluators");
        const data = await response.json();
        setEvaluators(Array.isArray(data) ? data : []);
    } catch (error) {
        console.error("Erro ao buscar avaliadores:", error);
        setEvaluators([]);
    }
  };

  useEffect(() => {
    fetchData();
    if (!viewOnly) {
      fetchEvaluators();
      fetch("/api/config").then(res => res.json()).then(data => {
        if (data.formsLink) setFormsLink(data.formsLink);
        if (data.sheetLink) setSheetLink(data.sheetLink);
        if (data.useFixedLinks !== undefined) setUseFixedLinks(data.useFixedLinks);
        if (data.pageTitle) setPageTitle(data.pageTitle);
        if (data.allowBookingOverlap) setAllowBookingOverlap(data.allowBookingOverlap);
        if (data.blockedDates) setBlockedDates(data.blockedDates);
        if (data.stageTimes) setStageTimes(data.stageTimes);
        setEnableInternalEdital(data.enableInternalEdital);
        setEnableExternalEdital(data.enableExternalEdital);
        setEnableRehearsal(data.enableRehearsal);
        if (data.buttonExternalEditalText) setButtonExternalEditalText(data.buttonExternalEditalText);
        if (data.requiredAssessments) setRequiredAssessments(data.requiredAssessments);
      }).catch(err => console.error("Erro ao carregar config:", err));
    }
  }, [viewOnly]);

  // --- HANDLERS ---
  const handleSaveConfig = async (configData) => {
    try {
      const response = await fetch("/api/config", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configData),
      });
      if (response.ok) alert("✅ Configurações salvas com sucesso!");
      else throw new Error("Erro no servidor.");
    } catch (error) {
      alert("❌ Erro ao salvar configurações.");
    }
  };

  const handleToggleDate = () => {
    if (!dateToToggle) return;
    const isBlocked = blockedDates.includes(dateToToggle);
    const newBlockedDates = isBlocked ? blockedDates.filter(d => d !== dateToToggle) : [...blockedDates, dateToToggle].sort();
    setBlockedDates(newBlockedDates);
    handleSaveConfig({ blockedDates: newBlockedDates });
    setDateToToggle('');
  };

  const handleToggleDateFromList = (date) => {
    const newBlockedDates = blockedDates.filter(d => d !== date);
    setBlockedDates(newBlockedDates);
    handleSaveConfig({ blockedDates: newBlockedDates });
  };

  const handleShowFormDataModal = (inscricao) => {
    setSelectedFormData(inscricao);
    setShowFormDataModal(true);
  };

  const handleAdminLogin = async () => {
    if (!adminPassword) { alert("Por favor, insira a senha de administrador."); return; }
    try {
      const response = await fetch("/api/auth/admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword }),
      });
      const data = await response.json();
      if (data.success) {
        sessionStorage.setItem('adminAuth', 'true');
        setIsAdminAuthenticated(true);
        setAdminPassword('');
      } else { alert(data.message || "❌ Senha incorreta."); }
    } catch (error) { alert("❌ Erro ao tentar conectar com o servidor."); }
  };

  const handleAdminLogout = () => {
    sessionStorage.removeItem('adminAuth');
    setIsAdminAuthenticated(false);
    window.location.reload();
  };

  const handleViewerLogout = () => {
    localStorage.removeItem('evaluatorEmail');
    setIsAuthenticated(false);
    window.location.reload();
  };

  const handleDelete = async (id) => {
    if (window.confirm("Deseja realmente excluir esta inscrição?")) {
      try {
        const res = await fetch(`/api/inscricao/${id}`, { method: "DELETE" });
        if (res.ok) { alert("✅ Inscrição excluída."); fetchData(); }
        else { alert("⚠️ Erro ao excluir."); }
      } catch (err) { alert("❌ Erro de comunicação."); }
    }
  };

  const handleGenerateSlides = async () => {
    if (isGeneratingSlides) return;
    setIsGeneratingSlides(true);
    try {
      const response = await fetch("/api/admin/data-for-analysis");
      if (!response.ok) throw new Error("Falha ao buscar dados para análise.");
      const data = await response.json();
      setSlidesData(data);
      setShowSlidesViewer(true);
    } catch (error) {
      alert(`❌ Erro ao gerar slides: ${error.message}`);
    } finally {
      setIsGeneratingSlides(false);
    }
  };

  const handleDownloadAllZip = async () => {
    if (!window.confirm("Deseja baixar o ZIP de todos os anexos?")) return;
    setIsDownloading(true);
    try {
      const response = await fetch("/api/download-all-zips");
      if (!response.ok) throw new Error(`Erro: ${response.statusText}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "inscricoes-completas.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) { alert(`❌ Falha ao baixar: ${err.message}`); }
    finally { setIsDownloading(false); }
  };

  const handleForceCleanup = async () => {
    if (!window.confirm("⚠️ ATENÇÃO: Isso apagará TODAS as inscrições e avaliações. Deseja continuar?")) return;
    try {
      const res = await fetch("/api/cleanup/force", { method: "POST" });
      if (res.ok) { alert("✅ Limpeza concluída."); fetchData(); }
      else { alert("❌ Erro na limpeza."); }
    } catch (err) { alert("❌ Erro de comunicação."); }
  };

  const handleConsolidateAgenda = async () => {
    try {
      const res = await fetch("/api/consolidate-agenda", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setConsolidacaoData(data);
        setShowConsolidacaoModal(true);
        fetchData();
      } else { alert(`❌ Erro: ${data.error}`); }
    } catch (err) { alert("❌ Erro de comunicação."); }
  };

  const handleCriterionChange = (id, field, value) => {
    setEvaluationCriteria(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleAddCriterion = () => {
    const newCriterion = { id: uuidv4(), title: 'Novo Critério', description: 'Descrição.', weight: 1, sort_order: evaluationCriteria.length };
    setEvaluationCriteria(prev => [...prev, newCriterion]);
  };

  const handleRemoveCriterion = (id) => {
    if (window.confirm("Remover este critério?")) {
      setEvaluationCriteria(prev => prev.filter(c => c.id !== id).map((c, index) => ({ ...c, sort_order: index })));
    }
  };

  const handleSaveCriteria = async () => {
    try {
      const response = await fetch("/api/criteria", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(evaluationCriteria.map((c, index) => ({ ...c, sort_order: index }))),
      });
      if (response.ok) { alert("✅ Critérios salvos!"); fetchData(); }
    } catch (error) { alert("❌ Erro ao salvar critérios."); }
  };

  const handleAddEvaluator = (email) => {
    if (email && email.trim() !== '') {
      const trimmedEmail = email.trim();
      if (!evaluators.some(e => e.email === trimmedEmail)) {
        setEvaluators(prev => [...prev, { id: `new-${Date.now()}`, email: trimmedEmail }]);
      }
    }
  };

  const handleRemoveEvaluator = async (id) => {
    if (typeof id === 'string' && id.startsWith('new-')) {
      setEvaluators(prev => prev.filter(e => e.id !== id));
      return;
    }
    if (window.confirm("Remover este avaliador?")) {
      try {
        const response = await fetch(`/api/evaluators/${id}`, { method: 'DELETE' });
        if (response.ok) setEvaluators(prev => prev.filter(e => e.id !== id));
      } catch (error) { alert("Erro ao remover avaliador."); }
    }
  };

  const handleSaveEvaluators = async () => {
    try {
      const response = await fetch("/api/evaluators", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evaluators: evaluators.map(e => ({ email: e.email })), sharedPassword: "dac.ufsc2026" }),
      });
      if (response.ok) { alert("Avaliadores salvos!"); fetchEvaluators(); }
    } catch (error) { alert("Erro ao salvar avaliadores."); }
  };

  // --- RENDERIZAÇÃO ---
  if (!viewOnly && !isAdminAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Acesso Administrativo</h2>
          <div className="relative mb-6">
            <input
              type={showAdminPassword ? "text" : "password"}
              placeholder="Senha de administrador"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg pr-10 focus:ring-blue-500 focus:border-blue-500"
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdminLogin(); }}
              autoFocus
            />
            <button type="button" onClick={() => setShowAdminPassword(!showAdminPassword)} className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
              {showAdminPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <button onClick={handleAdminLogin} className="w-full bg-blue-600 text-white font-semibold p-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
            <CheckCircle size={20} /> Entrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">{viewOnly ? 'Painel de Avaliação' : 'Painel Administrativo'}</h1>
          <p className="text-gray-600">{viewOnly ? 'Avalie as propostas de eventos recebidas.' : 'Gerencie as inscrições e configurações do sistema.'}</p>
          {viewOnly && evaluatorEmail && (
            <div className="flex items-center justify-between mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm font-semibold text-blue-800">Avaliador Logado: {evaluatorEmail}</p>
              <button onClick={handleViewerLogout} className="text-sm text-red-600 hover:text-red-800 font-medium">Sair</button>
            </div>
          )}
          {!viewOnly && isAdminAuthenticated && (
            <div className="flex items-center justify-between mt-2 p-2 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm font-semibold text-green-800">✅ Sessão Administrativa Ativa</p>
              <button onClick={handleAdminLogout} className="text-sm text-red-600 hover:text-red-800 font-medium flex items-center gap-1"><X size={16} /> Sair</button>
            </div>
          )}
        </header>

        {!viewOnly && (
          <div className="flex border-b border-gray-200 mb-8 overflow-x-auto">
            <button onClick={() => setMainTab('inscricoes')} className={`flex items-center gap-2 px-4 py-2 text-lg font-semibold whitespace-nowrap transition-colors ${mainTab === 'inscricoes' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
              <Search size={20} /> Inscrições Recebidas
            </button>
            <button onClick={() => setMainTab('configuracoes_gerais')} className={`flex items-center gap-2 px-4 py-2 text-lg font-semibold whitespace-nowrap transition-colors ${mainTab === 'configuracoes_gerais' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
              <SlidersHorizontal size={20} /> Configurações Gerais
            </button>
            <button onClick={() => setMainTab('configuracoes_avaliacao')} className={`flex items-center gap-2 px-4 py-2 text-lg font-semibold whitespace-nowrap transition-colors ${mainTab === 'configuracoes_avaliacao' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
              <Scale size={20} /> Configurações de Avaliação
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div key={mainTab} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: 0.2 }}>
            {(mainTab === 'inscricoes' || viewOnly) && (
              <div className="bg-white p-6 rounded-2xl shadow-md">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                  <h3 className="font-bold text-xl text-gray-700">{!viewOnly ? 'Lista de Inscrições' : 'Propostas de Eventos'}</h3>
                  {!viewOnly && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={handleDownloadAllZip} disabled={isDownloading} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 text-sm disabled:bg-gray-400">
                        {isDownloading ? <Loader className="animate-spin" size={16} /> : <Download size={16} />} Baixar Tudo (ZIP)
                      </button>
                      <button onClick={handleGenerateSlides} disabled={isGeneratingSlides} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 text-sm disabled:bg-purple-400">
                        {isGeneratingSlides ? <Loader className="animate-spin" size={16} /> : <Presentation size={16} />} Gerar Slides
                      </button>
                      <button onClick={handleForceCleanup} className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white font-semibold rounded-lg hover:bg-red-800 text-sm">
                        <AlertTriangle size={16} /> Limpeza Geral
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
                  {!viewOnly ? (
                    <div className="border-b border-gray-200">
                      <nav className="-mb-px flex space-x-6">
                        <button onClick={() => setInscricoesTab('eventos')} className={`pb-3 px-1 border-b-2 font-medium text-sm ${inscricoesTab === 'eventos' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Eventos</button>
                        <button onClick={() => setInscricoesTab('ensaios')} className={`pb-3 px-1 border-b-2 font-medium text-sm ${inscricoesTab === 'ensaios' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Ensaios</button>
                      </nav>
                    </div>
                  ) : <div className="w-full border-b border-gray-200"></div>}

                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="relative">
                      <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="pl-8 pr-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="id_asc">Ordenar por Inscrição</option>
                        <option value="nota_desc">Maior Nota</option>
                        <option value="nota_asc">Menor Nota</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-2 text-gray-500"><ChevronsUpDown size={16} /></div>
                    </div>
                    <div className="relative">
                      <select value={assessmentFilter} onChange={(e) => setAssessmentFilter(e.target.value)} className="pl-8 pr-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="todos">Mostrar Todos</option>
                        <option value="avaliados">{viewOnly ? 'Apenas Avaliados por Mim' : 'Apenas Avaliados (100%)'}</option>
                        <option value="nao_avaliados">{viewOnly ? 'Não Avaliados por Mim' : 'Não Avaliados (Pendente)'}</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-2 text-gray-500"><ChevronsUpDown size={16} /></div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700"><input type="checkbox" checked={localFilters.teatro} onChange={() => setLocalFilters(p => ({...p, teatro: !p.teatro}))} className="h-4 w-4 rounded border-gray-300 text-blue-600" /><Theater size={16} /> Teatro</label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700"><input type="checkbox" checked={localFilters.igrejinha} onChange={() => setLocalFilters(p => ({...p, igrejinha: !p.igrejinha}))} className="h-4 w-4 rounded border-gray-300 text-blue-600" /><Church size={16} /> Igrejinha</label>
                  </div>
                </div>

                {/* ✅ NOVO COMPONENTE INTEGRADO */}
                <InscricoesRecebidasNew 
                  unificados={unificados}
                  loading={loading}
                  inscricoesTab={inscricoesTab}
                  localFilters={localFilters}
                  sortOrder={sortOrder}
                  assessmentFilter={assessmentFilter}
                  viewOnly={viewOnly}
                  evaluatorEmail={evaluatorEmail}
                  onShowFormData={handleShowFormDataModal}
                  onDelete={handleDelete}
                  onEdit={(u) => { setSelectedUser(u); setShowModal(true); }}
                  onEvaluate={(u) => { setSelectedUser(u); setShowModal(true); }}
                />
              </div>
            )}

            {mainTab === 'configuracoes_gerais' && !viewOnly && (
              <div className="space-y-8">
                <div className="bg-white p-6 rounded-2xl shadow-md">
                  <h3 className="font-bold text-xl mb-4 text-gray-700 flex items-center gap-2"><Settings size={20} /> Configurações do Site</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block font-semibold text-gray-600 mb-2">Título da Página</label>
                      <input type="text" value={pageTitle} onChange={(e) => setPageTitle(e.target.value)} className="p-3 border rounded-lg w-full" />
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-600 mb-2">Texto do Botão Edital Externo</label>
                      <input type="text" value={buttonExternalEditalText} onChange={(e) => setButtonExternalEditalText(e.target.value)} className="p-3 border rounded-lg w-full" />
                    </div>
                  </div>
                  <div className="mt-6">
                    <button onClick={() => handleSaveConfig({ pageTitle, buttonExternalEditalText })} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700"><Save size={18} /> Salvar Configurações</button>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-md">
                  <h3 className="font-bold text-xl mb-4 text-gray-700 flex items-center gap-2"><FileClock size={20} /> Controle de Horários e Datas</h3>
                  <div className="space-y-6">
                    <div className="border p-4 rounded-lg">
                      <h4 className="font-semibold text-lg mb-3 text-gray-700">Horários Limite por Etapa</h4>
                      {Object.keys(stageTimes).map((stage) => (
                        <div key={stage} className="flex items-center gap-4 mb-3">
                          <label className="w-24 capitalize font-medium text-gray-600">{stage}:</label>
                          <input type="time" value={stageTimes[stage].start} onChange={(e) => setStageTimes(prev => ({ ...prev, [stage]: { ...prev[stage], start: e.target.value } }))} className="p-2 border rounded-lg text-sm w-28" />
                          <span className="text-gray-500">-</span>
                          <input type="time" value={stageTimes[stage].end} onChange={(e) => setStageTimes(prev => ({ ...prev, [stage]: { ...prev[stage], end: e.target.value } }))} className="p-2 border rounded-lg text-sm w-28" />
                        </div>
                      ))}
                      <div className="mt-4">
                        <button onClick={() => handleSaveConfig({ stageTimes })} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700"><Save size={18} /> Salvar Horários</button>
                      </div>
                    </div>

                    <div className="border p-4 rounded-lg">
                      <h4 className="font-semibold text-lg mb-3 text-gray-700">Bloqueio de Datas</h4>
                      <div className="flex gap-4 items-end">
                        <div className="flex-grow">
                          <label className="block font-medium text-gray-600 mb-2">Data a Bloquear/Desbloquear</label>
                          <input type="date" className="p-2 border rounded-lg w-full" value={dateToToggle} onChange={(e) => setDateToToggle(e.target.value)} />
                        </div>
                        <button onClick={handleToggleDate} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 h-10" disabled={!dateToToggle}><Save size={18} /> Salvar Datas</button>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {blockedDates.map(date => (
                          <span key={date} className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm flex items-center gap-1">
                            {new Date(date + 'T00:00:00').toLocaleDateString('pt-BR')}
                            <button onClick={() => handleToggleDateFromList(date)} className="text-red-500 hover:text-red-700 ml-1"><X size={14} /></button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {mainTab === 'configuracoes_avaliacao' && !viewOnly && (
              <div className="space-y-8">
                <div className="bg-white p-6 rounded-2xl shadow-md">
                  <h3 className="font-bold text-xl mb-4 text-gray-700 flex items-center gap-2"><UserCheck size={20} /> Regras de Avaliação</h3>
                  <div>
                    <label className="block font-semibold text-gray-600 mb-2">Avaliações Necessárias por Inscrição</label>
                    <input type="number" min="1" value={requiredAssessments} onChange={(e) => setRequiredAssessments(parseInt(e.target.value, 10) || 1)} className="p-3 border rounded-lg w-full max-w-xs" />
                  </div>
                  <div className="mt-6">
                    <button onClick={() => handleSaveConfig({ requiredAssessments })} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700"><Save size={18} /> Salvar Regra</button>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-md">
                  <h3 className="font-bold text-xl mb-4 text-gray-700 flex items-center gap-2"><Scale size={20} /> Critérios de Avaliação</h3>
                  <div className="space-y-6">
                    {evaluationCriteria.map((crit) => (
                      <div key={crit.id} className="p-4 border rounded-lg bg-gray-50 relative">
                        <button onClick={() => handleRemoveCriterion(crit.id)} className="absolute top-2 right-2 p-1 text-red-500 hover:bg-red-100 rounded-full"><Trash2 size={16} /></button>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                          <div className="md:col-span-5">
                            <label className="block font-semibold text-gray-600 mb-1 text-sm">Título</label>
                            <input type="text" value={crit.title} onChange={(e) => handleCriterionChange(crit.id, 'title', e.target.value)} className="p-2 border rounded-md w-full" />
                          </div>
                          <div className="md:col-span-5">
                            <label className="block font-semibold text-gray-600 mb-1 text-sm">Descrição</label>
                            <textarea value={crit.description} onChange={(e) => handleCriterionChange(crit.id, 'description', e.target.value)} className="p-2 border rounded-md w-full text-sm" rows="2"></textarea>
                          </div>
                          <div className="md:col-span-2">
                            <label className="block font-semibold text-gray-600 mb-1 text-sm">Peso</label>
                            <input type="number" value={crit.weight} onChange={(e) => handleCriterionChange(crit.id, 'weight', parseFloat(e.target.value) || 0)} className="p-2 border rounded-md w-full" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 flex gap-4">
                    <button onClick={handleAddCriterion} className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-800 font-bold rounded-lg hover:bg-gray-300"><PlusCircle size={18} /> Adicionar</button>
                    <button onClick={handleSaveCriteria} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700"><Save size={18} /> Salvar Critérios</button>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-md">
                  <h3 className="font-bold text-xl mb-4 text-gray-700 flex items-center gap-2"><UserCheck size={20} /> Gerenciar Avaliadores</h3>
                  <div className="flex gap-2 mb-4">
                    <input type="email" placeholder="E-mail do avaliador" className="p-2 border rounded-md w-full" onKeyDown={(e) => { if (e.key === 'Enter') { handleAddEvaluator(e.target.value); e.target.value = ''; } }} />
                    <button onClick={(e) => { const input = e.currentTarget.parentElement.querySelector('input[type="email"]'); if (input) { handleAddEvaluator(input.value); input.value = ''; } }} className="px-4 py-2 bg-gray-200 text-gray-800 font-bold rounded-lg hover:bg-gray-300">Adicionar</button>
                  </div>
                  <div className="space-y-2">
                    {evaluators.map((evaluator) => (
                      <div key={evaluator.id || evaluator.email} className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                        <span className="text-gray-700">{evaluator.email}</span>
                        <button onClick={() => handleRemoveEvaluator(evaluator.id)} className="p-1 text-red-500 hover:bg-red-100 rounded-full"><X size={16} /></button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 border-t pt-6">
                    <button onClick={handleSaveEvaluators} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"><Save size={16} /> Salvar Avaliadores</button>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-gray-200 flex justify-end">
                  <button onClick={handleConsolidateAgenda} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-lg transition-colors">
                    <FileText size={20} /> <span>Consolidar Agenda Final</span>
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showModal && <Modal user={selectedUser} onClose={() => setShowModal(false)} />}
        {showFormDataModal && selectedFormData && <FormDataModal inscricao={selectedFormData} onClose={() => setShowFormDataModal(false)} />}
        {showConsolidacaoModal && consolidacaoData && <ConsolidacaoModal data={consolidacaoData} onClose={() => setShowConsolidacaoModal(false)} />}
        {showSlidesViewer && slidesData && <SlidesViewer analysisData={slidesData} onClose={() => setShowSlidesViewer(false)} />}
      </AnimatePresence>
    </div>
  );
};

export default Admin;
