// src/components/Admin.jsx

// Comentário para forçar o reconhecimento da alteração no Render
import React, { useState, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Settings, Save, Download, Trash2, Contact, Loader, X, FileText, Archive, 
  AlertTriangle, CheckCircle, Search, Sheet, Theater, Church, Eye, 
  SlidersHorizontal, Scale, ChevronsUpDown, Edit, Type, FileClock, 
  PlusCircle, UserCheck, Presentation // ✅ Adicionado Presentation
} from "lucide-react";
import EvaluationDrawer from './EvaluationDrawer';
import SlidesViewer from './SlidesViewer';
import { v4 as uuidv4 } from 'uuid';

// Componente Modal (sem alterações)
const Modal = ({ user, onClose }) => {
  const findFormsEmail = (formData) => { if (!formData) return null; const emailKey = Object.keys(formData).find((k) => k.toLowerCase().includes("mail")); return emailKey ? formData[emailKey] : null; };
  const findFormsPhone = (formData) => { if (!formData) return null; const telKey = Object.keys(formData).find((k) => k.toLowerCase().includes("fone")); return telKey ? formData[telKey] : null; };
  return ReactDOM.createPortal( <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}> <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} className="bg-white rounded-2xl shadow-xl p-6 m-4 w-full max-w-md" onClick={(e) => e.stopPropagation()}> <div className="flex justify-between items-center mb-4"> <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"> <Contact size={24} /> Contatos de {user?.nome || "Usuário"} </h3> <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"> <X size={20} /> </button> </div> <div className="space-y-4 text-gray-700"> <p><strong>Nome:</strong> {user?.nome}</p> <div> <p><strong>Telefone(s):</strong></p> <ul className="list-disc list-inside ml-2 text-gray-600"> {findFormsPhone(user?.formsData) ? ( <li>{findFormsPhone(user.formsData)} (Etapa 2)</li> ) : ( <li>{user?.telefone || "N/A"} (Etapa 1)</li> )} </ul> </div> <div> <p><strong>E-mail(s):</strong></p> <ul className="list-disc list-inside ml-2 text-gray-600"> <li>{user?.email || "N/A"} (Etapa 1)</li> {user?.formsData && findFormsEmail(user.formsData) && findFormsEmail(user.formsData).toLowerCase() !== user?.email?.toLowerCase() && ( <li>{findFormsEmail(user.formsData)} (Etapa 2)</li> )} </ul> </div> </div> </motion.div> </motion.div>, document.getElementById("modal-root") );
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
  const [slidesData, setSlidesData] = useState(null); // NOVO ESTADO
  const [openAccordionId, setOpenAccordionId] = useState(null);
  
  // Estados de Configuração
  
  // ✅ NOVA FUNÇÃO: Remove a data da lista e salva a configuração
  const handleToggleDateFromList = (date) => {
    const newBlockedDates = blockedDates.filter(d => d !== date);
    setBlockedDates(newBlockedDates);
    handleSaveConfig({ blockedDates: newBlockedDates });
  };
  const [formLink, setFormLink] = useState("");
  const [sheetLink, setSheetLink] = useState("");
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
  const [isAuthenticated, setIsAuthenticated] = useState(false); // Inicia como não autenticado
  const [passwordInput, setPasswordInput] = useState('');
  const FIXED_PASSWORD = "admin.dac.ufsc";

  // Verifica a autenticação ao carregar
  useEffect(() => {
    const storedAuth = localStorage.getItem('adminAuthenticated');
    if (storedAuth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput === FIXED_PASSWORD) {
      setIsAuthenticated(true);
      localStorage.setItem('adminAuthenticated', 'true');
      setPasswordInput('');
    } else {
      alert("Senha incorreta. Tente novamente.");
      setPasswordInput('');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('adminAuthenticated');
  };
  const [conflictFilter, setConflictFilter] = useState(false);

  // --- LÓGICA DE DADOS E FILTRAGEM ---

  if (!isAuthenticated && !viewOnly) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-2xl">
          <h2 className="text-2xl font-bold text-center text-gray-800">Acesso Restrito - Painel Admin</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Senha de Administrador</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-4 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Digite a senha"
              />
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Entrar
            </button>
          </form>
          <p className="text-xs text-center text-gray-500">A senha é fixa: "admin.dac.ufsc"</p>
        </motion.div>
      </div>
    );
  }

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
    if (!isAuthenticated && !viewOnly) return []; // Adiciona verificação de autenticação
    if (loading) return []; // Adiciona verificação de loading
    let dadosParaProcessar = [...unificados];

    // --- LÓGICA DE AGRUPAMENTO E COLORAÇÃO DE CONFLITOS ---
    const conflitosPorSlot = new Map();
    const coresConflito = [
      'bg-red-100 text-red-800', 'bg-blue-100 text-blue-800', 'bg-green-100 text-green-800', 
      'bg-yellow-100 text-yellow-800', 'bg-purple-100 text-purple-800', 'bg-pink-100 text-pink-800'
    ];
    let corIndex = 0;

    const getSlots = (item) => {
      const slots = [];
      const addSlot = (inicio, fim) => {
        if (inicio && fim) {
          // Normaliza o slot para a chave de conflito (data + hora de início/fim)
          const key = `${new Date(inicio).toDateString()}-${new Date(inicio).toTimeString().substring(0, 5)}-${new Date(fim).toTimeString().substring(0, 5)}`;
          slots.push(key);
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
      if (item.hasConflict) {
        const slots = getSlots(item);
        slots.forEach(slot => {
          if (!conflitosPorSlot.has(slot)) {
            conflitosPorSlot.set(slot, new Set());
          }
          conflitosPorSlot.get(slot).add(item.id);
        });
      }
    });

    // 2. Atribui um ID de grupo e cor para cada inscrição em conflito
    const gruposConflito = new Map(); // Map<id_inscricao, id_grupo>
    const slotsConflitantes = Array.from(conflitosPorSlot.keys()).filter(slot => conflitosPorSlot.get(slot).size > 1);

    slotsConflitantes.forEach(slot => {
      const idsConflito = Array.from(conflitosPorSlot.get(slot));
      let grupoExistente = null;

      // Verifica se algum item do conflito já pertence a um grupo
      for (const id of idsConflito) {
        if (gruposConflito.has(id)) {
          grupoExistente = gruposConflito.get(id);
          break;
        }
      }

      // Se não houver grupo, cria um novo
      if (!grupoExistente) {
        grupoExistente = corIndex++;
      }

      // Adiciona todos os itens do conflito ao grupo
      idsConflito.forEach(id => {
        gruposConflito.set(id, grupoExistente);
      });
    });

    // 3. Aplica o grupo e a cor aos dados
    dadosParaProcessar = dadosParaProcessar.map(item => {
      if (gruposConflito.has(item.id)) {
        const grupo = gruposConflito.get(item.id);
        item.conflictGroup = grupo;
        item.conflictColor = coresConflito[grupo % coresConflito.length];
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
          } else {
            if (assessmentFilter === 'avaliados') return isFullyAssessed;
            if (assessmentFilter === 'nao_avaliados') return !isFullyAssessed;
          }
        }
      } else if (inscricoesTab === 'ensaios') {
        const isEnsaio = item.ensaio_inicio && !item.montagem_inicio && !item.desmontagem_inicio && item.eventos_json === '[]';
        return isEnsaio;
      }

      return true;
    });

    // Lógica de ordenação
    dadosParaProcessar.sort((a, b) => {
      if (sortOrder === 'id_asc') return a.id - b.id;
      if (sortOrder === 'nota_desc') return (b.averageScore || 0) - (a.averageScore || 0);
      if (sortOrder === 'nota_asc') return (a.averageScore || 0) - (b.averageScore || 0);
      return 0;
    });

    return dadosParaProcessar;
  }, [unificados, localFilters, inscricoesTab, sortOrder, assessmentFilter, viewOnly, evaluatorEmail, conflictFilter]);

  // --- FUNÇÕES DE MANIPULAÇÃO (HANDLERS) ---

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/data");
      const data = await response.json();
      
      // Processa os dados para incluir contagem de avaliações e nota média
      const processedData = data.inscriptions.map(item => {
        const assessments = data.assessments.filter(a => a.inscription_id === item.id);
        const assessmentsCount = assessments.length;
        
        // Calcula a nota média
        let totalScore = 0;
        let totalWeight = 0;
        
        assessments.forEach(a => {
          try {
            const scores = JSON.parse(a.scores_json);
            let assessmentScore = 0;
            let assessmentWeight = 0;
            
            Object.keys(scores).forEach(criterionId => {
              const criterion = data.criteria.find(c => c.id === criterionId);
              if (criterion) {
                assessmentScore += scores[criterionId] * criterion.weight;
                assessmentWeight += criterion.weight;
              }
            });
            
            if (assessmentWeight > 0) {
              totalScore += assessmentScore / assessmentWeight;
            }
          } catch (e) {
            console.error("Erro ao parsear scores_json:", e);
          }
        });
        
        const averageScore = assessmentsCount > 0 ? (totalScore / assessmentsCount) : null;
        
        // Lista de avaliadores que já avaliaram
        const evaluatorsWhoAssessed = assessments.map(a => a.evaluator_email);

        return {
          ...item,
          assessmentsCount,
          averageScore: averageScore !== null ? parseFloat(averageScore.toFixed(2)) : null,
          requiredAssessments: data.config.requiredAssessments || 3,
          evaluatorsWhoAssessed,
          hasConflict: item.hasConflict === 1, // Converte o valor do banco de dados
        };
      });

      setUnificados(processedData);
      
      // Carrega as configurações
      setFormLink(data.config.formLink || "");
      setSheetLink(data.config.sheetLink || "");
      setPageTitle(data.config.pageTitle || "Sistema de Agendamento de Espaços");
      setEvaluationCriteria(data.config.evaluationCriteria || []);
      setEvaluators(data.config.evaluators || []);
      setAllowBookingOverlap(data.config.allowBookingOverlap || false);
      setBlockedDates(data.config.blockedDates || []);
      setStageTimes(data.config.stageTimes || {
        ensaio: { start: "08:00", end: "21:00" },
        montagem: { start: "08:00", end: "21:00" },
        evento: { start: "08:00", end: "21:00" },
        desmontagem: { start: "08:00", end: "21:00" },
      });
      setEnableInternalEdital(data.config.enableInternalEdital || false);
      setEnableExternalEdital(data.config.enableExternalEdital || true);
      setEnableRehearsal(data.config.enableRehearsal || true);
      setButtonExternalEditalText(data.config.buttonExternalEditalText || "Edital Externo");
      setRequiredAssessments(data.config.requiredAssessments || 3);

    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      alert("❌ Erro ao carregar dados do servidor.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!viewOnly) {
      fetchData();
    } else if (evaluatorEmail) {
      fetchData();
    }
  }, [viewOnly, evaluatorEmail]);

  // Carrega as configurações iniciais
  useEffect(() => {
    if (!viewOnly) {
      fetch("/api/config")
      .then(res => res.json())
      .then(data => {
        setFormLink(data.formLink || "");
        setSheetLink(data.sheetLink || "");
        setPageTitle(data.pageTitle || "Sistema de Agendamento de Espaços");
        setEvaluationCriteria(data.evaluationCriteria || []);
        setEvaluators(data.evaluators || []);
        setAllowBookingOverlap(data.allowBookingOverlap || false);
        setBlockedDates(data.blockedDates || []);
        setStageTimes(data.stageTimes || {
          ensaio: { start: "08:00", end: "21:00" },
          montagem: { start: "08:00", end: "21:00" },
          evento: { start: "08:00", end: "21:00" },
          desmontagem: { start: "08:00", end: "21:00" },
        });
        setEnableInternalEdital(data.enableInternalEdital || false);
        setEnableExternalEdital(data.enableExternalEdital || true);
        setEnableRehearsal(data.enableRehearsal || true);
        setButtonExternalEditalText(data.buttonExternalEditalText || "Edital Externo");
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
      else throw new Error("Falha ao salvar configurações.");
    } catch (error) {
      console.error("Erro ao salvar config:", error);
      alert(`❌ Erro ao salvar configurações: ${error.message}`);
    }
  };

  const handleLocalFilterChange = (local) => {
    setLocalFilters(prev => ({ ...prev, [local]: !prev[local] }));
  };

  const handleViewerLogin = () => {
    if (!evaluatorEmail || !evaluatorPassword) {
      alert("Por favor, preencha o e-mail e a senha.");
      return;
    }
    // Lógica de autenticação do avaliador (simples, apenas verifica se o email está na lista)
    const isValid = evaluators.some(e => e.email === evaluatorEmail && e.password === evaluatorPassword);
    if (isValid) {
      localStorage.setItem('evaluatorEmail', evaluatorEmail);
      setIsAuthenticated(true);
      fetchData(); // Carrega os dados após o login
    } else {
      alert("E-mail ou senha inválidos.");
    }
  };

  const handleViewerLogout = () => {
    localStorage.removeItem('evaluatorEmail');
    // Não altera o isAuthenticated do Admin, apenas do avaliador
    setEvaluatorEmail('');
  };

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

  const handleDownloadAllZip = async () => { if (!window.confirm("Deseja baixar o ZIP de todos os anexos?")) return; setIsDownloading(true); try { const response = await fetch("/api/download-all-zips"   ); if (!response.ok) throw new Error(`Erro: ${response.statusText}`); const blob = await response.blob(); const url = window.URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "inscricoes-completas.zip"; document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url); } catch (err) { alert(`❌ Falha ao baixar: ${err.message}`); } finally { setIsDownloading(false); } };
  const handleForceCleanup = async () => { if (window.confirm("⚠️ ATENÇÃO! ⚠️\n\nTem certeza que deseja limpar TODOS os dados?")) { try { await fetch("/api/cleanup/force", { method: "POST" }   ); setUnificados([]); alert(`✅ Limpeza concluída!`); } catch (err) { alert("❌ Erro ao executar a limpeza."); } } };
  
  // Funções de Gerenciamento de Critérios
  const handleAddCriterion = () => {
    setEvaluationCriteria(prev => [...prev, { id: uuidv4(), title: '', description: '', weight: 1 }]);
  };
  const handleRemoveCriterion = (id) => {
    setEvaluationCriteria(prev => prev.filter(c => c.id !== id));
  };
  const handleCriterionChange = (id, field, value) => {
    setEvaluationCriteria(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };
  const handleSaveCriteria = () => {
    handleSaveConfig({ evaluationCriteria });
  };

  // Funções de Gerenciamento de Avaliadores
  const handleAddEvaluator = (email) => {
    if (!email || evaluators.some(e => e.email === email)) return;
    setEvaluators(prev => [...prev, { id: uuidv4(), email, password: '' }]); // Senha vazia por enquanto
  };
  const handleRemoveEvaluator = (id) => {
    setEvaluators(prev => prev.filter(e => e.id !== id));
  };
  const handleSaveEvaluators = () => {
    handleSaveConfig({ evaluators });
  };

  // Funções de Gerenciamento de Horários
  const handleStageTimeChange = (stage, field, value) => {
    setStageTimes(prev => ({ ...prev, [stage]: { ...prev[stage], [field]: value } }));
  };
  const handleSaveStageTimes = () => {
    handleSaveConfig({ stageTimes });
  };

  // --- RENDERIZAÇÃO ---
   if (viewOnly && !evaluatorEmail) { // AGORA USA evaluatorEmail
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
          <input // NOVO CAMPO DE SENHA
            type="password"
            placeholder="Sua Senha"
            value={evaluatorPassword}
            onChange={(e) => setEvaluatorPassword(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg mb-6 focus:ring-blue-500 focus:border-blue-500"
            onKeyDown={(e) => { if (e.key === 'Enter') handleViewerLogin(); }}
          />
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
                        <button onClick={() => alert('Funcionalidade em desenvolvimento.')} className="flex items-center gap-2 px-4 py-2 bg-gray-400 text-white font-semibold rounded-lg cursor-not-allowed text-sm" title="Funcionalidade em desenvolvimento">
                          <CheckCircle size={16} /> Consolidar Agenda Final
                        </button>
                        
                        {/* ✅ BOTÃO LIMPEZA GERAL */}
                        <button onClick={handleForceCleanup} className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white font-semibold rounded-lg hover:bg-red-800 text-sm"><AlertTriangle size={16} /> Limpeza Geral</button>
                      </>
                    )}
                    {!viewOnly && <button onClick={() => { const masterLink = 'https://docs.google.com/spreadsheets/d/139ElhiQPcF91DDCjUk74tyRCfH8x2zZKaNESbrnl8tY/edit'; window.open(masterLink, '_blank'    ); }} className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 text-sm"><Sheet size={16} /> Ver na Planilha</button>}
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
                              <tr className="bg-white border-b hover:bg-gray-50" style={{ backgroundColor: u.conflictColor ? u.conflictColor.split(' ')[0].replace('bg-', '#') : undefined }}>
                                <td className="px-4 py-4 font-medium text-gray-900 align-top">{String(u.id).padStart(2, '0')}</td>
                                <td className={`px-6 py-4 font-semibold align-top break-words ${!u.etapa2_ok ? 'text-red-500' : ''}`}>{u.evento_nome}</td>
                                <td className="px-6 py-4 align-top">
                                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${u.local === 'teatro' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                    {u.local === 'teatro' ? <Theater size={12} /> : <Church size={12} />}
                                    {u.local === 'teatro' ? 'Teatro' : 'Igrejinha'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 align-top">
                                  <ul className="list-disc list-inside space-y-1">
                                    {u.ensaio_inicio && <li>Ensaio: {new Date(u.ensaio_inicio).toLocaleDateString('pt-BR')} ({new Date(u.ensaio_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - {new Date(u.ensaio_fim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})</li>}
                                    {u.montagem_inicio && <li>Montagem: {new Date(u.montagem_inicio).toLocaleDateString('pt-BR')} ({new Date(u.montagem_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - {new Date(u.montagem_fim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})</li>}
                                    {u.eventos_json && JSON.parse(u.eventos_json).map((ev, i) => (
                                      <li key={i}>Evento {i + 1}: {new Date(ev.inicio).toLocaleDateString('pt-BR')} ({new Date(ev.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - {new Date(ev.fim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})</li>
                                    ))}
                                    {u.desmontagem_inicio && <li>Desmontagem: {new Date(u.desmontagem_inicio).toLocaleDateString('pt-BR')} ({new Date(u.desmontagem_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - {new Date(u.desmontagem_fim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})</li>}
                                  </ul>
                                </td>
                                {!viewOnly && inscricoesTab === 'eventos' && (
                                  <td className="px-6 py-4 text-center align-top">
                                    {u.averageScore !== null ? (
                                      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold bg-blue-100 text-blue-800">
                                        <Star size={14} className="text-blue-500" /> {u.averageScore}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400 italic">N/A</span>
                                    )}
                                  </td>
                                )}
                                {(inscricoesTab === 'eventos' || viewOnly) && (
                                  <td className="px-6 py-4 text-center align-top">
                                    {u.assessmentsCount >= u.requiredAssessments ? (
                                      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold bg-green-100 text-green-800">
                                        <CheckCircle size={14} /> Completo
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold bg-yellow-100 text-yellow-800">
                                        <Edit size={14} /> {u.assessmentsCount}/{u.requiredAssessments}
                                      </span>
                                    )}
                                  </td>
                                )}
                                {!viewOnly && (
                                  <td className="px-6 py-4 align-top">
                                    <ul className="list-disc list-inside space-y-1">
                                      {u.file_link && <li><a href={u.file_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Anexo</a></li>}
                                      {u.formsData && Object.keys(u.formsData).length > 0 && <li><a href={sheetLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Formulário</a></li>}
                                    </ul>
                                  </td>
                                )}
                                <td className="px-6 py-4 text-center align-top">
                                  <div className="flex flex-col gap-2">
                                    <button onClick={() => { setSelectedUser(u); setShowModal(true); }} className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center justify-center gap-1">
                                      <Contact size={16} /> Contatos
                                    </button>
                                    {inscricoesTab === 'eventos' && (
                                      <button onClick={() => { setSelectedUser(u); setOpenAccordionId(u.id); }} className="text-purple-600 hover:text-purple-800 font-medium text-sm flex items-center justify-center gap-1">
                                        <Scale size={16} /> Avaliar
                                      </button>
                                    )}
                                    <button onClick={() => handleToggleAccordion(u.id)} className="text-gray-600 hover:text-gray-800 font-medium text-sm flex items-center justify-center gap-1">
                                      <Eye size={16} /> Detalhes
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              <AnimatePresence>
                                {openAccordionId === u.id && (
                                  <motion.tr initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }}>
                                    <td colSpan={viewOnly ? 6 : 8} className="p-0">
                                      <div className="bg-gray-50 p-6 border-t border-b border-gray-200">
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                          <div className="lg:col-span-2 space-y-6">
                                            <Section icon={<FileText size={22} className="text-purple-600" />} title="Ficha de Inscrição Detalhada">
                                              {u.formsData && Object.keys(u.formsData).length > 0 ? (
                                                <>
                                                  {Object.keys(u.formsData).map(key => {
                                                    if (key.toLowerCase().includes("carimbo de data/hora") || key.toLowerCase().includes("timestamp") || !u.formsData[key]) return null;
                                                    return <InfoRow key={key} label={key} value={u.formsData[key]} />;
                                                  })}
                                                </>
                                              ) : (
                                                <p className="text-gray-500 italic">Formulário de Etapa 2 não preenchido.</p>
                                              )}
                                            </Section>
                                            <Section icon={<Archive size={22} className="text-orange-600" />} title="Arquivos e Links">
                                              <InfoRow label="Link do Arquivo" value={u.file_link ? <a href={u.file_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{u.file_link}</a> : "N/A"} />
                                              <InfoRow label="Link do Formulário" value={sheetLink ? <a href={sheetLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{sheetLink}</a> : "N/A"} />
                                            </Section>
                                          </div>
                                          <div className="lg:col-span-1 space-y-6">
                                            <Section icon={<FileClock size={22} className="text-teal-600" />} title="Dados de Registro">
                                              <InfoRow label="Data de Inscrição" value={new Date(u.timestamp).toLocaleString('pt-BR')} />
                                              <InfoRow label="ID da Inscrição" value={u.id} />
                                              <InfoRow label="Local" value={u.local === 'teatro' ? 'Teatro' : 'Igrejinha'} />
                                              <InfoRow label="Conflito de Agenda" value={u.hasConflict ? <span className="text-red-600 font-semibold">Sim</span> : <span className="text-green-600 font-semibold">Não</span>} />
                                              {u.conflictGroup !== null && <InfoRow label="Grupo de Conflito" value={u.conflictGroup} />}
                                            </Section>
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </motion.tr>
                                )}
                              </AnimatePresence>
                              {openAccordionId === u.id && inscricoesTab === 'eventos' && (
                                <motion.tr initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }}>
                                  <td colSpan={viewOnly ? 6 : 8} className="p-0">
                                    <div className="bg-white p-6 border-t border-gray-200">
                                      <EvaluationDrawer 
                                        user={u} 
                                        criteria={evaluationCriteria} 
                                        evaluatorEmail={evaluatorEmail}
                                        onSaveSuccess={fetchData}
                                      />
                                    </div>
                                  </td>
                                </motion.tr>
                              )}
                            </React.Fragment>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={viewOnly ? 6 : 8} className="px-6 py-4 text-center text-gray-500">Nenhuma inscrição encontrada com os filtros atuais.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {mainTab === 'configuracoes_gerais' && !viewOnly && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-md space-y-4">
                  <h3 className="font-bold text-xl mb-4 text-gray-700 flex items-center gap-2">
                    <Settings size={20} /> Configurações de Agendamento
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-gray-600 mb-1">Título da Página</label>
                      <input type="text" value={pageTitle} onChange={(e) => setPageTitle(e.target.value)} className="p-2 border rounded-md w-full" />
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-600 mb-1">Link da Planilha (Google Sheets)</label>
                      <input type="text" value={sheetLink} onChange={(e) => setSheetLink(e.target.value)} className="p-2 border rounded-md w-full" />
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-600 mb-1">Link do Formulário (Etapa 2)</label>
                      <input type="text" value={formLink} onChange={(e) => setFormLink(e.target.value)} className="p-2 border rounded-md w-full" />
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer text-gray-700">
                        <input type="checkbox" checked={allowBookingOverlap} onChange={(e) => setAllowBookingOverlap(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        Permitir Agendamentos Sobrepostos
                      </label>
                    </div>
                  </div>
                  <div className="mt-6 border-t pt-6">
                    <button onClick={() => handleSaveConfig({ pageTitle, sheetLink, formLink, allowBookingOverlap })} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">
                      <Save size={18} /> Salvar Configurações Gerais
                    </button>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-md space-y-4">
                  <h3 className="font-bold text-xl mb-4 text-gray-700 flex items-center gap-2">
                    <Type size={20} /> Botões da Página Inicial
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer text-gray-700">
                        <input type="checkbox" checked={enableInternalEdital} onChange={(e) => setEnableInternalEdital(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        Habilitar Botão "Edital Interno"
                      </label>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer text-gray-700">
                        <input type="checkbox" checked={enableExternalEdital} onChange={(e) => setEnableExternalEdital(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        Habilitar Botão "Edital NOVO"
                      </label>
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-600 mb-1">Texto do Botão "Edital NOVO"</label>
                      <input type="text" value={buttonExternalEditalText} onChange={(e) => setButtonExternalEditalText(e.target.value)} className="p-2 border rounded-md w-full" />
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer text-gray-700">
                        <input type="checkbox" checked={enableRehearsal} onChange={(e) => setEnableRehearsal(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        Habilitar Botão "Agendar Apenas Ensaio"
                      </label>
                    </div>
                  </div>
                  <div className="mt-6 border-t pt-6">
                    <button onClick={() => handleSaveConfig({ enableInternalEdital, enableExternalEdital, enableRehearsal, buttonExternalEditalText })} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">
                      <Save size={18} /> Salvar Configurações de Botões
                    </button>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-md space-y-4">
                  <h3 className="font-bold text-xl mb-4 text-gray-700 flex items-center gap-2">
                    <FileClock size={20} /> Bloqueio de Datas
                  </h3>
                  <div className="flex gap-2">
                    <input type="date" value={dateToToggle} onChange={(e) => setDateToToggle(e.target.value)} className="p-2 border rounded-md" />
                    <button onClick={handleToggleDate} className="px-4 py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600">
                      {blockedDates.includes(dateToToggle) ? 'Desbloquear' : 'Bloquear'} Data
                    </button>
                  </div>
                  <div className="mt-4">
                    <p className="font-semibold text-gray-600 mb-2">Datas Bloqueadas Atualmente:</p>
                    <div className="flex flex-wrap gap-2">
                      {blockedDates.map(date => (
                        <span key={date} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold bg-red-100 text-red-800 cursor-pointer hover:bg-red-200" onClick={() => handleToggleDateFromList(date)}>
                          {new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} <X size={12} />
                        </span>
                      ))}
                      {blockedDates.length === 0 && <span className="text-gray-500 italic">Nenhuma data bloqueada.</span>}
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-md space-y-4">
                  <h3 className="font-bold text-xl mb-4 text-gray-700 flex items-center gap-2">
                    <Type size={20} /> Horários Limite por Etapa
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {Object.keys(stageTimes).map(stage => (
                      <div key={stage} className="border p-3 rounded-lg">
                        <p className="font-semibold text-gray-700 capitalize mb-2">{stage}</p>
                        <div className="flex gap-2">
                          <div>
                            <label className="block text-xs text-gray-500">Início</label>
                            <input type="time" value={stageTimes[stage].start} onChange={(e) => handleStageTimeChange(stage, 'start', e.target.value)} className="p-1 border rounded-md w-full text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500">Fim</label>
                            <input type="time" value={stageTimes[stage].end} onChange={(e) => handleStageTimeChange(stage, 'end', e.target.value)} className="p-1 border rounded-md w-full text-sm" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 border-t pt-6">
                    <button onClick={handleSaveStageTimes} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">
                      <Save size={18} /> Salvar Horários Limite
                    </button>
                  </div>
                </div>
              </div>
            )}

            {mainTab === 'configuracoes_avaliacao' && !viewOnly && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-md space-y-4">
                  <h3 className="font-bold text-xl mb-4 text-gray-700 flex items-center gap-2">
                    <Scale size={20} /> Critérios de Avaliação
                  </h3>
                  <div className="mb-4">
                    <label className="block font-semibold text-gray-600 mb-1">Número de Avaliações Requeridas por Proposta</label>
                    <input type="number" min="1" value={requiredAssessments} onChange={(e) => setRequiredAssessments(parseInt(e.target.value) || 1)} className="p-2 border rounded-md w-full max-w-xs" />
                    <div className="mt-2">
                      <button onClick={() => handleSaveConfig({ requiredAssessments })} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">
                        <Save size={18} /> Salvar Número Requerido
                      </button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {evaluationCriteria.map((crit) => (
                      <div key={crit.id} className="relative border p-4 rounded-lg bg-gray-50">
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

                <div className="bg-white p-6 rounded-2xl shadow-md space-y-4">
                  <h3 className="font-bold text-xl mb-4 text-gray-700 flex items-center gap-2">
                    <UserCheck size={20} /> Gerenciar Avaliadores
                  </h3>
                  <div className="mb-4">
                    <label className="block font-semibold text-gray-600 mb-2 text-sm">Email do Avaliador</label>
                    <div className="flex gap-2">
                      <input type="text" placeholder="Ex: joao@exemplo.com" className="p-2 border rounded-md w-full" onKeyDown={(e) => { if (e.key === 'Enter') { handleAddEvaluator(e.target.value); e.target.value = ''; } }} />
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
      </AnimatePresence>
      {showSlidesViewer && slidesData && (
        <SlidesViewer
          analysisData={slidesData}
          onClose={() => setShowSlidesViewer(false)}
        />
      )}
    </div>
  );
}

export default Admin;
