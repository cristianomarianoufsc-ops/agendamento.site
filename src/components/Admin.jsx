import React, { useState, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Settings, Save, Download, Trash2, Contact, Loader, X, FileText, Archive, AlertTriangle, CheckCircle, Search, Theater, Church, Eye, EyeOff, // ✅ Adicionado EyeOff
  SlidersHorizontal, Scale, ChevronsUpDown, Edit, Type, FileClock, 
  PlusCircle, UserCheck, Presentation // ✅ Adicionado Presentation
} from "lucide-react";
import EvaluationDrawer from './EvaluationDrawer';
import FormDataModal from './FormDataModal'; // ✅ Importação adicionada
import SlidesViewer from './SlidesViewer';
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
  // Expressão regular para extrair o ID de forms/d/e/.../viewform ou spreadsheets/d/.../edit
  const match = url.match(/(?:forms\/d\/e\/|spreadsheets\/d\/)([a-zA-Z0-9_-]+)/);
  return match ? match[1] : url; // Retorna o ID ou a URL original se não encontrar
};

// --- COMPONENTE PRINCIPAL ---
const Admin = ({ viewOnly = false }) => {
  // --- ESTADOS ---
  const [unificados, setUnificados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isGeneratingSlides, setIsGeneratingSlides] = useState(false); // NOVO ESTADO
  const [showSlidesViewer, setShowSlidesViewer] = useState(false); // NOVO ESTADO
  const [showFormDataModal, setShowFormDataModal] = useState(false); // ✅ NOVO ESTADO
  const [selectedFormData, setSelectedFormData] = useState(null); // ✅ NOVO ESTADO
  const [slidesData, setSlidesData] = useState(null); // NOVO ESTADO
  const [openAccordionId, setOpenAccordionId] = useState(null);
  
  // Estados de Configuração
  
  // ✅ NOVA FUNÇÃO: Remove a data da lista e salva a configuração
  const handleToggleDateFromList = (date) => {
    const newBlockedDates = blockedDates.filter(d => d !== date);
    setBlockedDates(newBlockedDates);
    handleSaveConfig({ blockedDates: newBlockedDates });
  };
  const [formsId, setFormsId] = useState("");
  const [sheetId, setSheetId] = useState("");
  const [pageTitle, setPageTitle] = useState("Sistema de Agendamento de Espaços");
  const [evaluationCriteria, setEvaluationCriteria] = useState([]);
  const [evaluators, setEvaluators] = useState([]);
  const [allowBookingOverlap, setAllowBookingOverlap] = useState(false);
  // ✅ NOVOS ESTADOS PARA CONTROLE DE CALENDÁRIO
  const [blockedDates, setBlockedDates] = useState([]); // Datas bloqueadas (YYYY-MM-DD)
  const [dateToToggle, setDateToToggle] = useState(''); // Data temporária para bloqueio/desbloqueio
  const [stageTimes, setStageTimes] = useState({
    ensaio: { start: "08:00", end: "21:00" },
    montagem: { start: "08:00", end: "21:00" },
    evento: { start: "08:00", end: "21:00" },
    desmontagem: { start: "08:00", end: "21:00" },
  });

  // Estados dos botões da página inicial
  const [enableInternalEdital, setEnableInternalEdital] = useState(false);
  const [enableExternalEdital, setEnableExternalEdital] = useState(true);
  const [enableRehearsal, setEnableRehearsal] = useState(true);
  const [buttonExternalEditalText, setButtonExternalEditalText] = useState("Edital Externo"); // NOVO ESTADO

  // ✅ NOVO ESTADO PARA O NÚMERO DE AVALIAÇÕES
  const [requiredAssessments, setRequiredAssessments] = useState(3);

  // Estados de Navegação e Filtro
  const [mainTab, setMainTab] = useState('inscricoes'); // 'inscricoes', 'configuracoes_gerais', 'configuracoes_avaliacao'
  const [inscricoesTab, setInscricoesTab] = useState(viewOnly ? 'eventos' : 'eventos');
  const [localFilters, setLocalFilters] = useState({ teatro: true, igrejinha: true });
  const [sortOrder, setSortOrder] = useState('id_asc');
  const [assessmentFilter, setAssessmentFilter] = useState('todos');
  const [evaluatorEmail, setEvaluatorEmail] = useState(localStorage.getItem('evaluatorEmail') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('evaluatorEmail')); // NOVO ESTADO
  const [evaluatorPassword, setEvaluatorPassword] = useState('');
  const [conflictFilter, setConflictFilter] = useState(false);
   // ✅ NOVO: Senha única para todos os avaliadores
  
  // ✅ NOVOS ESTADOS PARA AUTENTICAÇÃO ADMIN
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(!!sessionStorage.getItem('adminAuth'));
  const [showAdminPassword, setShowAdminPassword] = useState(false); // NOVO ESTADO: Visibilidade da senha
  const [showEvaluatorPassword, setShowEvaluatorPassword] = useState(false); // NOVO ESTADO: Visibilidade da senha do avaliador

  // --- LÓGICA DE DADOS E FILTRAGEM ---

  // ✅ NOVA FUNÇÃO: Processa a data temporária e salva no estado blockedDates
  const handleToggleDate = () => {
    if (!dateToToggle) return;

    const isBlocked = blockedDates.includes(dateToToggle);
    const newBlockedDates = isBlocked
      ? blockedDates.filter(d => d !== dateToToggle)
      : [...blockedDates, dateToToggle].sort();
    
    // 1. Atualiza o estado local
    setBlockedDates(newBlockedDates);
    // 2. Salva a configuração no backend
    handleSaveConfig({ blockedDates: newBlockedDates });
    // 3. Limpa o campo de seleção
    setDateToToggle('');
  };
  const handleToggleAccordion = (id) => {
    if (openAccordionId === id) {
      setOpenAccordionId(null);
    } else {
      fetchData().then(() => {
        setOpenAccordionId(id);
      });
    }
  };

 const dadosProcessados = useMemo(() => {
    let dadosParaProcessar = [...unificados];

    // --- LÓGICA DE AGRUPAMENTO E COLORAÇÃO DE CONFLITOS ---
    // NOVO: Mapa para armazenar o índice de cor por data de conflito
    const corPorSlot = new Map(); // Key: slotKey (data-hora-local), Value: ColorIndex
    let corIndex = 0;
    const conflitosPorSlot = new Map();
    const coresConflito = [
      'bg-red-100 text-red-800', 'bg-blue-100 text-blue-800', 'bg-green-100 text-green-800', 
      'bg-yellow-100 text-yellow-800', 'bg-purple-100 text-purple-800', 'bg-pink-100 text-pink-800',
      'bg-indigo-100 text-indigo-800', 'bg-teal-100 text-teal-800', 'bg-orange-100 text-orange-800',
      'bg-cyan-100 text-cyan-800', 'bg-lime-100 text-lime-800', 'bg-fuchsia-100 text-fuchsia-800'
    ];

    const getSlots = (item) => {
      const slots = [];
      const addSlot = (inicio, fim) => {
        if (inicio && fim) {
          // Normaliza o slot para a chave de conflito (data + hora de início/fim + local)
          // ✅ NOVO: Inclui o local na chave para que o conflito seja detectado entre locais diferentes
          // ✅ NOVO: Inclui o local na chave para que o conflito seja detectado entre locais diferentes
          const dateStrForConflict = new Date(inicio).toDateString(); // Ex: "Mon Jan 03 2022"
          const dateStrForColor = new Date(inicio).toISOString().substring(0, 10); // Ex: "2022-01-03"
          const timeStart = new Date(inicio).toTimeString().substring(0, 5);
          const timeEnd = new Date(fim).toTimeString().substring(0, 5);
          const key = `${dateStrForConflict}-${timeStart}-${timeEnd}-${item.local}`;
          // Usamos dateStrForColor (YYYY-MM-DD) para o agrupamento de cores
          slots.push({ key, dateStr: dateStrForColor });
        }
      };

      addSlot(item.ensaio_inicio, item.ensaio_fim);
      addSlot(item.montagem_inicio, item.montagem_fim);
      addSlot(item.desmontagem_inicio, item.desmontagem_fim);
      
      if (item.eventos_json) {
        try {
          JSON.parse(item.eventos_json).forEach(ev => addSlot(ev.inicio, ev.fim));
        } catch (e) { /* ignore */ }
      }
      return slots;
    };

    // 1. Mapeia todos os slots e identifica os conflitos
    dadosParaProcessar.forEach(item => {
      item.conflictGroup = null; // Inicializa o campo de grupo
      item.conflictColor = null; // Inicializa o campo de cor
      
      // ✅ NOVO: A lógica de conflito deve ser aplicada a TODOS os itens, não apenas aos que já têm hasConflict
      const slots = getSlots(item);
      slots.forEach(slot => {
        if (!conflitosPorSlot.has(slot.key)) {
          conflitosPorSlot.set(slot.key, { ids: new Set(), dateStr: slot.dateStr });
        }
        conflitosPorSlot.get(slot.key).ids.add(item.id);
      });
    });

    // 2. Atribui um ID de grupo e cor para cada inscrição em conflito, agrupando por SLOT de conflito (data, hora, local)
    const gruposConflito = new Map(); // Map<id_inscricao, id_grupo>
    const slotsConflitantes = Array.from(conflitosPorSlot.entries()).filter(([, data]) => data.ids.size > 1);

    slotsConflitantes.forEach(([slotKey, data]) => {
      const idsConflito = Array.from(data.ids);
      // A chave do slot já está disponível no escopo do forEach

      // 1. Garante que o slot de conflito tenha um índice de cor
      if (!corPorSlot.has(slotKey)) {
        corPorSlot.set(slotKey, corIndex++);
      }
      const grupoPorSlot = corPorSlot.get(slotKey);

      // 2. Para cada inscrição em conflito, armazena o grupo (índice de cor)
      idsConflito.forEach(id => {
        // Se a inscrição já tiver um grupo, mantém o grupo existente (para evitar sobrescrever se houver conflitos em datas diferentes)
        // O primeiro conflito encontrado define a cor.
        if (!gruposConflito.has(id)) {
          gruposConflito.set(id, grupoPorSlot);
        }
      });
    });

    // 3. Aplica o grupo e a cor aos dados
    dadosParaProcessar = dadosParaProcessar.map(item => {
      if (gruposConflito.has(item.id)) {
        const grupo = gruposConflito.get(item.id);
        item.conflictGroup = grupo;
        // A cor é determinada pelo índice do grupo (que agora representa o slot de conflito)
        item.conflictColor = coresConflito[grupo % coresConflito.length];
        item.hasConflict = true; // ✅ Adicionado para o filtro 'Apenas Conflitos' funcionar
      }
      return item;
    });
    // --- FIM DA LÓGICA DE AGRUPAMENTO E COLORAÇÃO DE CONFLITOS ---


    // Lógica de filtro
    dadosParaProcessar = dadosParaProcessar.filter(item => {
      const localCorreto = (localFilters.teatro && item.local === 'teatro') || (localFilters.igrejinha && item.local === 'igrejinha');
      if (!localCorreto) return false;

      // Filtro de conflito
      if (conflictFilter && !item.hasConflict) {
        return false;
      }

      // Lógica de filtro de avaliação (aplica-se a ambos os modos, mas com lógica diferente)
      if (inscricoesTab === 'eventos') {
        const isEvento = item.eventos_json !== '[]' || item.montagem_inicio || item.desmontagem_inicio;
        if (!isEvento) return false; // Garante que só eventos sejam filtrados

        if (assessmentFilter !== 'todos') {
          const isFullyAssessed = item.assessmentsCount >= item.requiredAssessments;
          
          if (viewOnly) {
            const currentUserHasAssessed = item.evaluatorsWhoAssessed?.includes(evaluatorEmail);
            if (assessmentFilter === 'avaliados') return currentUserHasAssessed;
            if (assessmentFilter === 'nao_avaliados') return !currentUserHasAssessed;
          } else { // Modo Admin (viewOnly = false)
            if (assessmentFilter === 'avaliados') return isFullyAssessed;
            if (assessmentFilter === 'nao_avaliados') return !isFullyAssessed;
          }
        }
      }

      // Lógica de filtro de avaliação para o modo viewOnly (mantida para a ordenação)
      if (viewOnly) {
        const isEvento = item.eventos_json !== '[]' || item.montagem_inicio || item.desmontagem_inicio;
        if (!isEvento) return false;

        const currentUserHasAssessed = item.evaluatorsWhoAssessed?.includes(evaluatorEmail);
        if (assessmentFilter === 'avaliados') return currentUserHasAssessed;
        if (assessmentFilter === 'nao_avaliados') return !currentUserHasAssessed;
        return true;
      }

      const tipoCorreto = inscricoesTab === 'eventos'
        ? item.eventos_json !== '[]' || item.montagem_inicio || item.desmontagem_inicio
        : item.ensaio_inicio && item.eventos_json === '[]' && !item.montagem_inicio && !item.desmontagem_inicio;
      
      return tipoCorreto;
    });

    // Lógica de ordenação
    return dadosParaProcessar.sort((a, b) => {
      // ✅ ORDENAÇÃO POR GRUPO DE CONFLITO
      if (conflictFilter) {
        const aGroup = a.conflictGroup ?? Infinity;
        const bGroup = b.conflictGroup ?? Infinity;
        if (aGroup !== bGroup) {
          return aGroup - bGroup;
        }
      }

      if (viewOnly) {
        const aHasBeenAssessedByMe = a.evaluatorsWhoAssessed?.includes(evaluatorEmail);
        const bHasBeenAssessedByMe = b.evaluatorsWhoAssessed?.includes(evaluatorEmail);

        if (aHasBeenAssessedByMe && !bHasBeenAssessedByMe) return 1;
        if (!aHasBeenAssessedByMe && bHasBeenAssessedByMe) return -1;
      }
     
      switch (sortOrder) {
        case 'nota_desc': return (b.finalScore ?? -1) - (a.finalScore ?? -1);
        case 'nota_asc': return (a.finalScore ?? Infinity) - (b.finalScore ?? Infinity);
        case 'id_asc': default: return a.id - b.id;
      }
    });
  }, [unificados, inscricoesTab, localFilters, sortOrder, viewOnly, assessmentFilter, evaluatorEmail, conflictFilter]);


  const handleLocalFilterChange = (local) => { setLocalFilters(prev => ({ ...prev, [local]: !prev[local] })); };
  // --- FUNÇÕES DE API ---
  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/inscricoes"   );
      const data = await response.json();
      setUnificados(data.inscricoes || []);
      setEvaluationCriteria(data.criteria || []);
    } catch (err) { 
      console.error("Erro ao carregar dados:", err);
      setUnificados([]);
      setEvaluationCriteria([]);
    } finally { 
      setLoading(false); 
    }
  };

  const fetchEvaluators = async () => {
    if (viewOnly) return;
    try {
        const response = await fetch("/api/evaluators"   );
        const data = await response.json();
        setEvaluators(data || []);
    } catch (error) {
        console.error("Erro ao buscar avaliadores:", error);
    }
  };

  useEffect(() => {
    fetchData();
    if (!viewOnly) {
      fetchEvaluators();
      fetch("/api/config"   ).then(res => res.json()).then(data => {
        if (data.formsId) setFormsId(data.formsId);
        if (data.sheetId) setSheetId(data.sheetId);
        if (data.pageTitle) setPageTitle(data.pageTitle);
        if (data.allowBookingOverlap) setAllowBookingOverlap(data.allowBookingOverlap);
        // ✅ CARREGA NOVAS CONFIGURAÇÕES DE CALENDÁRIO
        if (data.blockedDates) setBlockedDates(data.blockedDates);
        if (data.stageTimes) setStageTimes(data.stageTimes);
        
        // Atualiza os estados dos botões
        setEnableInternalEdital(data.enableInternalEdital);
        setEnableExternalEdital(data.enableExternalEdital);
        setEnableRehearsal(data.enableRehearsal);
        if (data.buttonExternalEditalText) setButtonExternalEditalText(data.buttonExternalEditalText); // NOVO: Carrega o texto do botão

        // ✅ ATUALIZA O NOVO ESTADO
        if (data.requiredAssessments) {
          setRequiredAssessments(data.requiredAssessments);
        }

      }).catch(err => console.error("Erro ao carregar config:", err));
    }
  }, [viewOnly]);

  // --- FUNÇÕES DE MANIPULAÇÃO (HANDLERS) ---
  const handleSaveConfig = async (configData) => {
    try {
      const response = await fetch("/api/config", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configData   ),
      });
      if (response.ok) alert("✅ Configurações salvas com sucesso!");
      else throw new Error("Erro no servidor.");
    } catch (error) {
      alert("❌ Erro ao salvar configurações.");
    }
  };

  // ✅ NOVA FUNÇÃO PARA ABRIR O MODAL DE DADOS DO FORMULÁRIO
  const handleShowFormDataModal = (inscricao) => {
    setSelectedFormData(inscricao);
    setShowFormDataModal(true);
  };
