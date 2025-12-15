import React, { useState, useEffect, useMemo } from "react";
import Calendar from "./Calendar";
import TimeBlockSelector from "./TimeBlockSelector";
import { Theater, Church, Calendar as CalendarIcon, Clock, User, Trash2, ArrowRight, CheckCircle, ArrowLeft, PartyPopper, ChevronDown, Download } from "lucide-react";
import { capitalize } from "../utils/stringUtils";


import { motion, AnimatePresence } from "framer-motion";
import Modal from "./Modal";
import jsPDF from "jspdf";
import "jspdf-autotable";


const AppVertical = () => {
  // ESTADOS
  const [localSelecionado, setLocalSelecionado] = useState(null);
  const [selectedStage, setSelectedStage] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [stageTimes, setStageTimes] = useState({ startTime: null, endTime: null });
  const [resumo, setResumo] = useState({ ensaio: [], evento: [] });
  const [backendOcupados, setBackendOcupados] = useState({});
  const [currentStep, setCurrentStep] = useState("select_local");
  const [firstStepDone, setFirstStepDone] = useState(false);
  const [alertMessage, setAlertMessage] = useState(null);
  const [pendingRemovals, setPendingRemovals] = useState([]);
  const [showCompletionMessage, setShowCompletionMessage] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // =================================================
  // NOVOS ESTADOS PARA O MODAL DE CONFIRMAÇÃO
  // =================================================
  const [showConfirmNextEventModal, setShowConfirmNextEventModal] = useState(false);
  const [stageBeingConfirmed, setStageBeingConfirmed] = useState(null);
  const [allowBookingOverlap, setAllowBookingOverlap] = useState(false); // Para guardar a config do admin
  const [configStageTimes, setConfigStageTimes] = useState({ // ✅ NOVO ESTADO: Horários limite do Admin
    ensaio: { start: "08:00", end: "21:00" },
    montagem: { start: "08:00", end: "21:00" },
    evento: { start: "08:00", end: "21:00" },
    desmontagem: { start: "08:00", end: "21:00" },
  });
  const [blockedDates, setBlockedDates] = useState([]); // ✅ NOVO ESTADO: Datas bloqueadas do Admin
const [showConflictModal, setShowConflictModal] = useState(false); // Para controlar o pop-up de disputa
const [conflictDetails, setConflictDetails] = useState(null); // Para guardar os detalhes do conflito
// const [showRevealModal, setShowRevealModal] = useState(false); // Removido: Modal de revelação de disputa
// const [disputeHoursRevealed, setDisputeHoursRevealed] = useState(false); // Removido: Flag de revelação de disputa

  // ✅ NOVO ESTADO ADICIONADO AQUI
  const [pageTitle, setPageTitle] = useState("Sistema de Agendamento de Espaços"); 
  const [buttonExternalEditalText, setButtonExternalEditalText] = useState("Edital Externo"); // ✅ ESTADO FALTANTE CORRIGIDO


  // ✅ Efeito para buscar configurações globais uma vez
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch("/api/config");
        const data = await response.json();
        setAllowBookingOverlap(data.allowBookingOverlap);
        if (data.pageTitle) setPageTitle(data.pageTitle);
        if (data.buttonExternalEditalText) setButtonExternalEditalText(data.buttonExternalEditalText);
          // ✅ CARREGA NOVAS CONFIGURAÇÕES DE CALENDÁRIO
          if (data.stageTimes) setConfigStageTimes(data.stageTimes);
          // ✅ CORREÇÃO: Garante que blockedDates seja um array, mesmo que vazio
          if (data.blockedDates) setBlockedDates(Array.isArray(data.blockedDates) ? data.blockedDates : []);
      } catch (error) {
        console.error("Erro ao buscar configurações:", error);
        // Garante que o frontend não quebre se a configuração falhar
        setPageTitle("Sistema de Agendamento de Espaços (Erro de Configuração)");
      }
    };
    fetchConfig();
  }, []); 

  const locaisNomes = {
    teatro: "Teatro Carmen Fossari",
    igrejinha: "Igrejinha da UFSC",
  };

  const [userData, setUserData] = useState({
    name: "",
    email: "",
    phone: "",
    eventName: "",
  });

  // ... (o restante do seu código AppVertical continua aqui)


    // ✅ GERA OS SLOTS DE 30 EM 30 MINUTOS, EXCLUINDO 00:00-07:30 E 22:30-23:30
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        // Horário atual em minutos
        const totalMinutes = h * 60 + m;
        
        // Limites: 08:00 (480 minutos) e 22:30 (1350 minutos)
        // Queremos slots de 08:00 até 22:00 (o último slot de início)
        // O último slot de início é 22:00 (1320 minutos)
        
        // Se o horário for menor que 08:00 (480) OU maior ou igual a 22:30 (1350), ignora.
        if (totalMinutes < 480 || totalMinutes >= 1350) {
          continue;
        }

        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    return slots;
  }, []);

  const stageOrder = ["ensaio", "montagem", "evento", "desmontagem"];

  // =================================================
  // BLOCO DE FUNÇÕES
  // =================================================

  const fetchOccupiedSlots = async (local) => {
  try {
    const now = new Date();
    const occupiedByDate = {};
    
    // 🔄 Busca eventos dos próximos 12 meses
    for (let i = 0; i < 12; i++) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const year = monthDate.getFullYear();
      const month = (monthDate.getMonth() + 1).toString().padStart(2, '0');
      
      try {
	        const response = await fetch(`/api/occupied-slots/${local}/${year}-${month}`);
	        
	        if (!response.ok) {
	          console.error(`❌ Erro ao buscar eventos de ${year}-${month}: Status ${response.status}`);
	          continue;
	        }
	        
	        let data;
	        try {
	          data = await response.json();
	        } catch (e) {
	          console.error(`❌ Erro ao processar JSON para ${year}-${month}:`, e);
	          console.error("Resposta da API (texto):", await response.text());
	          continue;
	        }
        
        if (data.error) {
          console.error(`❌ Erro retornado pela API para ${year}-${month}:`, data.error);
          continue;
        }
        
        if (!data || !data.eventos) {
          console.warn(`⚠️ Dados de eventos incompletos para ${year}-${month}`);
          continue;
        }
        
        // Processa eventos do mês
        (data.eventos || []).forEach((event) => {
          if (!event || !event.start || !event.end) return;
          const start = new Date(event.start);
          const end = new Date(event.end);
          
          if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            console.warn("⚠️ Evento com data inválida ignorado:", event);
            return;
          }
          
          end.setMinutes(end.getMinutes() + 30);
          const dateString = start.toISOString().split("T")[0];
          const startTime = start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });
          const endTime = end.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });
          
          if (!occupiedByDate[dateString]) occupiedByDate[dateString] = [];
          occupiedByDate[dateString].push({ start: startTime, end: endTime, isContestable: event.isContestable });
        });
        
        console.log(`✅ ${(data.eventos || []).length} eventos carregados para ${year}-${month}`);
      } catch (monthError) {
        console.error(`❌ Erro ao processar mês ${year}-${month}:`, monthError);
        continue;
      }
    }
    
    setBackendOcupados(occupiedByDate);
    console.log(`✅ Total de datas com eventos ocupados: ${Object.keys(occupiedByDate).length}`);
  } catch (error) {
    console.error("❌ Erro ao buscar eventos:", error);
    setBackendOcupados({});
  }
};

  const handleLocalSelect = (local) => { setLocalSelecionado(local); setCurrentStep("calendar"); };

  const handleBackToLocalSelect = () => {
    setLocalSelecionado(null); setCurrentStep("select_local"); setSelectedStage(null); setSelectedDate(null);
    setStageTimes({ startTime: null, endTime: null }); setResumo({ evento: [] });
    setUserData({ name: "", email: "", phone: "", eventName: "" }); setFirstStepDone(false);
    setPendingRemovals([]); setBackendOcupados({}); setShowCompletionMessage(false);
  };

  const handleDateSelect = (date) => { setSelectedDate(date); setStageTimes({ startTime: null, endTime: null }); };

  // ✅ FUNÇÃO MODIFICADA: Agora verifica conflito ao selecionar horário de INÍCIO
  const handleTimeSelection = (time) => {
    const { startTime } = stageTimes;
    const toMinutes = (t) => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; };

    // Quando está selecionando o horário de INÍCIO (ou resetando)
    if (!startTime || toMinutes(time) <= toMinutes(startTime)) {
      
      // ✅ NOVA LÓGICA: Verifica se há conflito ANTES de definir o horário
      const timeInMinutes = toMinutes(time);
    const conflictingSlot = getOccupiedSlots(selectedDate, selectedStage).find(occupied => {
      // ✅ VALIDAÇÃO: Verifica se occupied existe e tem as propriedades necessárias
      if (!occupied || !occupied.start || !occupied.end) return false;
      const occupiedStart = toMinutes(occupied.start);
      const occupiedEnd = toMinutes(occupied.end);
      return timeInMinutes < occupiedEnd && (timeInMinutes + 30) > occupiedStart;
    });

      // Se há conflito e é um horário contestável com a opção ativada
      // Se há conflito e é um horário contestável com a opção ativada
      if (conflictingSlot && conflictingSlot.isContestable && allowBookingOverlap) {
        setConflictDetails({ etapa: selectedStage, pendingStartTime: time });
        setShowConflictModal(true);
        return; // Não define o horário ainda, espera a confirmação do usuário
      }
      
      // Se já revelou, ou se não há conflito, ou se o conflito é fixo, prossegue normalmente
      // (O conflito fixo já é bloqueado visualmente no TimeBlockSelector)

      // Se não há conflito ou é um horário fixo (que já está bloqueado visualmente), prossegue normalmente
      setStageTimes({ startTime: time, endTime: null });
      setIsModalOpen(true);
      return;
    }
    
    // Quando está selecionando o horário de TÉRMINO
    setStageTimes({ ...stageTimes, endTime: time });
  };

  const getOccupiedSlots = (date, etapa) => {
    console.log("🔍 getOccupiedSlots chamado:", { date, etapa });
    if (!date) {
      console.log("⚠️ Sem data, retornando array vazio");
      return [];
    }
    const dateString = date.toISOString().split("T")[0];
    
    // Slots que vêm do backend (outros usuários e eventos fixos)
    const backendSlots = backendOcupados[dateString] || [];
    
    // Slots que o usuário JÁ CONFIRMOU nesta sessão
    const localSlots = [];
  stageOrder.forEach((etapa) => {
    if (etapa === 'evento' || etapa === 'ensaio') {
      // Para eventos e ensaios, processa o array
      const currentStageArray = resumo[etapa];
      if (currentStageArray && Array.isArray(currentStageArray)) {
        currentStageArray.forEach(evt => {
          if (evt && evt.date && evt.start && evt.end) {
            if (evt.date.split("T")[0] === dateString) {
              localSlots.push({ start: evt.start, end: evt.end, isContestable: false });
            }
          }
        });
      }
    } else {
      // Para outras etapas (montagem, desmontagem), processa como objeto único
      if (resumo[etapa] && resumo[etapa].date && resumo[etapa].start && resumo[etapa].end) {
        if (resumo[etapa].date.split("T")[0] === dateString) {
          localSlots.push({ start: resumo[etapa].start, end: resumo[etapa].end, isContestable: true });
        }
      }
    }
  });
  
  const result = [...backendSlots, ...localSlots];
  console.log("✅ getOccupiedSlots retornando:", result);
  return result;
};


  // =================================================
  // FUNÇÃO 'confirmStage' ATUALIZADA
  // =================================================
  // Função `confirmStage` ATUALIZADA
