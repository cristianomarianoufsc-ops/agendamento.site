import React, { useState, useEffect } from "react";
import Calendar from "./components/Calendar";
import TimeBlockSelector from "./components/TimeBlockSelector";
import { Theater, Church, Calendar as CalendarIcon, Clock, User, Trash2, ArrowLeft, PartyPopper, ChevronDown, XCircle, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Modal from "./components/Modal"; 

const EnsaioPage = () => {
  // --- ESTADOS ---
  const [localSelecionado, setLocalSelecionado] = useState(null);
  const [selectedStage, setSelectedStage] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [stageTimes, setStageTimes] = useState({ startTime: null, endTime: null });
  const [resumo, setResumo] = useState({ ensaio: null });
  const [backendOcupados, setBackendOcupados] = useState({});
  const [currentStep, setCurrentStep] = useState("select_local");
  const [firstStepDone, setFirstStepDone] = useState(false);
  const [alertMessage, setAlertMessage] = useState(null);
  const [pendingRemovals, setPendingRemovals] = useState([]);
  const [showCompletionMessage, setShowCompletionMessage] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
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

  const timeSlots = [
    "08:00","08:30","09:00","09:30","10:00","10:30", "11:00","11:30","12:00","12:30","13:00","13:30",
    "14:00","14:30","15:00","15:30","16:00","16:30", "17:00","17:30","18:00","18:30","19:00","19:30",
    "20:00","20:30","21:00","21:30","22:00"
  ];

  const stageOrder = ["ensaio"];

  // --- FUNÇÕES DE LÓGICA ---
  const fetchOccupiedSlots = async (local) => {
    try {
      const response = await fetch(`" + (import.meta.env.VITE_API_URL || "http://localhost:4000") + "/ical/${local}/horarios`  );
      const data = await response.json();
      const occupiedByDate = {};
      (data.eventos || []).forEach((event) => {
        const start = new Date(event.start);
        const end = new Date(event.end);
        end.setMinutes(end.getMinutes() + 30);
        const dateString = start.toISOString().split("T")[0];
        const startTime = start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });
        const endTime = end.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });
        if (!occupiedByDate[dateString]) occupiedByDate[dateString] = [];
        occupiedByDate[dateString].push({ start: startTime, end: endTime });
      });
      setBackendOcupados(occupiedByDate);
    } catch (error) { console.error("❌ Erro ao buscar eventos:", error); setBackendOcupados({}); }
  };

  const handleLocalSelect = (local) => { setLocalSelecionado(local); setCurrentStep("calendar"); };

  const handleBackToLocalSelect = () => {
    setLocalSelecionado(null); setCurrentStep("select_local"); setSelectedStage(null); setSelectedDate(null);
    setStageTimes({ startTime: null, endTime: null }); setResumo({ ensaio: null });
    setUserData({ name: "", email: "", phone: "", eventName: "" }); 
    setFirstStepDone(false);
    setPendingRemovals([]); setBackendOcupados({}); setShowCompletionMessage(false);
  };

  const handleDateSelect = (date) => { setSelectedDate(date); setStageTimes({ startTime: null, endTime: null }); };

  const handleTimeSelection = (time) => {
    const { startTime } = stageTimes;
    const toMinutes = (t) => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    if (!startTime || toMinutes(time) <= toMinutes(startTime)) {
      setStageTimes({ startTime: time, endTime: null });
      setIsModalOpen(true);
      return;
    }
    setStageTimes({ ...stageTimes, endTime: time });
  };

  const getOccupiedSlots = (date) => {
    if (!date) return [];
    const dateString = date.toISOString().split("T")[0];
    const backendSlots = backendOcupados[dateString] || [];
    const localSlots = [];
    if (resumo.ensaio && resumo.ensaio.date.split("T")[0] === dateString) {
        localSlots.push({ start: resumo.ensaio.start, end: resumo.ensaio.end });
    }
    return [...backendSlots, ...localSlots];
  };

  const confirmStage = (etapa) => {
    if (!selectedDate || !stageTimes.startTime || !stageTimes.endTime) return;
    const newEntry = { date: selectedDate.toISOString(), start: stageTimes.startTime, end: stageTimes.endTime };
    const toMinutes = (time) => { const [h, m] = time.split(":").map(Number); return h * 60 + m; };
    const newStart = toMinutes(newEntry.start); const newEnd = toMinutes(newEntry.end);
    const hasConflict = getOccupiedSlots(selectedDate).some((slot) => { const s = toMinutes(slot.start); const e = toMinutes(slot.end); return newStart < e && newEnd > s; });
    if (hasConflict) { setAlertMessage({type: 'error', text: "Conflito de horário! Intervalo já ocupado."}); setTimeout(() => setAlertMessage(null), 4000); return; }
    
    setResumo({ [etapa]: newEntry });
    setSelectedStage(null);
    setSelectedDate(null);
    setStageTimes({ startTime: null, endTime: null });
  };

  const handleConfirmRemovals = async () => {
    try {
      if (firstStepDone && resumo.ensaio?.eventId) {
        await fetch(`" + (import.meta.env.VITE_API_URL || "http://localhost:4000") + "/api/cancel-events/${localSelecionado}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventIds: [resumo.ensaio.eventId] }   )
        });
        fetchOccupiedSlots(localSelecionado, currentMonth);
      }
      setResumo({ ensaio: null });
      setPendingRemovals([]);
      setAlertMessage({ type: 'success', text: "Cancelamento confirmado!" });
      setFirstStepDone(false);
    } catch (e) {
      console.error("Erro ao cancelar ensaio:", e);
      setAlertMessage({ type: 'error', text: "Erro ao cancelar. Tente novamente." });
    } finally {
      setTimeout(() => setAlertMessage(null), 3000);
    }
  };

  const handleSendEmail = async () => {
    try {
      const etapas = [];
      if (resumo.ensaio) {
        etapas.push({ nome: "ensaio", inicio: `${resumo.ensaio.date.split("T")[0]}T${resumo.ensaio.start}:00`, fim: `${resumo.ensaio.date.split("T")[0]}T${resumo.ensaio.end}:00` });
      }
      if (etapas.length === 0) {
        setAlertMessage({type: 'warning', text: "Nenhum ensaio selecionado."});
        return;
      }
      const response = await fetch("" + (import.meta.env.VITE_API_URL || "http://localhost:4000") + "/api/create-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ local: localSelecionado, resumo: userData.eventName, etapas, userData }   )
      });
      const result = await response.json();
      if (result?.success && result.eventos?.[0]) {
        setAlertMessage({type: 'success', text: "Agendamento confirmado! Enviando e-mails..."});
        const ensaioComId = { ...resumo.ensaio, eventId: result.eventos[0].id };
        setResumo({ ensaio: ensaioComId });
        fetchOccupiedSlots(localSelecionado, currentMonth);
        setFirstStepDone(true);
        setAlertMessage({type: 'success', text: "Ensaio agendado com sucesso!"});
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

  const handleFinalize = () => {
    setShowCompletionMessage(true);
  };

  useEffect(() => {
    if (localSelecionado) fetchOccupiedSlots(localSelecionado, currentMonth);
  }, [localSelecionado, currentMonth]);

  useEffect(() => {
    if (showCompletionMessage) {
      const timer = setTimeout(() => {
        handleBackToLocalSelect();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showCompletionMessage]);

  const alertStyles = { success: "bg-green-100 text-green-800", error: "bg-red-100 text-red-800", warning: "bg-yellow-100 text-yellow-800" };

  // --- RENDERIZAÇÃO DO COMPONENTE (JSX) ---
  return (
    <div className="bg-gray-50 min-h-screen font-sans">
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Horário de início confirmado!">
        <p>Agora, clique em 'OK' e escolha o horário de término no seletor.</p>
      </Modal>
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        <AnimatePresence>
          {alertMessage && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className={`fixed top-5 right-5 z-50 mb-4 p-4 rounded-xl shadow-lg text-sm font-semibold ${alertStyles[alertMessage.type] || 'bg-gray-100'}`}>{alertMessage.text}</motion.div>
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
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-800 mb-4">Agendamento de Ensaios</h1>
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
              <button onClick={handleBackToLocalSelect} className="text-sm text-blue-600 hover:text-blue-800 flex items-center">
                <ArrowLeft size={16} className="mr-1" /> Voltar
              </button>
            </div>
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="lg:w-1/2">
                <Calendar
                  local={localSelecionado}
                  occupiedSlots={backendOcupados}
                  selectedDate={selectedDate}
                  onDateSelect={handleDateSelect}
                  currentMonth={currentMonth}
                  setCurrentMonth={setCurrentMonth}
                />
              </div>
              <div className="lg:w-1/2">
                <TimeBlockSelector
                  timeSlots={timeSlots}
                  selectedDate={selectedDate}
                  occupiedSlots={getOccupiedSlots(selectedDate)}
                  stageTimes={stageTimes}
                  onTimeSelect={handleTimeSelection}
                  selectedStage="ensaio"
                  stageOrder={stageOrder}
                  resumo={resumo}
                  onStageSelect={() => {}}
                  onConfirmStage={confirmStage}
                  locaisNomes={locaisNomes}
                  localSelecionado={localSelecionado}
                  firstStepDone={firstStepDone}
                />
              </div>
            </div>
          </motion.div>
        )}
        {currentStep === "user_data" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto">
            <div className="mb-8 flex items-center justify-between">
              <h1 className="text-3xl font-bold text-gray-800">Dados do Proponente</h1>
              <button onClick={() => setCurrentStep("calendar")} className="text-sm text-blue-600 hover:text-blue-800 flex items-center">
                <ArrowLeft size={16} className="mr-1" /> Voltar
              </button>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-6">
              <h3 className="text-xl font-bold text-blue-800 mb-3">Resumo do Ensaio</h3>
              <p className="text-blue-700 font-semibold mb-2">Local: {locaisNomes[localSelecionado]}</p>
              {resumo.ensaio ? (
                <div className="flex justify-between items-center text-sm text-gray-700 bg-white p-3 rounded-md shadow-sm">
                  <span className="font-medium">Ensaio:</span>
                  <span>{new Date(resumo.ensaio.date).toLocaleDateString('pt-BR')} das {resumo.ensaio.start} às {resumo.ensaio.end}</span>
                  <button onClick={() => setPendingRemovals(prev => [...prev, { etapa: 'ensaio' }])} className="text-red-500 hover:text-red-700 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : (
                <p className="text-gray-500">Nenhum horário de ensaio selecionado.</p>
              )}
              {pendingRemovals.length > 0 && (
                <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg">
                  <p className="text-red-800 font-semibold mb-2">Confirmação de Cancelamento:</p>
                  <p className="text-red-700 text-sm mb-3">Você marcou o ensaio para remoção. Confirme para remover permanentemente.</p>
                  <div className="flex gap-2">
                    <button onClick={handleConfirmRemovals} className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors">
                      Confirmar Remoção
                    </button>
                    <button onClick={() => setPendingRemovals([])} className="px-3 py-1 bg-gray-300 text-gray-800 text-sm rounded hover:bg-gray-400 transition-colors">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <input type="text" placeholder="Nome Completo" value={userData.name} onChange={(e) => setUserData({ ...userData, name: e.target.value })} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" />
              <input type="email" placeholder="E-mail" value={userData.email} onChange={(e) => setUserData({ ...userData, email: e.target.value })} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" />
              <input type="tel" placeholder="Telefone (com DDD)" value={userData.phone} onChange={(e) => setUserData({ ...userData, phone: e.target.value })} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" />
              <input type="text" placeholder="Título do Ensaio" value={userData.eventName} onChange={(e) => setUserData({ ...userData, eventName: e.target.value })} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div className="flex justify-end pt-4">
              <button onClick={handleSendEmail} disabled={!isFormValid()} className={`px-6 py-3 rounded-lg text-white font-bold transition-colors ${isFormValid() ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'}`}>
                Finalizar Agendamento
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default EnsaioPage;