// ✅ FUNÇÃO DE LOGIN DO AVALIADOR (handleViewerLogin)
  const handleViewerLogin = async () => {
    if (!evaluatorEmail || !evaluatorPassword) {
      alert("Por favor, insira seu e-mail e senha.");
      return;
    }
    try {
      const response = await fetch("/api/auth/viewer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: evaluatorEmail, password: evaluatorPassword } ), // ENVIANDO SENHA
      });
      const data = await response.json();
      if (data.success) {
        localStorage.setItem('evaluatorEmail', evaluatorEmail);
        setIsAuthenticated(true); // DEFINE COMO AUTENTICADO
        // Não salvamos a senha no localStorage por segurança, apenas o email.
        window.location.reload();
      } else {
        alert(data.message || "Erro de autenticação.");
      }
    } catch (error) {
      alert("Erro ao tentar conectar com o servidor.");
    }
  };
  const handleViewerLogout = () => {
    localStorage.removeItem('evaluatorEmail');
    setIsAuthenticated(false); // DEFINE COMO DESAUTENTICADO
    window.location.reload();
  };
  
  // ✅ FUNÇÃO DE LOGIN DO ADMINISTRADOR
  const handleAdminLogin = async () => {
    if (!adminPassword) {
      alert("Por favor, insira a senha de administrador.");
      return;
    }
    try {
      const response = await fetch("/api/auth/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword }),
      });
      const data = await response.json();
      if (data.success) {
        sessionStorage.setItem('adminAuth', 'true');
        setIsAdminAuthenticated(true);
        setAdminPassword(''); // Limpa o campo de senha
      } else {
        alert(data.message || "❌ Senha incorreta.");
      }
    } catch (error) {
      alert("❌ Erro ao tentar conectar com o servidor.");
      console.error("Erro no login admin:", error);
    }
  };
  
  // ✅ FUNÇÃO DE LOGOUT DO ADMINISTRADOR
  const handleAdminLogout = () => {
    sessionStorage.removeItem('adminAuth');
    setIsAdminAuthenticated(false);
    window.location.reload();
  };

  const handleCriterionChange = (id, field, value) => {
    setEvaluationCriteria(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleAddCriterion = () => {
    const newCriterion = {
      id: uuidv4(), title: 'Novo Critério', description: 'Descrição do novo critério.',
      weight: 1, sort_order: evaluationCriteria.length,
    };
    setEvaluationCriteria(prev => [...prev, newCriterion]);
  };

  const handleRemoveCriterion = (id) => {
    if (window.confirm("Tem certeza que deseja remover este critério?")) {
      setEvaluationCriteria(prev => prev.filter(c => c.id !== id).map((c, index) => ({ ...c, sort_order: index })));
    }
  };

  const handleSaveCriteria = async () => {
    const criteriaToSave = evaluationCriteria.map((c, index) => ({ ...c, sort_order: index }));
    try {
      const response = await fetch("/api/criteria", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(criteriaToSave   ),
      });
      if (response.ok) {
        alert("✅ Critérios de avaliação salvos com sucesso!");
        fetchData();
      } else { throw new Error("Erro no servidor ao salvar critérios."); }
    } catch (error) {
      console.error("Erro ao salvar critérios:", error);
      alert("❌ Erro ao salvar critérios.");
    }
  };
  const handleAddEvaluator = (email) => {
    if (email && email.trim() !== '') {
      const trimmedEmail = email.trim();
      // Verifica se o email já existe na lista
      if (!evaluators.some(e => e.email === trimmedEmail)) {
        const newEvaluator = { id: `new-${Date.now()}`, email: trimmedEmail };
        setEvaluators(prev => [...prev, newEvaluator]);
      }
    }
  };

  const handleRemoveEvaluator = (id) => {
    setEvaluators(prev => prev.filter(e => e.id !== id));
  };

  const handleSaveEvaluators = async () => {
     const evaluatorsToSave = evaluators.map(e => ({ email: e.email }));;
    try {
      const response = await fetch("/api/evaluators", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evaluators: evaluatorsToSave, sharedPassword: "dac.ufsc2026" }),
      });
      const data = await response.json();
      if (response.ok) {
        alert("Avaliadores salvos com sucesso! Nenhum e-mail foi enviado.");
        fetchEvaluators();

      } else { throw new Error(data.error || "Erro no servidor ao salvar a lista."); }
    } catch (error) {
      console.error("Erro ao salvar avaliadores:", error);
      alert("Erro ao salvar a lista de avaliadores: " + error.message);
    }
  };

  const handleOpenModal = (user) => { setSelectedUser(user); setShowModal(true); };
  const handleDelete = async (id) => { if (window.confirm("Deseja realmente excluir esta inscrição?")) { try { const res = await fetch(`/api/inscricao/${id}`, { method: "DELETE" }   ); if (res.ok) { alert("✅ Inscrição excluída."); fetchData(); } else { alert("⚠️ Erro ao excluir."); } } catch (err) { alert("❌ Erro de comunicação."); } } };
  
  // =================================================
  // ✅ FUNÇÃO PARA GERAR SLIDES
  // =================================================
  const handleGenerateSlides = async () => {
    if (isGeneratingSlides) return;
    setIsGeneratingSlides(true);
    try {
      // 1. Chamar o novo endpoint para obter os dados brutos
      const response = await fetch("/api/admin/data-for-analysis");
      if (!response.ok) {
        throw new Error("Falha ao buscar dados para análise.");
      }
      const data = await response.json();
      
      // 2. Armazenar os dados e abrir o visualizador
      setSlidesData(data);
      setShowSlidesViewer(true);

    } catch (error) {
      console.error("Erro ao gerar slides:", error);
      alert(`❌ Erro ao gerar slides: ${error.message}`);
    } finally {
      setIsGeneratingSlides(false);
    }
  };

  const handleGeneratePDF = async (inscricao) => {
    try {
      const response = await fetch(`/api/gerar-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inscricao }),
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inscricao_${inscricao.id}_${inscricao.evento_nome.replace(/\s/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert(`Erro ao gerar PDF: ${error.message}. Verifique o console para mais detalhes.`);
    }
  };

  const handleDownloadAllZip = async () => { if (!window.confirm("Deseja baixar o ZIP de todos os anexos?")) return; setIsDownloading(true); try { const response = await fetch("/api/download-all-zips"   ); if (!response.ok) throw new Error(`Erro: ${response.statusText}`); const blob = await response.blob(); const url = window.URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "inscricoes-completas.zip"; document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url); } catch (err) { alert(`❌ Falha ao baixar: ${err.message}`); } finally { setIsDownloading(false); } };
  const handleConsolidateAgenda = async () => {
    // Plano C: Gerar o relatório em Markdown diretamente no frontend
    const inscricoes = unificados; // Usar a lista de inscrições já carregada

    // 1. Classificar e contar
    let aprovadas = 0;
    let reprovadas = 0;
    let naoAvaliadas = 0;
    const listaAprovadas = [];
    const listaReprovadas = [];
    const listaNaoAvaliadas = [];    inscricoes.forEach(inscricao => {
      // Tratar null/undefined/string vazia como 0 para parseFloat, mas manter a lógica de não avaliado
      const rawScore = inscricao.finalScore;
      const nota = parseFloat(rawScore); // Converter para número para garantir a comparação
      
      if (rawScore === null || rawScore === undefined || rawScore === "" || isNaN(nota)) { // Se for null, undefined, string vazia ou NaN após parseFloat
        naoAvaliadas++;
        listaNaoAvaliadas.push(inscricao);
      } else if (nota >= 2.00) { // Alterado de nota > 0 para nota >= 2.00
        aprovadas++;
        listaAprovadas.push(inscricao);
      } else {
        reprovadas++;
        listaReprovadas.push(inscricao);
      }
    });

    // 2. Gerar o conteúdo em Markdown
    let content = `# Simulação de Consolidação da Agenda Final\n\n`;
    content += `Gerado em: ${new Date().toLocaleString('pt-BR')}\n\n`;

    // Resumo
    content += `## Resumo da Classificação\n\n`;
    content += `| Categoria | Quantidade |\n`;
    content += `| :--- | :--- |\n`;
    content += `| Total de Inscrições | ${inscricoes.length} |\n`;
    content += `| Aprovadas (Nota >= 2.00) | ${aprovadas} |\n`;
    content += `| Reprovadas (Nota < 2.00) | ${reprovadas} |\n`;
    content += `| Não Avaliadas | ${naoAvaliadas} |\n\n`;

    // Lista de Aprovadas
    content += `## Inscrições Aprovadas\n\n`;
    if (listaAprovadas.length === 0) {
      content += `Nenhuma inscrição aprovada nesta simulação.\n\n`;
    } else {
      listaAprovadas.forEach((inscricao, index) => {
        const nota = inscricao.finalScore !== null ? inscricao.finalScore.toFixed(2) : 'N/A';
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
        const nota = inscricao.finalScore !== null ? inscricao.finalScore.toFixed(2) : '0.00';
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

    // 3. Enviar o conteúdo Markdown para o backend para conversão em PDF
    setIsDownloading(true);
    try {
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

      // 4. Receber o PDF e forçar o download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Agenda_Final_Consolidada_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click(); // <-- Ação de clique para iniciar o download
      a.remove();
      window.URL.revokeObjectURL(url);
      
      alert("✅ PDF da Agenda Final Consolidada gerado com sucesso!");

    } catch (err) {
      console.error("Erro no download do PDF:", err);
      alert(`❌ Falha ao gerar PDF: ${err.message}. Verifique o console para detalhes.`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleForceCleanup = async () => { if (window.confirm("⚠️ ATENÇÃO! ⚠️\n\nTem certeza que deseja limpar TODOS os dados?")) { try { await fetch("/api/cleanup/force", { method: "POST" }   ); setUnificados([]); alert(`✅ Limpeza concluída!`); } catch (err) { alert("❌ Erro ao executar a limpeza."); } } };
  // --- RENDERIZAÇÃO ---
  
  // ✅ TELA DE LOGIN PARA ADMINISTRADOR
  if (!viewOnly && !isAdminAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
              <Settings size={32} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Painel Administrativo</h2>
            <p className="text-gray-600">Insira a senha para acessar</p>
          </div>
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
            <button
              type="button"
              onClick={() => setShowAdminPassword(!showAdminPassword)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700 transition-colors"
              aria-label={showAdminPassword ? "Esconder senha" : "Mostrar senha"}
            >
              {showAdminPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <button
            onClick={handleAdminLogin}
            className="w-full bg-blue-600 text-white font-semibold p-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle size={20} />
            Entrar
          </button>
        </div>
      </div>
    );
  }
  
  // ✅ TELA DE LOGIN PARA AVALIADOR
   if (viewOnly && !isAuthenticated) { // AGORA USA isAuthenticated
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md">
          <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">Acesso do Avaliador</h2>
          <p className="text-gray-600 mb-6 text-center">Por favor, insira seu e-mail e senha para continuar.</p>
          <input
            type="email"
            placeholder="seu.email@exemplo.com"
            value={evaluatorEmail}
            onChange={(e) => setEvaluatorEmail(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg mb-4 focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="relative mb-6">
            <input // NOVO CAMPO DE SENHA
              type={showEvaluatorPassword ? "text" : "password"}
              placeholder="Sua Senha"
              value={evaluatorPassword}
              onChange={(e) => setEvaluatorPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg pr-10 focus:ring-blue-500 focus:border-blue-500"
              onKeyDown={(e) => { if (e.key === 'Enter') handleViewerLogin(); }}
            />
            <button
              type="button"
              onClick={() => setShowEvaluatorPassword(!showEvaluatorPassword)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700 transition-colors"
              aria-label={showEvaluatorPassword ? "Esconder senha" : "Mostrar senha"}
            >
              {showEvaluatorPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <button
            onClick={handleViewerLogin}
            className="w-full bg-blue-600 text-white font-semibold p-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Entrar
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
              <button 
                onClick={handleViewerLogout} 
                className="text-sm text-red-600 hover:text-red-800 font-medium transition-colors"
              >
                Sair
              </button>
            </div>
          )}
          {!viewOnly && isAdminAuthenticated && (
            <div className="flex items-center justify-between mt-2 p-2 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm font-semibold text-green-800">✅ Sessão Administrativa Ativa</p>
              <button 
                onClick={handleAdminLogout} 
                className="text-sm text-red-600 hover:text-red-800 font-medium transition-colors flex items-center gap-1"
              >
                <X size={16} />
                Sair
              </button>
            </div>
          )}
        </header>

        {!viewOnly && (
          <div className="flex border-b border-gray-200 mb-8">
            <button onClick={() => setMainTab('inscricoes')} className={`flex items-center gap-2 px-4 py-2 text-lg font-semibold transition-colors ${mainTab === 'inscricoes' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
              <Search size={20} /> Inscrições Recebidas
            </button>
            <button onClick={() => setMainTab('configuracoes_gerais')} className={`flex items-center gap-2 px-4 py-2 text-lg font-semibold transition-colors ${mainTab === 'configuracoes_gerais' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
              <SlidersHorizontal size={20} /> Configurações Gerais
            </button>
            <button onClick={() => setMainTab('configuracoes_avaliacao')} className={`flex items-center gap-2 px-4 py-2 text-lg font-semibold transition-colors ${mainTab === 'configuracoes_avaliacao' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
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
                  <div className="flex items-center gap-2 flex-wrap">
                    {!viewOnly && (
                      <>
                        {/* ✅ BOTÃO BAIXAR TUDO */}
                        {isDownloading ? ( <div className="flex items-center gap-2 px-4 py-2 bg-gray-400 text-white font-semibold rounded-lg cursor-not-allowed text-sm"><Loader className="animate-spin" size={16} /><span>Processando...</span></div> ) : ( <button onClick={handleDownloadAllZip} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 text-sm"><Download size={16} /> Baixar Tudo (ZIP)</button> )}
                        
                        {/* ✅ NOVO BOTÃO: GERAR SLIDES */}
                        <button onClick={handleGenerateSlides} disabled={isGeneratingSlides} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 text-sm disabled:bg-purple-400">
                          {isGeneratingSlides ? <Loader className="animate-spin" size={16} /> : <Presentation size={16} />}
                          {isGeneratingSlides ? 'Gerando...' : 'Gerar Slides'}
                        </button>

                        {/* ✅ BOTÃO CONSOLIDAR AGENDA */}
                        <button 
                          onClick={handleConsolidateAgenda} 
                          disabled={isDownloading}
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 text-sm disabled:opacity-50"
                        >
                          {isDownloading ? (
                            <>
                              <Loader className="animate-spin" size={16} />
                              Gerando PDF...
                            </>
                          ) : (
                            <>
                              <FileText size={16} />
                              Consolidar Agenda Final (PDF)
                            </>
                          )}
                        </button>
                        
                        {/* ✅ BOTÃO LIMPEZA GERAL */}
                        <button onClick={handleForceCleanup} className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white font-semibold rounded-lg hover:bg-red-800 text-sm"><AlertTriangle size={16} /> Limpeza Geral</button>
                      </>
                    )}
                    

                  </div>
                </div>
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
                  {!viewOnly ? (
                    <div className="border-b border-gray-200"><nav className="-mb-px flex space-x-6" aria-label="Tabs"><button onClick={() => setInscricoesTab('eventos')} className={`whitespace-nowrap pb-3 px-1 border-b-2 font-medium text-sm ${inscricoesTab === 'eventos' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Eventos</button><button onClick={() => setInscricoesTab('ensaios')} className={`whitespace-nowrap pb-3 px-1 border-b-2 font-medium text-sm ${inscricoesTab === 'ensaios' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Ensaios</button></nav></div>
                  ) : (
                    <div className="w-full border-b border-gray-200"></div>
                  )}
<div className="flex items-center gap-4">
	  {inscricoesTab === 'eventos' && (
	    <div className="relative">
	      <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="pl-8 pr-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500">
	        <option value="id_asc">Ordenar por Inscrição</option>
	        <option value="nota_desc">Maior Nota</option>
	        <option value="nota_asc">Menor Nota</option>
	      </select>
	      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-2 text-gray-500"><ChevronsUpDown size={16} /></div>
	    </div>
	  )}
	  {inscricoesTab === 'eventos' && (
	    <div className="relative">
	      <select value={assessmentFilter} onChange={(e) => setAssessmentFilter(e.target.value)} className="pl-8 pr-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500">
	        <option value="todos">Mostrar Todos</option>
	        <option value="avaliados">{viewOnly ? 'Apenas Avaliados por Mim' : 'Apenas Avaliados (100%)'}</option>
	        <option value="nao_avaliados">{viewOnly ? 'Não Avaliados por Mim' : 'Não Avaliados (Pendente)'}</option>
	      </select>
	      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-2 text-gray-500"><ChevronsUpDown size={16} /></div>
	    </div>
	  )}
  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700"><input type="checkbox" checked={localFilters.teatro} onChange={() => handleLocalFilterChange('teatro')} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" /><Theater size={16} /> Teatro</label>
  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700"><input type="checkbox" checked={localFilters.igrejinha} onChange={() => handleLocalFilterChange('igrejinha')} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" /><Church size={16} /> Igrejinha</label>
  
  {/* ✅ NOVO CHECKBOX DE FILTRO DE CONFLITO */}
  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-red-600">
    <input 
      type="checkbox" 
      checked={conflictFilter} 
      onChange={() => setConflictFilter(!conflictFilter)} 
      className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" 
    />
    <AlertTriangle size={16} /> Apenas Conflitos
  </label>
</div>
                </div>
                {loading ? ( <div className="flex justify-center items-center py-20"><Loader className="animate-spin text-blue-500" size={40} /><p className="ml-4 text-gray-600">Carregando...</p></div> ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-600 table-auto">
                      <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                        <tr>
                          <th scope="col" className="px-4 py-3 w-[5%]">#</th>
                          <th scope="col" className="px-6 py-3 w-[20%]">Evento</th>
                          <th scope="col" className="px-6 py-3 w-[10%]">Local</th>
                          <th scope="col" className="px-6 py-3 w-[25%]">Etapas Agendadas</th>
                          {!viewOnly && inscricoesTab === 'eventos' && <th scope="col" className="px-6 py-3 text-center w-[10%]">Nota Final</th>}
                          {(inscricoesTab === 'eventos' || viewOnly) && <th scope="col" className="px-6 py-3 text-center w-[5%]">Status</th>}
                          {!viewOnly && <th scope="col" className="px-6 py-3 w-[15%]">Arquivos</th>}
                          <th scope="col" className="px-6 py-3 text-center w-[10%]">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dadosProcessados.length > 0 ? (
                          dadosProcessados.map((u) => (
                            <React.Fragment key={u.id}>
                              <tr className={`bg-white border-b hover:bg-gray-50 ${u.conflictColor ? u.conflictColor.split(' ')[0] : ''}`}>
                                <td className="px-4 py-4 font-medium text-gray-900 align-top">{String(u.id).padStart(2, '0')}</td>
                                <td className={`px-6 py-4 font-semibold align-top break-words ${!u.etapa2_ok ? 'text-red-500' : ''} ${u.conflictColor ? u.conflictColor.split(' ')[1] : ''}`}>{u.evento_nome}</td>
                                <td className="px-6 py-4 align-top">
                                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${u.local === 'teatro' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                    {u.local === 'teatro' ? <Theater size={12} /> : <Church size={12} />}
                                    {u.local === 'teatro' ? 'Teatro' : 'Igrejinha'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 align-top">
  {/* ✅ A classe 'text-red-500' é adicionada se 'u.hasConflict' for verdadeiro */}
  <div className={`space-y-1 text-sm ${u.conflictColor ? u.conflictColor.split(' ')[1] : ''}`}>
    {u.ensaio_inicio && <div className="whitespace-nowrap"><strong>Ensaio:</strong>{` ${new Date(u.ensaio_inicio).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' })}, ${new Date(u.ensaio_inicio).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })} - ${new Date(u.ensaio_fim).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}`}</div>}
    {u.montagem_inicio && <div className="whitespace-nowrap"><strong>Montagem:</strong>{` ${new Date(u.montagem_inicio).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' })}, ${new Date(u.montagem_inicio).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })} - ${new Date(u.montagem_fim).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}`}</div>}
    {u.eventos_json && JSON.parse(u.eventos_json).map((ev, i) => ( <div key={`evento-${i}`} className="whitespace-nowrap"><strong>Evento {i + 1}:</strong>{` ${new Date(ev.inicio).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' })}, ${new Date(ev.inicio).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })} - ${new Date(ev.fim).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}`}</div>))}
    {u.desmontagem_inicio && <div className="whitespace-nowrap"><strong>Desmontagem:</strong>{` ${new Date(u.desmontagem_inicio).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' })}, ${new Date(u.desmontagem_inicio).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })} - ${new Date(u.desmontagem_fim).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}`}</div>}
  </div>
</td>
                                {!viewOnly && inscricoesTab === 'eventos' && (
                                  <td className="px-6 py-4 text-center align-top font-bold text-lg">
                                    {u.assessmentsCount >= u.requiredAssessments && u.finalScore !== null ? u.finalScore.toFixed(2) : '-'}
                                  </td>
                                )}
                                
                                <td className="px-6 py-4 text-center align-top">                                  {viewOnly ? (
                                    (() => {
                                      const currentUserHasAssessed = u.evaluatorsWhoAssessed?.includes(evaluatorEmail);                                    if (currentUserHasAssessed) {
                                        return (
                                          <span className="flex items-center justify-center gap-1 text-sm text-green-600 font-semibold">
                                            <CheckCircle size={16} /> Concluído
                                          </span>
                                        );
                                      }
                                      if (u.requiredAssessments > 0) {
                                        return (
                                          <span className="text-red-500 font-semibold text-lg">
                                            {`${u.assessmentsCount || 0}/${u.requiredAssessments}`}
                                          </span>
                                        );
                                      }
                                      return <FileClock className="text-gray-400 inline-block" title="Pendente de Avaliação" />;                                    })()
                                  ) : (                              <>
                                      {u.requiredAssessments > 0 && u.assessmentsCount >= u.requiredAssessments ? (
                                        <CheckCircle className="text-green-500 inline-block" title="Avaliações Concluídas" />
                                      ) : (
                                        <span className="text-red-500 font-semibold text-lg">{`${u.assessmentsCount || 0}/${u.requiredAssessments || '?'}`}</span>
                                      )}
                                    </>
                                  )}
                                </td>              {!viewOnly && <td className="px-6 py-4 space-y-2 align-top">                           {/* <button onClick={() => handleGeneratePDF(u)} className="flex items-center gap-2 text-blue-600 hover:underline font-semibold"><FileText size={16} /> Formulário (PDF)</button> */}
                                  {u.formsData && <button onClick={() => handleShowFormDataModal(u)} className="flex items-center gap-2 text-indigo-600 hover:underline font-semibold whitespace-nowrap"><FileText size={16} /> Ficha Detalhada</button>}
                                  {/* <button onClick={(    ) => window.open(`/api/download-zip/${u.id}`, "_blank"   )} className="flex items-center gap-2 text-green-700 hover:underline font-semibold"><Archive size={16} /> Anexos (ZIP)</button> */}
                                </td>}
                                <td className="px-6 py-4 text-center align-top">
                                  <div className="flex items-center justify-center space-x-2">                  {!viewOnly ? (
                                      <>
                                        <button onClick={() => handleOpenModal(u)} className="p-2 text-gray-500 hover:bg-gray-200 rounded-full" title="Ver Contatos"><Contact size={18} /></button>
                                        <button onClick={() => handleDelete(u.id)} className="p-2 text-red-500 hover:bg-red-100 rounded-full" title="Excluir Inscrição"><Trash2 size={18} /></button>
                                      </>                                 ) : (
                                      <button onClick={() => handleToggleAccordion(u.id)} className={`flex items-center justify-center gap-2 px-3 py-2 font-semibold rounded-lg text-sm w-28 ${openAccordionId === u.id ? 'bg-indigo-700 text-white' : 'bg-indigo-100 text-indigo-800'}`}>
                                        <Eye size={16} />{openAccordionId === u.id ? 'Fechar' : 'Avaliar'}
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>

                              {openAccordionId === u.id && viewOnly && (
                                <tr>
                                  <td colSpan={10}>
                                    <AnimatePresence>
                                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                                        <EvaluationDrawer 
                                          user={u} 
                                          criteria={evaluationCriteria} 
                                          evaluatorEmail={evaluatorEmail} 
                                          onSaveSuccess={fetchData}
                                        />
                                      </motion.div>
                                    </AnimatePresence>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={8} className="text-center py-10 text-gray-500">{`Nenhuma inscrição de '${inscricoesTab}' encontrada.`}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            {mainTab === 'configuracoes_gerais' && !viewOnly && (
              <div className="space-y-8">
                
                <div className="bg-white p-6 rounded-2xl shadow-md">
                  <h3 className="font-bold text-xl mb-4 text-gray-700 flex items-center gap-2"><Type size={20} /> Título da Página de Agendamento</h3>
                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <label className="block font-semibold text-gray-600 mb-2">Título do Edital Atual</label>
                      <input type="text" value={pageTitle} onChange={(e) => setPageTitle(e.target.value)} className="p-3 border rounded-lg w-full" />
                    </div>
                  </div>
                  <div className="mt-6">
                    <button onClick={() => handleSaveConfig({ pageTitle })} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">
                      <Save size={18} /> Salvar Título
                    </button>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-md">
                  <h3 className="font-bold text-xl mb-4 text-gray-700 flex items-center gap-2"><Settings size={20} /> Configurações de Links</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><label className="block font-semibold text-gray-600 mb-2">Link do Google Forms (Etapa 2)</label><input type="text" value={formsId} onChange={(e) => setFormsId(e.target.value)} className="p-3 border rounded-lg w-full" /></div>
                    <div><label className="block font-semibold text-gray-600 mb-2">Link da Planilha de Respostas (CSV)</label><input type="text" value={sheetId} onChange={(e) => setSheetId(e.target.value)} className="p-3 border rounded-lg w-full" /></div>
                  </div>
                  <div className="mt-6"><button onClick={() => handleSaveConfig({ formsId: extractIdFromUrl(formsId), sheetId: extractIdFromUrl(sheetId) })} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700"><Save size={18} /> Salvar IDs</button></div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-md">
                  <h3 className="font-bold text-xl mb-4 text-gray-700 flex items-center gap-2">
                    <Settings size={20} /> Controle da Página Inicial
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div><label htmlFor="enable-internal" className="font-semibold text-gray-700">Ativar "Edital Interno"</label></div>
                      <label htmlFor="enable-internal" className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" id="enable-internal" className="sr-only peer" checked={enableInternalEdital} onChange={() => setEnableInternalEdital(!enableInternalEdital)} />
                        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <label htmlFor="enable-external-edital" className="font-semibold text-gray-700">Ativar "Edital Externo"</label>
                        <label htmlFor="enable-external" className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" id="enable-external" className="sr-only peer" checked={enableExternalEdital} onChange={() => setEnableExternalEdital(!enableExternalEdital)} />
                          <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                      <div className="mt-4">
                        <label htmlFor="external-edital-text" className="block text-sm font-medium text-gray-500">Texto do Botão</label>
                        <input
                          id="external-edital-text"
                          type="text"
                          value={buttonExternalEditalText}
                          onChange={(e) => setButtonExternalEditalText(e.target.value)}
                          className="p-2 border rounded-lg w-full text-sm"
                          maxLength="50"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div><label htmlFor="enable-rehearsal" className="font-semibold text-gray-700">Ativar "Agendar Apenas Ensaio"</label></div>
                      <label htmlFor="enable-rehearsal" className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" id="enable-rehearsal" className="sr-only peer" checked={enableRehearsal} onChange={() => setEnableRehearsal(!enableRehearsal)} />
                        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                  <div className="mt-6">
                    <button onClick={() => handleSaveConfig({ enableInternalEdital, enableExternalEdital, enableRehearsal, buttonExternalEditalText })} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">
                      <Save size={18} /> Salvar Status dos Botões
                    </button>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-md">
                  <h3 className="font-bold text-xl mb-4 text-gray-700 flex items-center gap-2">
                    <Settings size={20} /> Regras do Calendário
                  </h3>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <label htmlFor="allow-overlap" className="font-semibold text-gray-700">Permitir Disputa de Horários</label>
                      <p className="text-sm text-gray-500">
                        Se ativado, permite que múltiplos proponentes solicitem o mesmo horário, gerando uma disputa.
                      </p>
                    </div>
                    <label htmlFor="allow-overlap" className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" id="allow-overlap" className="sr-only peer" checked={allowBookingOverlap} onChange={() => setAllowBookingOverlap(!allowBookingOverlap)} />
                      <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <div className="mt-6">
                    <button onClick={() => handleSaveConfig({ allowBookingOverlap: allowBookingOverlap })} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">
                      <Save size={18} /> Salvar Regra do Calendário
                    </button>
                  </div>
                </div>

                {/* ✅ NOVO PAINEL DE CONTROLE DE CALENDÁRIO */}
                <div className="bg-white p-6 rounded-2xl shadow-md">
                  <h3 className="font-bold text-xl mb-4 text-gray-700 flex items-center gap-2">
                    <FileClock size={20} /> Controle de Horários e Datas
                  </h3>
                  <div className="space-y-6">
                    {/* Configuração de Horários */}
                    <div className="border p-4 rounded-lg">
                      <h4 className="font-semibold text-lg mb-3 text-gray-700">Horários Limite por Etapa</h4>
                      <p className="text-sm text-gray-500 mb-4">Defina o horário de início mais cedo e o horário de fim mais tarde permitidos para cada tipo de agendamento.</p>
                      {Object.keys(stageTimes).map((stage) => (
                        <div key={stage} className="flex items-center gap-4 mb-3">
                          <label className="w-24 capitalize font-medium text-gray-600">{stage}:</label>
                          <input
                            type="time"
                            value={stageTimes[stage].start}
                            onChange={(e) => setStageTimes(prev => ({ ...prev, [stage]: { ...prev[stage], start: e.target.value } }))}
                            className="p-2 border rounded-lg text-sm w-28"
                          />
                          <span className="text-gray-500">-</span>
                          <input
                            type="time"
                            value={stageTimes[stage].end}
                            onChange={(e) => setStageTimes(prev => ({ ...prev, [stage]: { ...prev[stage], end: e.target.value } }))}
                            className="p-2 border rounded-lg text-sm w-28"
                          />
                        </div>
                      ))}
                      <div className="mt-4">
                        <button onClick={() => handleSaveConfig({ stageTimes })} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">
                          <Save size={18} /> Salvar Horários
                        </button>
                      </div>
                    </div>

                    {/* Bloqueio de Datas */}
                    <div className="border p-4 rounded-lg">
                      <h4 className="font-semibold text-lg mb-3 text-gray-700">Bloqueio de Datas Específicas</h4>
                      <p className="text-sm text-gray-500 mb-4">Selecione uma data para bloquear ou desbloquear no calendário de agendamento.</p>
                      <div className="flex gap-4 items-end">
                        <div className="flex-grow">
                          <label htmlFor="block-date" className="block font-medium text-gray-600 mb-2">Data a Bloquear/Desbloquear</label>
                          <input
                            type="date"
                            id="block-date"
                            className="p-2 border rounded-lg w-full"
                            value={dateToToggle}
                            onChange={(e) => setDateToToggle(e.target.value)}
                          />
                        </div>
                        <button onClick={handleToggleDate} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 h-10" disabled={!dateToToggle}>
                          <Save size={18} /> Salvar Datas
                        </button>
                      </div>
                      <div className="mt-4">
                        <h5 className="font-medium text-gray-600 mb-2">Datas Bloqueadas Atualmente:</h5>
                        <div className="flex flex-wrap gap-2">
                          {/* ✅ NOVA DATA TEMPORÁRIA (A SER SALVA) */}
                          {dateToToggle && !blockedDates.includes(dateToToggle) && (
                            <span className="px-3 py-1 bg-gray-200 text-gray-600 rounded-full text-sm flex items-center gap-1 opacity-70">
                              {new Date(dateToToggle + 'T00:00:00').toLocaleDateString('pt-BR')} (Prévia)
                            </span>
                          )}
                          {blockedDates.length > 0 ? (
                            blockedDates.map(date => (
                              <span key={date} className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm flex items-center gap-1">
                                {new Date(date + 'T00:00:00').toLocaleDateString('pt-BR')}
                                <button onClick={() => handleToggleDateFromList(date)} className="text-red-500 hover:text-red-700 ml-1">
                                  <X size={14} />
                                </button>
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-500 text-sm">Nenhuma data bloqueada.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}
            {mainTab === 'configuracoes_avaliacao' && !viewOnly && (
              <div className="space-y-8">
                {/* ✅ NOVO PAINEL DE REGRAS DE AVALIAÇÃO */}
                <div className="bg-white p-6 rounded-2xl shadow-md">
                  <h3 className="font-bold text-xl mb-4 text-gray-700 flex items-center gap-2">
                    <UserCheck size={20} /> Regras de Avaliação
                  </h3>
                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <label htmlFor="required-assessments" className="block font-semibold text-gray-600 mb-2">
                        Avaliações Necessárias por Inscrição
                      </label>
                      <input
                        id="required-assessments"
                        type="number"
                        min="1"
                        value={requiredAssessments}
                        onChange={(e) => setRequiredAssessments(parseInt(e.target.value, 10) || 1)}
                        className="p-3 border rounded-lg w-full max-w-xs"
                      />
                      <p className="text-sm text-gray-500 mt-2">
                        Define o número de avaliações para uma inscrição ser considerada "concluída".
                      </p>
                    </div>
                  </div>
                  <div className="mt-6">
                    <button onClick={() => handleSaveConfig({ requiredAssessments })} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">
                      <Save size={18} /> Salvar Regra de Avaliação
                    </button>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-md">
                  <h3 className="font-bold text-xl mb-4 text-gray-700 flex items-center gap-2"><Scale size={20} /> Critérios de Avaliação</h3>
                  <div className="space-y-6">
                    {evaluationCriteria.map((crit) => (
                      <div key={crit.id} className="p-4 border rounded-lg bg-gray-50 relative transition-all hover:shadow-sm">
                        <button onClick={() => handleRemoveCriterion(crit.id)} className="absolute top-2 right-2 p-1 text-red-500 hover:bg-red-100 rounded-full transition-colors" title="Remover Critério">
                          <Trash2 size={16} />
                        </button>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                          <div className="md:col-span-5">
                            <label className="block font-semibold text-gray-600 mb-1 text-sm">Título do Critério</label>
                            <input type="text" value={crit.title} onChange={(e) => handleCriterionChange(crit.id, 'title', e.target.value)} className="p-2 border rounded-md w-full" />
                          </div>
                          <div className="md:col-span-5">
                            <label className="block font-semibold text-gray-600 mb-1 text-sm">Conceituação (Descrição)</label>
                            <textarea value={crit.description} onChange={(e) => handleCriterionChange(crit.id, 'description', e.target.value)} className="p-2 border rounded-md w-full text-sm" rows="3"></textarea>
                          </div>
                          <div className="md:col-span-2">
                            <label className="block font-semibold text-gray-600 mb-1 text-sm">Peso da Nota</label>
                            <input type="number" min="0" step="1" value={crit.weight} onChange={(e) => handleCriterionChange(crit.id, 'weight', parseFloat(e.target.value) || 0)} className="p-2 border rounded-md w-full" />
                          </div>
                        </div>
                      </div>
                    ))}
                    {evaluationCriteria.length === 0 && (<p className="text-center text-gray-500 py-4">Nenhum critério definido. Adicione o primeiro critério abaixo.</p>)}
                  </div>
                  <div className="mt-6 flex items-center gap-4 border-t pt-6">
                    <button onClick={handleAddCriterion} className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-800 font-bold rounded-lg hover:bg-gray-300">
                      <PlusCircle size={18} /> Adicionar Critério
                    </button>
                    <button onClick={handleSaveCriteria} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">
                      <Save size={18} /> Salvar Todos os Critérios
                    </button>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-md">
                  <h3 className="font-bold text-xl mb-4 text-gray-700 flex items-center gap-2">
                    <UserCheck size={20} /> Gerenciar Avaliadores
                  </h3>
                  <div className="mb-4">
                    <label className="block font-semibold text-gray-600 mb-2 text-sm">E-mail do Avaliador</label>
                    <div className="flex gap-2">
                      <input type="email" placeholder="Ex: joao.silva@exemplo.com" className="p-2 border rounded-md w-full" onKeyDown={(e) => { if (e.key === 'Enter') { handleAddEvaluator(e.target.value); e.target.value = ''; } }} />
                      <button onClick={(e) => { const input = e.currentTarget.previousSibling; handleAddEvaluator(input.value); input.value = ''; }} className="px-4 py-2 bg-gray-200 text-gray-800 font-bold rounded-lg hover:bg-gray-300">Adicionar</button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block font-semibold text-gray-600 mb-2 text-sm">Avaliadores Atuais</label>
                    {evaluators.length > 0 ? (
                      evaluators.map((evaluator) => (
                        <div key={evaluator.id || evaluator.email} className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                          <span className="text-gray-700">{evaluator.email}</span>
                          <button onClick={() => handleRemoveEvaluator(evaluator.id)} className="p-1 text-red-500 hover:bg-red-100 rounded-full" title="Remover Avaliador">
                            <X size={16} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-gray-500 py-2">Nenhum avaliador cadastrado.</p>
                    )}
                  </div>
                  <div className="mt-6 border-t pt-6">
                    <button onClick={handleSaveEvaluators} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">
                      <Save size={18} /> Salvar Lista de Avaliadores
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {showModal && <Modal user={selectedUser} onClose={() => setShowModal(false)} />}
      {/* NOVO MODAL */}
      {showFormDataModal && selectedFormData && <FormDataModal inscricao={selectedFormData} onClose={() => setShowFormDataModal(false)} />}
      </AnimatePresence>
      {showSlidesViewer && slidesData && (
        <SlidesViewer
          analysisData={slidesData}
          onClose={() => setShowSlidesViewer(false)}
        />
      )}
    </div>
  );
};

export default Admin;