const confirmStage = (etapa, force = false) => {
  if (!selectedDate || !stageTimes.startTime || !stageTimes.endTime) return;

  const newEntry = { date: selectedDate.toISOString(), start: stageTimes.startTime, end: stageTimes.endTime };
  const toMinutes = (time) => { const [h, m] = time.split(":").map(Number); return h * 60 + m; };
  const newStart = toMinutes(newEntry.start);
const newEnd = toMinutes(newEntry.end);

// A verificação de conflito foi movida para handleTimeSelection.
  // Aqui, apenas verificamos se há conflito com um horário FIXO (não contestável)
  // ou se a opção de sobreposição está DESLIGADA.
  const conflictingSlot = getOccupiedSlots(selectedDate, etapa).find((slot) => {
    // ✅ VALIDAÇÃO: Verifica se slot existe e tem as propriedades necessárias
    if (!slot || !slot.start || !slot.end) return false;
    const s = toMinutes(slot.start);
    const e = toMinutes(slot.end);
    return newStart < e && newEnd > s;
  });

  if (conflictingSlot && !force) {
    if (!conflictingSlot.isContestable || !allowBookingOverlap) {
      setAlertMessage({ type: 'error', text: "Conflito de horário! Este intervalo já está ocupado e não pode ser agendado." });
      setTimeout(() => setAlertMessage(null), 4000);
      return;
    }
  }

  // ✅ NOVA LÓGICA: Trata eventos como array
  if (etapa === "evento" || etapa === "ensaio") {
    const stageName = capitalize(etapa);
    const currentStageArray = resumo[etapa] || [];

    // Verifica se já atingiu o limite de 6
    if (currentStageArray.length >= 6) {
      setAlertMessage({ type: 'warning', text: `Você já atingiu o limite de 6 agendamentos de ${stageName}!` });
      setTimeout(() => setAlertMessage(null), 4000);
      return;
    }
    
    // Verifica duplicação
    const isDuplicate = currentStageArray.some(evt => 
      evt.date === newEntry.date && evt.start === newEntry.start && evt.end === newEntry.end
    );
    
    if (isDuplicate) return;
    
    // Adiciona o novo agendamento ao array
    setResumo((prev) => ({
      ...prev,
      [etapa]: [...currentStageArray, newEntry]
    }));
    
    // Abre o modal de confirmação se ainda não atingiu o limite
    if (currentStageArray.length < 5) { // Menos de 6 após adicionar este
      setShowConfirmNextEventModal(true);
    } else {
      // Se atingiu 6, fecha tudo
      setSelectedStage(null);
      setSelectedDate(null);
      setStageTimes({ startTime: null, endTime: null });
      setAlertMessage({ type: 'success', text: `Limite de 6 agendamentos de ${stageName} atingido!` });
      setTimeout(() => setAlertMessage(null), 4000);
    }
  } else {
    // Para outras etapas (ensaio, montagem, desmontagem)
    setResumo((prev) => {
      const novoResumo = { ...prev };
      novoResumo[etapa] = newEntry;
      return novoResumo;
    });
    
    setSelectedStage(null);
    setSelectedDate(null);
    setStageTimes({ startTime: null, endTime: null });
  }
};



  // =================================================
  // NOVAS FUNÇÕES PARA OS BOTÕES DO NOVO MODAL
  // =================================================
  const handleConfirmNextEvent = () => {
    // Usuário clicou "Sim": limpa a seleção para um novo agendamento.
    setSelectedDate(null);
    setStageTimes({ startTime: null, endTime: null });
    setShowConfirmNextEventModal(false);
  };

  const handleDeclineNextEvent = () => {
    // Usuário clicou "Não": fecha a gaveta.
    setSelectedStage(null);
    setSelectedDate(null);
    setStageTimes({ startTime: null, endTime: null });
    setShowConfirmNextEventModal(false);
  };

    // ✅ CORREÇÃO 1: handleConfirmRemovals agora cancela no backend se necessário
  const handleConfirmRemovals = async () => {
    try {
      // Se a primeira etapa já foi concluída, os eventos existem no Google Calendar
      if (firstStepDone) {
        const eventosParaCancelar = pendingRemovals
          .map(r => {
            const item = r.etapa === 'evento' ? resumo.evento[r.idx] : resumo[r.etapa];
            return item ? item.eventId : null;
          })
          .filter(Boolean); // Filtra para garantir que só temos IDs válidos

        if (eventosParaCancelar.length > 0) {
          await fetch(`/api/cancel-events/${localSelecionado}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventIds: eventosParaCancelar } )
          });
          fetchOccupiedSlots(localSelecionado, currentMonth); // Atualiza o calendário visual
        }
      }

      // Esta parte remove os itens da tela (estado local), funcionando para ambos os casos
      const novoResumo = { ...resumo };
      // Processa as remoções
      pendingRemovals.forEach(r => {
        if (r.etapa === 'evento' && r.idx !== undefined) {
          // Remove um evento específico do array
          novoResumo.evento = novoResumo.evento.filter((_, index) => index !== r.idx);
        } else {
          // Remove outras etapas normalmente
          delete novoResumo[r.etapa];
        }
      });
      setResumo(novoResumo);

      setPendingRemovals([]);
      setAlertMessage({ type: 'success', text: "Cancelamento confirmado!" });

      // Verifica se o resumo ficou vazio após a remoção
      const resumoVazio = !novoResumo.ensaio && !novoResumo.montagem && !novoResumo.desmontagem && (!novoResumo.evento || novoResumo.evento.length === 0);
      if (resumoVazio) {
        setFirstStepDone(false); // Reseta o fluxo se tudo foi cancelado
      }

    } catch (e) {
      console.error("Erro ao cancelar:", e);
      setAlertMessage({ type: 'error', text: "Erro ao cancelar. Tente novamente." });
    } finally {
      setTimeout(() => setAlertMessage(null), 3000);
    }
  };
// SUBSTITUA TODA A SUA FUNÇÃO 'handleSendEmail' POR ESTA:
const handleSendEmail = async () => {
  try {
    const etapas = [];
    stageOrder.forEach(etapa => {
      if (etapa === 'evento') {
        // Para eventos, processa o array
        if (resumo.evento && Array.isArray(resumo.evento)) {
          resumo.evento.forEach(evt => {
            if (evt.date && evt.start && evt.end) {
              etapas.push({ nome: etapa, inicio: `${evt.date.split("T")[0]}T${evt.start}:00`, fim: `${evt.date.split("T")[0]}T${evt.end}:00` });
            }
          });
        }
      } else {
        // Para outras etapas, processa normalmente
        if (resumo[etapa] && resumo[etapa].date && resumo[etapa].start && resumo[etapa].end) {
          etapas.push({ nome: etapa, inicio: `${resumo[etapa].date.split("T")[0]}T${resumo[etapa].start}:00`, fim: `${resumo[etapa].date.split("T")[0]}T${resumo[etapa].end}:00` });
        }
      }
    });

    if (etapas.length === 0) {
      setAlertMessage({type: 'warning', text: "Nenhuma etapa selecionada."});
      setTimeout(() => setAlertMessage(null), 4000);
      return;
    }

    const response = await fetch("/api/create-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ local: localSelecionado, resumo: userData.eventName, etapas, userData }   )
    });

    const result = await response.json();

    if (result?.success && result.eventos) {
      setAlertMessage({type: 'success', text: "Agendamento confirmado!"});

      // Lógica corrigida para associar os eventIds
      const novoResumoComIds = { ...resumo };
      
      // Contador para eventos múltiplos
      let eventoIndex = 0;

      result.eventos.forEach(eventoCriado => {
        if (eventoCriado.etapa === 'evento') {
          // Para eventos, adiciona o eventId ao item correspondente no array
          if (novoResumoComIds.evento && novoResumoComIds.evento[eventoIndex]) {
            novoResumoComIds.evento[eventoIndex].eventId = eventoCriado.id;
            eventoIndex++;
          }
        } else {
          // Para outras etapas, funciona como antes
          if (novoResumoComIds[eventoCriado.etapa]) {
            novoResumoComIds[eventoCriado.etapa].eventId = eventoCriado.id;
          }
        }
      });

      setResumo(novoResumoComIds);

      // E-mail de confirmação desabilitado temporariamente

      fetchOccupiedSlots(localSelecionado, currentMonth);
      setFirstStepDone(true);
      setAlertMessage({type: 'success', text: "Primeira etapa concluída com sucesso!"});

    } else {
      setAlertMessage({type: 'error', text: result.error || "Erro ao salvar eventos."});
    }
  } catch (err) {
    console.error("Falha na comunicação:", err);
    setAlertMessage({type: 'error', text: "Falha na comunicação com o servidor."});
  } finally {
    setTimeout(() => setAlertMessage(null), 5000);
  }
};

  const isFormValid = () => userData.name.trim() && userData.email.trim() && userData.phone.trim() && userData.eventName.trim() && resumo.evento && resumo.evento.length > 0;

  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF();
      
      // Título
    
    // Título
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Comprovante de Inscrição - 1ª Etapa", 105, 20, { align: "center" });
    
    // Informações do local
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Local: ${locaisNomes[localSelecionado]}`, 20, 35);
    
    // Dados do responsável
    doc.setFont("helvetica", "bold");
    doc.text("Dados do Responsável:", 20, 45);
    doc.setFont("helvetica", "normal");
    doc.text(`Nome: ${userData.name}`, 20, 52);
    doc.text(`E-mail: ${userData.email}`, 20, 59);
    doc.text(`Telefone: ${userData.phone}`, 20, 66);
    doc.text(`Nome do Evento: ${userData.eventName}`, 20, 73);
    
    // Tabela de agendamentos
    doc.setFont("helvetica", "bold");
    doc.text("Agendamentos Solicitados:", 20, 85);
    
    const tableData = [];
    
// Adicionar ensaio
if (resumo.ensaio && resumo.ensaio.length > 0) {
  resumo.ensaio.forEach((ens, idx) => {
    tableData.push([
      `Ensaio ${idx + 1}`,
      new Date(ens.date).toLocaleDateString("pt-BR"),
      `${ens.start} - ${ens.end}`
    ]);
  });
}
    
    // Adicionar montagem
    if (resumo.montagem) {
      tableData.push([
        "Montagem",
        new Date(resumo.montagem.date).toLocaleDateString("pt-BR"),
        `${resumo.montagem.start} - ${resumo.montagem.end}`
      ]);
    }
    
    // Adicionar eventos
    if (resumo.evento && resumo.evento.length > 0) {
      resumo.evento.forEach((evt, idx) => {
        tableData.push([
          `Evento ${idx + 1}`,
          new Date(evt.date).toLocaleDateString("pt-BR"),
          `${evt.start} - ${evt.end}`
        ]);
      });
    }
    
    // Adicionar desmontagem
    if (resumo.desmontagem) {
      tableData.push([
        "Desmontagem",
        new Date(resumo.desmontagem.date).toLocaleDateString("pt-BR"),
        `${resumo.desmontagem.start} - ${resumo.desmontagem.end}`
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
    
    // Rodapé
    const finalY = doc.lastAutoTable.finalY || 90;
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 20, finalY + 15);
    doc.text("Este é um comprovante de inscrição da 1ª etapa.", 20, finalY + 22);
    doc.text("Prossiga para a 2ª etapa para completar sua solicitação.", 20, finalY + 29);
    
    // Salvar PDF
    doc.save(`Inscricao_1Etapa_${userData.eventName.replace(/\s+/g, '_')}.pdf`);
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    alert("Erro ao gerar PDF. Verifique o console para mais detalhes.");
  }
  };

  const handleGoToSecondStep = async () => {
    try {
      const res = await fetch("/api/config");
      if (!res.ok) {
        alert("Erro ao carregar link.");
        return;
      }
      const data = await res.json();
      if (data?.formsLink) {
        window.open(data.formsLink, "_blank");
        setShowCompletionMessage(true);
        setTimeout(() => handleBackToLocalSelect(), 5000);
      } else {
        alert("Nenhum link de formulário configurado no painel de administração.");
      }
    } catch (err) {
      console.error("Erro em handleGoToSecondStep:", err);
      alert("Erro ao carregar link.");
    }
  };

  // ✅ NOVO USEEFFECT ADICIONADO AQUI
  useEffect(() => {
  fetch("/api/config")
    .then(res => res.json())
    .then(data => {
      if (data.pageTitle) {
        setPageTitle(data.pageTitle);
      }
      // ✅ ADICIONE ESTA CONDIÇÃO
      if (data.allowBookingOverlap) {
        setAllowBookingOverlap(data.allowBookingOverlap);
      }
    })
    .catch(err => console.error("Erro ao buscar configurações:", err));
}, []);

  useEffect(() => {
    if (localSelecionado) fetchOccupiedSlots(localSelecionado, currentMonth);
  }, [localSelecionado, currentMonth]);

  const alertStyles = { success: "bg-green-100 text-green-800", error: "bg-red-100 text-red-800", warning: "bg-yellow-100 text-yellow-800" };

  return (
    <div className="bg-gray-50 min-h-screen font-sans">
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Horário de início confirmado!"
      >
        <p>Agora, clique em 'OK' e escolha o horário de término no seletor.</p>
      </Modal>
{/* ✅ MODAL DE CONFLITO MODIFICADO */}
<Modal
  isOpen={showConflictModal}
  onClose={() => setShowConflictModal(false)}
  title="Atenção: Conflito de Horários"
  showDefaultButton={false}
>
  <p className="text-center text-gray-600 mb-6">
    O horário que você selecionou já foi solicitado por outro proponente.
    Ao clicar em continuar você concorrerá a esta vaga. A alocação final será decidida pela sua pontuação no edital.
  </p>
  <div className="flex gap-4 mt-4">
    <button
      onClick={() => setShowConflictModal(false)}
      className="flex-1 py-2 px-4 bg-gray-200 text-gray-800 font-bold rounded-lg hover:bg-gray-300"
    >
      Cancelar
    </button>
    <button
      onClick={() => {
        setShowConflictModal(false);
        // ✅ LÓGICA MODIFICADA: Se há pendingStartTime, define o horário de início
        if (conflictDetails.pendingStartTime) {
          // Define o horário de início e prossegue
          setStageTimes({ startTime: conflictDetails.pendingStartTime, endTime: null });
          setIsModalOpen(true);
        } else {
          // Caso contrário, confirma a etapa completa (comportamento antigo)
          confirmStage(conflictDetails.etapa, true);
        }
      }}
      className="flex-1 py-2 px-4 bg-yellow-500 text-white font-bold rounded-lg hover:bg-yellow-600"
    >
      Continuar
    </button>
  </div>
</Modal>

{/* NOVO MODAL DE REVELA
</Modal>

      {/* =============================================== */}
      {/* NOVO MODAL DE CONFIRMAÇÃO DE EVENTO             */}
      {/* =============================================== */}
     <Modal
  isOpen={showConfirmNextEventModal}
  onClose={handleDeclineNextEvent}
  title={`${capitalize(selectedStage)} Adicionado!`}
  showDefaultButton={false}
>
  {/* O estilo deste parágrafo foi adicionado para aumentar a fonte */}
  <p style={{ fontSize: '1.125rem', color: '#4b5563', textAlign: 'center' }}>
    Deseja agendar outro ${selectedStage}?
  </p>
  
  <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
    <button
      onClick={handleDeclineNextEvent}
      style={{ flex: 1, padding: '0.75rem', backgroundColor: '#f3f4f6', color: '#1f2937', borderRadius: '0.5rem', fontWeight: 'bold', border: '1px solid #d1d5db' }}
    >
      Não
    </button>
    <button
      onClick={handleConfirmNextEvent}
      style={{ flex: 1, padding: '0.75rem', backgroundColor: '#f3f4f6', color: '#1f2937', borderRadius: '0.5rem', fontWeight: 'bold', border: '1px solid #d1d5db' }}
    >
      Sim
    </button>
  </div>
</Modal>



      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        <AnimatePresence>
          {alertMessage && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className={`fixed top-5 right-5 z-50 mb-4 p-4 rounded-xl shadow-lg text-sm font-semibold ${alertStyles[alertMessage.type] || 'bg-gray-100'}`}>
              {alertMessage.text}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showCompletionMessage && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-gray-50 z-40 flex flex-col items-center justify-center text-center p-4">
              <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1, transition: { delay: 0.2, type: 'spring' } }}>
                <PartyPopper size={80} className="text-green-500 mx-auto" />
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mt-6">Obrigado!</h1>
                <p className="text-lg text-gray-600 mt-2">Sua solicitação de agendamento foi recebida. Continue preenchendo as informações na nova aba que foi aberta.</p>
                <p className="text-sm text-gray-500 mt-8">Você será redirecionado para a página inicial em 5 segundos...</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {currentStep === "select_local" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center min-h-[80vh] text-center">
                        {/* ✅ LINHA ATUALIZADA */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-800 mb-4">{pageTitle}</h1>

            <p className="text-gray-600 mb-10 text-lg">Selecione o local desejado para iniciar</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <motion.button whileHover={{ scale: 1.05, y: -5 }} whileTap={{ scale: 0.95 }} onClick={() => handleLocalSelect("teatro")} className="flex flex-col items-center justify-center gap-3 py-8 px-10 rounded-2xl shadow-lg text-xl font-bold text-white bg-blue-600 transition-shadow duration-300 w-60">
                <Theater size={60} />
                <span>{locaisNomes.teatro}</span>
              </motion.button>
              <motion.button whileHover={{ scale: 1.05, y: -5 }} whileTap={{ scale: 0.95 }} onClick={() => handleLocalSelect("igrejinha")} className="flex flex-col items-center justify-center gap-3 py-8 px-10 rounded-2xl shadow-lg text-xl font-bold text-white bg-blue-600 transition-shadow duration-300 w-60">
                <Church size={60} />
                <span>{locaisNomes.igrejinha}</span>
              </motion.button>
            </div>
          </motion.div>
        )}

        {currentStep === "calendar" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto">
            <div className="mb-8 flex items-center justify-between">
              <div>
                                {/* ✅ LINHA ATUALIZADA */}
                <h1 className="text-3xl font-bold text-gray-800">{pageTitle}</h1>

                <p className="text-md font-semibold mt-1">Local: <span className="text-blue-600">{locaisNomes[localSelecionado]}</span></p>
              </div>
              <button onClick={handleBackToLocalSelect} className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors">
                <ArrowLeft size={18} /> Voltar
              </button>
            </div>

            <div className="flex flex-col space-y-8">
              <div className="bg-white p-6 rounded-2xl shadow-md">
                <h3 className="font-bold text-xl mb-4 text-gray-700 flex items-center gap-2"><User size={20} /> Dados do Responsável</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input type="text" placeholder="Nome completo" value={userData.name} onChange={(e) => setUserData({ ...userData, name: e.target.value })} className="p-3 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <input type="email" placeholder="E-mail de contato" value={userData.email} onChange={(e) => setUserData({ ...userData, email: e.target.value })} className="p-3 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <input type="tel" placeholder="Telefone (com DDD)" value={userData.phone} onChange={(e) => setUserData({ ...userData, phone: e.target.value })} className="p-3 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <input type="text" placeholder="Nome do Evento" value={userData.eventName} onChange={(e) => setUserData({ ...userData, eventName: e.target.value })} className="p-3 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-md">
	                <h3 className="font-bold text-xl mb-2 text-gray-700 flex items-center gap-2"><CalendarIcon size={20} /> 1. Escolha as datas e horários</h3>
	                <p className="text-sm text-gray-600 mb-4 p-2 bg-yellow-50 rounded-lg border border-yellow-200">
	                  <b>**Atenção:** As datas e horários marcados em **amarelo** já foram solicitados por outro proponente. Você pode se inscrever nessas horas e concorrer à vaga mesmo assim. A alocação final será definida para a proposta que obtiver a maior pontuação, conforme os critérios estabelecidos no item 8 do edital.</b>
	                </p>
                <div className="flex flex-col space-y-3">
                  {stageOrder.map((etapa) => {
                    const isDisabled = (etapa === "desmontagem" && (!resumo.evento || resumo.evento.length === 0));
                    const isSelected = selectedStage === etapa;

                    return (
                      <div key={etapa} className="flex flex-col">
                        <button
                          onClick={() => { if (!isDisabled) setSelectedStage(isSelected ? null : etapa); }}
                          disabled={isDisabled}
                          className={`w-full p-3 text-left rounded-lg font-semibold transition-all duration-200 flex items-center justify-between ${isDisabled ? "bg-gray-100 text-gray-400 cursor-not-allowed" : isSelected ? "bg-blue-600 text-white shadow-md" : "border border-gray-300 text-gray-700 hover:bg-blue-50 hover:border-blue-400"}`}
                        >
                          <span>
                            {capitalize(etapa)}
                          </span>
                          <motion.div animate={{ rotate: isSelected ? 180 : 0 }} transition={{ duration: 0.3 }}>
                            <ChevronDown size={20} />
                          </motion.div>
                        </button>

                        <AnimatePresence>
                          {isSelected && (
                            <motion.div
                              initial={{ height: 0, opacity: 0, marginTop: 0 }}
                              animate={{ height: 'auto', opacity: 1, marginTop: '1rem' }}
                              exit={{ height: 0, opacity: 0, marginTop: 0 }}
                              transition={{ duration: 0.3, ease: "easeInOut" }}
                              className="overflow-hidden"
                            >
                              <div className="p-4 border rounded-lg bg-gray-50/50">
                                <h3 className="font-semibold text-md mb-3 text-gray-700">2. Selecione o dia para <span className="text-blue-600">{selectedStage}</span></h3>
            <Calendar
              onDateSelect={handleDateSelect}
              selectedDate={selectedDate}
              currentMonth={currentMonth}
              onMonthChange={setCurrentMonth}
              disabledDates={blockedDates} // Passando as datas bloqueadas
              eventDates={Object.keys(backendOcupados)}
              mainEventDatesSelected={(() => {
                if (!resumo.evento || !Array.isArray(resumo.evento) || resumo.evento.length === 0) return [];
                return resumo.evento.map(evt => new Date(evt.date)).filter(d => !isNaN(d.getTime()));
              })()}
            />
	                                <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-gray-600">
	                                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-white border"></div><span>Livre</span></div>
	                                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-200"></div><span>Parcial</span></div>
	                                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-200"></div><span>Ocupado</span></div>
	                                </div>

                                <AnimatePresence>
                                  {selectedDate && (
                                    <motion.div
                                      initial={{ opacity: 0, marginTop: 0 }}
                                      animate={{ opacity: 1, marginTop: '1.5rem' }}
                                      className="border-t pt-6"
                                    >
                                      <h3 className="font-semibold text-md mb-3 text-gray-700 flex items-center gap-2">
                                        <Clock size={18} /> 
                                        {!stageTimes.startTime ? '3. Defina o horário de início' : '3. Agora, escolha o horário de término'}
                                      </h3>
<TimeBlockSelector
                                      selectedDate={selectedDate}
                                      timeSlots={timeSlots}
                                      selectedTimes={stageTimes || {}}
                                      onSelectTime={handleTimeSelection}
                                      occupiedSlots={selectedDate ? getOccupiedSlots(selectedDate, selectedStage) : []}
                                      stage={selectedStage}
                                      allowOverlap={allowBookingOverlap}
                                      stageTimeLimits={configStageTimes[selectedStage]} // ✅ PASSA OS LIMITES DE HORÁRIO
                                    />
                                      {selectedDate && stageTimes.startTime && stageTimes.endTime && (
                                        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => confirmStage(selectedStage)} className="mt-6 w-full bg-green-600 text-white font-bold rounded-lg py-3 hover:bg-green-700 transition-transform duration-200 hover:scale-[1.02]">
                                          Adicionar {selectedStage} ao Resumo
                                        </motion.button>
                                      )}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-md">
                <h3 className="font-bold text-xl mb-4 text-gray-700">Resumo da Solicitação</h3>
                <ul className="space-y-3 text-sm text-gray-600">
                  {stageOrder.flatMap((etapa) => {
if (etapa === 'evento' || etapa === 'ensaio') {
	                      // Para etapas de agendamento múltiplo (ensaio e evento)
	                      const currentStageArray = resumo[etapa];
	                      if (currentStageArray && Array.isArray(currentStageArray) && currentStageArray.length > 0) {
	                        return currentStageArray.map((item, idx) => {
	                          if (!item || !item.date || !item.start || !item.end) return null;
	                          const stageName = capitalize(etapa);
	                          return (
	                            <li key={`${etapa}-${idx}`} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg">
	                              <div><span className="font-semibold text-gray-800">{stageName} {idx + 1}:</span> {new Date(item.date).toLocaleDateString("pt-BR")} | {item.start} - {item.end}</div>
	                              <button onClick={() => setPendingRemovals([...pendingRemovals, { etapa, idx }])} className="p-2 text-red-500 hover:bg-red-100 rounded-full transition-colors"><Trash2 size={16} /></button>
	                            </li>
	                          );
	                        });
	                      }
	                    } else {
	                      // Para outras etapas (montagem, desmontagem)
	                      if (resumo[etapa]) {
	                        const item = resumo[etapa];
	                        if (!item || !item.date || !item.start || !item.end) return null;
	                        return (
	                          <li key={etapa} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg">
	                            <div><span className="font-semibold text-gray-800">{capitalize(etapa)}:</span> {new Date(item.date).toLocaleDateString("pt-BR")} | {item.start} - {item.end}</div>
	                            <button onClick={() => setPendingRemovals([...pendingRemovals, { etapa }])} className="p-2 text-red-500 hover:bg-red-100 rounded-full transition-colors"><Trash2 size={16} /></button>
	                          </li>
	                        );
	                      }
	                    }
                    return [];
                  })}
                  {(!resumo.evento || resumo.evento.length === 0) && !resumo.ensaio && !resumo.montagem && !resumo.desmontagem && <p className="text-center text-gray-400 py-4">Nenhuma etapa adicionada ainda.</p>}
                </ul>

                {pendingRemovals.length > 0 && (
                  <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg text-sm">
                    <p className="text-yellow-800 font-semibold mb-2">Você marcou {pendingRemovals.length} item(ns) para remoção.</p>
                    <button onClick={handleConfirmRemovals} className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold">Confirmar Cancelamento</button>
                  </div>
                )}

                <div className="mt-6 border-t pt-6">
                  {!firstStepDone ? (
                    <button onClick={handleSendEmail} disabled={!isFormValid()} className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all duration-200 hover:scale-[1.02] disabled:bg-gray-300 disabled:cursor-not-allowed disabled:scale-100">
                      Confirmar 1ª Etapa e Agendar
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-4 bg-green-100 text-green-800 rounded-lg text-center font-semibold flex items-center justify-center gap-2"><CheckCircle size={20}/> Etapa 1 Concluída!</div>
                      <button onClick={handleDownloadPDF} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-transform duration-200 hover:scale-[1.02]">
                        <Download size={20}/> Baixar Comprovante em PDF
                      </button>
                      <button onClick={handleGoToSecondStep} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-yellow-500 text-gray-900 rounded-lg font-bold hover:bg-yellow-600 transition-transform duration-200 hover:scale-[1.02]">
                        Ir para a 2ª Etapa <ArrowRight size={20}/>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default AppVertical;
