import React, { useState, useEffect, useMemo } from "react";
import Calendar from "./components/Calendar";
import TimeBlockSelector from "./components/TimeBlockSelector";
import { Theater, Church, Calendar as CalendarIcon, Clock, User, Trash2, ArrowRight, CheckCircle, ArrowLeft, PartyPopper, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Modal from "./components/Modal"; 

const EnsaioPage = () => {
  // ESTADOS
  const [localSelecionado, setLocalSelecionado] = useState(null);
  const [selectedStage, setSelectedStage] = useState("ensaio"); // Hardcoded para ensaio
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [stageTimes, setStageTimes] = useState({ startTime: null, endTime: null });
  const [resumo, setResumo] = useState({ ensaio: null }); // Simplificado para ensaio
  const [backendOcupados, setBackendOcupados] = useState({});
  const [currentStep, setCurrentStep] = useState("select_local");
  const [firstStepDone, setFirstStepDone] = useState(false);
  const [alertMessage, setAlertMessage] = useState(null);
  const [pendingRemovals, setPendingRemovals] = useState([]);
  const [showCompletionMessage, setShowCompletionMessage] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // =================================================
  // ESTADOS DE CONFIGURAÇÃO (Simplificados)
  // =================================================
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictDetails, setConflictDetails] = useState(null);
  const [allowBookingOverlap, setAllowBookingOverlap] = useState(false); // Para guardar a config do admin
  const [configStageTimes, setConfigStageTimes] = useState({ // Horários limite do Admin
    ensaio: { start: "08:00", end: "21:00" },
  });
  const [blockedDates, setBlockedDates] = useState([]); // Datas bloqueadas do Admin
  const [pageTitle, setPageTitle] = useState("Agendamento de Ensaios"); 


  // ✅ Efeito para buscar configurações globais uma vez
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch("/api/config");
        const data = await response.json();
        setAllowBookingOverlap(data.allowBookingOverlap);
        if (data.pageTitle) setPageTitle(data.pageTitle);
          // ✅ CARREGA NOVAS CONFIGURAÇÕES DE CALENDÁRIO
          if (data.stageTimes) setConfigStageTimes({ ensaio: data.stageTimes.ensaio }); // Apenas ensaio
          // ✅ CORREÇÃO: Garante que blockedDates seja um array, mesmo que vazio
          if (data.blockedDates) setBlockedDates(Array.isArray(data.blockedDates) ? data.blockedDates : []);
      } catch (error) {
        console.error("Erro ao buscar configurações:", error);
        setPageTitle("Agendamento de Ensaios (Erro de Configuração)");
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

    // ✅ GERA OS SLOTS DE 30 EM 30 MINUTOS
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const totalMinutes = h * 60 + m;
        if (totalMinutes < 480 || totalMinutes >= 1350) { // 08:00 a 22:30
          continue;
        }
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    return slots;
  }, []);

  const stageOrder = ["ensaio"]; // Apenas ensaio

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
		          continue;
		        }
	        
	        if (data.error) {
	          console.error(`❌ Erro retornado pela API para ${year}-${month}:`, data.error);
	          continue;
	        }
	        
	        if (!data || !data.eventos) {
	          continue;
	        }
	        
	        // Processa eventos do mês
	        (data.eventos || []).forEach((event) => {
	          if (!event || !event.start || !event.end) return;
	          const start = new Date(event.start);
	          const end = new Date(event.end);
	          
	          if (isNaN(start.getTime()) || isNaN(end.getTime())) {
	            return;
	          }
	          
	          end.setMinutes(end.getMinutes() + 30);
	          const dateString = start.toISOString().split("T")[0];
	          const startTime = start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });
	          const endTime = end.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });
	          
	          if (!occupiedByDate[dateString]) occupiedByDate[dateString] = [];
	          occupiedByDate[dateString].push({ start: startTime, end: endTime, isContestable: event.isContestable });
	        });
	      } catch (monthError) {
	        console.error(`❌ Erro ao processar mês ${year}-${month}:`, monthError);
	        continue;
	      }
	    }
	    
	    setBackendOcupados(occupiedByDate);
	  } catch (error) {
	    console.error("❌ Erro ao buscar eventos:", error);
	    setBackendOcupados({});
	  }
	};

  const handleLocalSelect = (local) => { setLocalSelecionado(local); setCurrentStep("calendar"); };

  const handleBackToLocalSelect = () => {
    setLocalSelecionado(null); setCurrentStep("select_local"); setSelectedStage("ensaio"); setSelectedDate(null);
    setStageTimes({ startTime: null, endTime: null }); setResumo({ ensaio: null });
    setUserData({ name: "", email: "", phone: "", eventName: "" }); setFirstStepDone(false);
    setPendingRemovals([]); setBackendOcupados({}); setShowCompletionMessage(false);
  };

  const handleDateSelect = (date) => { setSelectedDate(date); setStageTimes({ startTime: null, endTime: null }); };

  const toMinutes = (t) => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; };

  const handleTimeSelection = (time) => {
    const { startTime } = stageTimes;

    if (!startTime || toMinutes(time) <= toMinutes(startTime)) {
      
      const timeInMinutes = toMinutes(time);
    const conflictingSlot = getOccupiedSlots(selectedDate, selectedStage).find(occupied => {
      if (!occupied || !occupied.start || !occupied.end) return false;
      const occupiedStart = toMinutes(occupied.start);
      const occupiedEnd = toMinutes(occupied.end);
      return timeInMinutes < occupiedEnd && (timeInMinutes + 30) > occupiedStart;
    });

      if (conflictingSlot && conflictingSlot.isContestable && allowBookingOverlap) {
        setConflictDetails({ etapa: selectedStage, pendingStartTime: time });
        setShowConflictModal(true);
        return; 
      }
      
      setStageTimes({ startTime: time, endTime: null });
      setIsModalOpen(true);
      return;
    }
    
    setStageTimes({ ...stageTimes, endTime: time });
  };

  const getOccupiedSlots = (date, etapa) => {
    if (!date) return [];
    const dateString = date.toISOString().split("T")[0];
    const backendSlots = backendOcupados[dateString] || [];
    
    // Filtra slots locais para a etapa atual (ensaio)
    const localSlots = [];
    if (resumo.ensaio && resumo.ensaio.date.split("T")[0] === dateString) {
      localSlots.push({ start: resumo.ensaio.start, end: resumo.ensaio.end });
    }
    
    return [...backendSlots, ...localSlots];
  };

  const confirmStage = (etapa, isDispute = false) => {
    if (!selectedDate || !stageTimes.startTime || !stageTimes.endTime) return;
    
    const newEntry = { date: selectedDate.toISOString(), start: stageTimes.startTime, end: stageTimes.endTime, isDispute };
    const newStart = toMinutes(newEntry.start);
    const newEnd = toMinutes(newEntry.end);

    // Verifica conflito com slots FIXOS (não contestáveis)
    const hasFixedConflict = getOccupiedSlots(selectedDate, etapa).some((slot) => {
      if (slot.isContestable) return false; // Ignora slots contestáveis
      const s = toMinutes(slot.start);
      const e = toMinutes(slot.end);
      return newStart < e && newEnd > s;
    });

    if (hasFixedConflict) {
      setAlertMessage({type: 'error', text: "Conflito de horário! Intervalo já ocupado por um evento fixo."});
      setTimeout(() => setAlertMessage(null), 4000);
      return;
    }

    // Lógica de resumo (apenas ensaio)
    setResumo({ ensaio: newEntry });

    // Reset de estados
    setSelectedDate(null);
    setStageTimes({ startTime: null, endTime: null });
  };

  const handleConfirmRemovals = async () => {
    try {
      const eventIdsToCancel = [];
      
      if (resumo.ensaio && resumo.ensaio.eventId) {
        eventIdsToCancel.push(resumo.ensaio.eventId);
      }

      if (eventIdsToCancel.length > 0) {
        await fetch(`/api/cancel-events/${localSelecionado}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventIds: eventIdsToCancel })
        });
        fetchOccupiedSlots(localSelecionado, currentMonth);
      }

      setResumo({ ensaio: null });
      setPendingRemovals([]);
      setAlertMessage({ type: 'success', text: "Cancelamento confirmado!" });
      setFirstStepDone(false);
    } catch (e) {
      console.error("Erro ao cancelar evento:", e);
      setAlertMessage({ type: 'error', text: "Erro ao cancelar. Tente novamente." });
    } finally {
      setTimeout(() => setAlertMessage(null), 3000);
    }
  };

  const handleSendEmail = async () => {
    try {
      const etapas = [];
      
      if (resumo.ensaio) {
        const item = resumo.ensaio;
        etapas.push({ nome: "ensaio", inicio: `${item.date.split("T")[0]}T${item.start}:00`, fim: `${item.date.split("T")[0]}T${item.end}:00`, isDispute: item.isDispute });
      }

      if (etapas.length === 0) {
        setAlertMessage({type: 'warning', text: "Nenhum ensaio selecionado."});
        return;
      }

      const response = await fetch("/api/create-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ local: localSelecionado, resumo: userData.eventName, etapas, userData })
      });

      const result = await response.json();

      if (result?.success && result.eventos?.[0]) {
        setAlertMessage({type: 'success', text: "Agendamento confirmado! Enviando e-mails..."});
        
        const ensaioComId = { ...resumo.ensaio, eventId: result.eventos[0].id };
        setResumo({ ensaio: ensaioComId });

        fetchOccupiedSlots(localSelecionado, currentMonth);
        setFirstStepDone(true);
        setAlertMessage({type: 'success', text: "Ensaio agendado com sucesso! Prossiga para a próxima etapa."});
      } else {
        setAlertMessage({type: 'error', text: result.error || "Erro ao salvar evento."});
      }
    } catch (err) {
      setAlertMessage({type: 'error', text: "Falha na comunicação com o servidor."});
    } finally {
      setTimeout(() => setAlertMessage(null), 5000);
    }
  };

  const isFormValid = () => userData.name.trim() && userData.email.trim() && userData.phone.trim() && userData.eventName.trim() && resumo.ensaio;

  const handleGoToSecondStep = () => {
    // Lógica placeholder para a segunda etapa
    setAlertMessage({type: 'warning', text: "A segunda etapa ainda não está implementada."});
    setTimeout(() => setAlertMessage(null), 3000);
  };

  const handleFinalize = () => {
    setShowCompletionMessage(true);
  };

  useEffect(() => {
    if (localSelecionado) fetchOccupiedSlots(localSelecionado);
  }, [localSelecionado]);

  useEffect(() => {
    if (showCompletionMessage) {
      const timer = setTimeout(() => {
        handleBackToLocalSelect();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showCompletionMessage]);

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

<Modal
  isOpen={showConflictModal}
  onClose={() => setShowConflictModal(false)}
  title="Atenção: Horário em Disputa!"
  showDefaultButton={false}
>
  <p className="text-center text-gray-600 mb-6">
    O horário que você selecionou já foi solicitado por outro proponente.
    Ao continuar, você entrará na disputa por esta vaga. A alocação final será decidida pela sua pontuação no edital.
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
        if (conflictDetails.pendingStartTime) {
          setStageTimes({ startTime: conflictDetails.pendingStartTime, endTime: null });
          setIsModalOpen(true);
        } else {
          confirmStage(conflictDetails.etapa, true);
        }
      }}
      className="flex-1 py-2 px-4 bg-yellow-500 text-white font-bold rounded-lg hover:bg-yellow-600"
    >
      Entrar na Disputa
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
                <p className="text-lg text-gray-600 mt-2">Sua solicitação de ensaio foi agendada com sucesso.</p>
                <p className="text-sm text-gray-500 mt-8">Você será redirecionado para a página inicial em 5 segundos...</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {currentStep === "select_local" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center min-h-[80vh] text-center">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-800 mb-4">{pageTitle}</h1>

            <p className="text-gray-600 mb-10 text-lg">Selecione o local desejado para o seu ensaio</p>
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
                <h1 className="text-3xl font-bold text-gray-800">Reserva de Ensaio</h1>

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
                  <input type="text" placeholder="Nome do Ensaio" value={userData.eventName} onChange={(e) => setUserData({ ...userData, eventName: e.target.value })} className="p-3 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-md">
		                <h3 className="font-bold text-xl mb-2 text-gray-700 flex items-center gap-2"><CalendarIcon size={20} /> 1. Escolha a data e horário do Ensaio</h3>
		                <p className="text-sm text-gray-600 mb-4 p-2 bg-yellow-50 rounded-lg border border-yellow-200">
		                  **Atenção:** As datas e horários marcados em **amarelo** já foram solicitados por outro proponente. Você pode se inscrever nessas horas e concorrer à vaga mesmo assim.
		                </p>
	                <div className="flex flex-col space-y-3">
	                  
	                        <div className="flex flex-col">
	                          <button
	                            onClick={() => { setSelectedStage("ensaio"); }}
	                            className={`w-full p-3 text-left rounded-lg font-semibold transition-all duration-200 flex items-center justify-between bg-blue-600 text-white shadow-md`}
	                          >
	                            <span>
	                              Ensaio
	                            </span>
	                            <motion.div animate={{ rotate: 0 }} transition={{ duration: 0.3 }}>
	                              <ChevronDown size={20} />
	                            </motion.div>
	                          </button>

	                        <AnimatePresence>
	                          {selectedStage === "ensaio" && (
	                            <motion.div
	                              initial={{ height: 0, opacity: 0, marginTop: 0 }}
	                              animate={{ height: 'auto', opacity: 1, marginTop: '1rem' }}
	                              exit={{ height: 0, opacity: 0, marginTop: 0 }}
	                              transition={{ duration: 0.3, ease: "easeInOut" }}
	                              className="overflow-hidden"
	                            >
	                              <div className="p-4 border rounded-lg bg-gray-50/50">
	                                <h3 className="font-semibold text-md mb-3 text-gray-700">2. Selecione o dia para <span className="text-blue-600">Ensaio</span></h3>
	            <Calendar
	              onDateSelect={handleDateSelect}
	              selectedDate={selectedDate}
	              currentMonth={currentMonth}
	              onMonthChange={setCurrentMonth}
	              disabledDates={blockedDates} // Passando as datas bloqueadas
	              eventDates={Object.keys(backendOcupados)}
	              mainEventDatesSelected={resumo.ensaio ? [new Date(resumo.ensaio.date)] : []}
	            />
		                                <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-gray-600">
		                                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-white border"></div><span>Livre</span></div>
		                                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-200"></div><span>Em Disputa</span></div>
		                                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-200"></div><span>Ocupado (Fixo)</span></div>
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
	                                      occupiedSlots={selectedDate ? getOccupiedSlots(selectedDate, "ensaio") : []}
	                                      stage={"ensaio"}
	                                      allowOverlap={allowBookingOverlap}
	                                      stageTimeLimits={configStageTimes["ensaio"]} 
	                                    />
	                                      {selectedDate && stageTimes.startTime && stageTimes.endTime && (
	                                        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => confirmStage("ensaio")} className="mt-6 w-full bg-green-600 text-white font-bold rounded-lg py-3 hover:bg-green-700 transition-transform duration-200 hover:scale-[1.02]">
	                                          Adicionar Ensaio ao Resumo
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
	                </div>
	              </div>

	              <div className="bg-white p-6 rounded-2xl shadow-md">
	                <h3 className="font-bold text-xl mb-4 text-gray-700">Resumo da Solicitação</h3>
	                <ul className="space-y-3 text-sm text-gray-600">
	                  {resumo.ensaio ? (
	                          <li key="ensaio" className="flex justify-between items-center bg-gray-50 p-2 rounded-lg">
	                            <div><span className="font-semibold text-gray-800">Ensaio:</span> {new Date(resumo.ensaio.date).toLocaleDateString("pt-BR")} | {resumo.ensaio.start} - {resumo.ensaio.end}</div>
	                            <button onClick={() => setResumo({ ensaio: null })} className="p-2 text-red-500 hover:bg-red-100 rounded-full transition-colors"><Trash2 size={16} /></button>
	                          </li>
	                        ) : (
	                            <p className="text-center text-gray-400 py-4">Nenhum ensaio adicionado ainda.</p>
	                        )}
	                </ul>

	                <div className="mt-6 border-t pt-6">
	                  {!firstStepDone ? (
	                    <button onClick={handleSendEmail} disabled={!isFormValid()} className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all duration-200 hover:scale-[1.02] disabled:bg-gray-300 disabled:cursor-not-allowed disabled:scale-100">
	                      Confirmar 1ª Etapa e Agendar
	                    </button>
	                  ) : (
	                    <div className="space-y-3">
	                      <div className="p-4 bg-green-100 text-green-800 rounded-lg text-center font-semibold flex items-center justify-center gap-2"><CheckCircle size={20}/> Etapa 1 Concluída!</div>
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

export default EnsaioPage;
