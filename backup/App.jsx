import React, { useState, useEffect } from "react";
import Calendar from "./components/Calendar";
import TimeBlockSelector from "./components/TimeBlockSelector";
import emailjs from "@emailjs/browser";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// IDs EmailJS reais
const EMAILJS_SERVICE_ID = "service_av5yggt";
const EMAILJS_TEMPLATE_ID = "template_78u0pe2";
const EMAILJS_PUBLIC_KEY = "YPflPLhFzNXY3iSd-";

const App = () => {
  const [localSelecionado, setLocalSelecionado] = useState(null);
  const [selectedStage, setSelectedStage] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [stageTimes, setStageTimes] = useState({ startTime: null, endTime: null });
  const [resumo, setResumo] = useState({ evento: [] });
  const [backendOcupados, setBackendOcupados] = useState({});
  const [currentStep, setCurrentStep] = useState("select_local");
  const [firstStepDone, setFirstStepDone] = useState(false);
  const [secondStepStarted, setSecondStepStarted] = useState(false);
  const [alertMessage, setAlertMessage] = useState(null);
  const [pendingRemovals, setPendingRemovals] = useState([]);
  
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
    "08:00","08:30","09:00","09:30","10:00","10:30",
    "11:00","11:30","12:00","12:30","13:00","13:30",
    "14:00","14:30","15:00","15:30","16:00","16:30",
    "17:00","17:30","18:00","18:30","19:00","19:30",
    "20:00","20:30","21:00","21:30","22:00"
  ];

  const stageOrder = ["ensaio", "montagem", "evento", "desmontagem"];

  useEffect(() => {
    if (localSelecionado) fetchOccupiedSlots(localSelecionado, currentMonth);
  }, [localSelecionado, currentMonth]);

  const fetchOccupiedSlots = async (local, month) => {
    try {
      const response = await fetch(`http://localhost:4000/ical/${local}/horarios`);
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
    } catch (error) {
      console.error("❌ Erro ao buscar eventos do backend:", error);
      setBackendOcupados({});
    }
  };

  const handleLocalSelect = (local) => {
    setLocalSelecionado(local);
    setCurrentStep("calendar");
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setStageTimes({ startTime: null, endTime: null });
  };

    const getOccupiedSlots = (date) => {
    if (!date) return [];
    const dateString = date.toISOString().split("T")[0];

    // Ocupados vindos do backend (Google Calendar)
    const backendSlots = backendOcupados[dateString] || [];

    // Ocupados vindos do resumo (o que o usuário já escolheu no frontend)
    const localSlots = [];

    stageOrder.forEach((etapa) => {
      if (etapa === "evento" && resumo.evento.length > 0) {
        resumo.evento.forEach((ev) => {
          if (ev.date.split("T")[0] === dateString) {
            localSlots.push({ start: ev.start, end: ev.end });
          }
        });
      } else if (resumo[etapa] && resumo[etapa].date) {
        if (resumo[etapa].date.split("T")[0] === dateString) {
          localSlots.push({ start: resumo[etapa].start, end: resumo[etapa].end });
        }
      }
    });

    // 🔗 Junta backend + frontend
    return [...backendSlots, ...localSlots];
  };

// Função para confirmar uma etapa escolhida
// Função para confirmar uma etapa escolhida
const confirmStage = (etapa) => {
  if (selectedDate && stageTimes.startTime && stageTimes.endTime) {
    const newEntry = {
      date: selectedDate.toISOString(),
      start: stageTimes.startTime,
      end: stageTimes.endTime,
    };

    // 🔴 Conversão auxiliar
    const toMinutes = (time) => {
      const [h, m] = time.split(":").map(Number);
      return h * 60 + m;
    };

    const newStart = toMinutes(newEntry.start);
    const newEnd = toMinutes(newEntry.end);

    // 🔒 Pegar todos os já ocupados do dia
    const occupiedSlots = getOccupiedSlots(selectedDate);

    // 🚫 Verificar se há conflito
    const hasConflict = occupiedSlots.some((slot) => {
      const s = toMinutes(slot.start);
      const e = toMinutes(slot.end);
      return newStart < e && newEnd > s; // sobreposição
    });

    if (hasConflict) {
      setAlertMessage("⚠️ Conflito de horário! Este intervalo já está ocupado.");
      setTimeout(() => setAlertMessage(null), 4000);
      return; // bloqueia o agendamento
    }

    // ✅ Se não conflitar, salva normalmente
    setResumo((prevResumo) => {
      const newResumo = { ...prevResumo };
      if (etapa === "evento") {
        // Evento pode ter vários
        newResumo.evento = [...(newResumo.evento || []), newEntry];
      } else {
        // Outras etapas só 1
        newResumo[etapa] = newEntry;
      }
      return newResumo;
    });

    // Reseta seleção
    setSelectedStage(null);
    setSelectedDate(null);
    setStageTimes({ startTime: null, endTime: null });
  }
};


   


  const handleConfirmRemovals = async () => {
  try {
    for (const removal of pendingRemovals) {
      let eventId = null;

      if (removal.etapa === "evento") {
        eventId = resumo.evento[removal.idx]?.eventId;
        setResumo((prev) => {
          const newResumo = { ...prev };
          newResumo.evento = newResumo.evento.filter((_, i) => i !== removal.idx);
          return newResumo;
        });
      } else {
        eventId = resumo[removal.etapa]?.eventId;
        setResumo((prev) => {
          const newResumo = { ...prev };
          delete newResumo[removal.etapa];
          return newResumo;
        });
      }

      // 🔴 Se tiver ID, chama backend
      if (eventId) {
        await fetch(`http://localhost:4000/api/cancel-event/${localSelecionado}/${eventId}`, {
          method: "DELETE",
        });
      }
    }

    setPendingRemovals([]);
    setFirstStepDone(false);
    setAlertMessage("✅ Cancelamento confirmado no Google Calendar!");
    setTimeout(() => setAlertMessage(null), 3000);
  } catch (e) {
    console.error(e);
    setAlertMessage("❌ Ocorreu um erro ao cancelar.");
    setTimeout(() => setAlertMessage(null), 3000);
  }
};

  const gerarTabelaEtapas = () => {
    let linhas = "";
    stageOrder.forEach((etapa) => {
      if (etapa === "evento" && resumo.evento.length > 0) {
        resumo.evento.forEach((ev, idx) => {
          linhas += `<tr><td>Evento ${idx + 1}</td><td>${new Date(ev.date).toLocaleDateString("pt-BR")}</td><td>${ev.start} - ${ev.end}</td></tr>`;
        });
      } else if (resumo[etapa]) {
        linhas += `<tr><td>${etapa}</td><td>${new Date(resumo[etapa].date).toLocaleDateString("pt-BR")}</td><td>${resumo[etapa].start} - ${resumo[etapa].end}</td></tr>`;
      }
    });
    return linhas || `<tr><td colspan="3">Nenhuma etapa agendada</td></tr>`;
  };
const handleDeleteAll = async () => {
  try {
    // Juntar todos os IDs
    const eventIds = [];
    if (resumo.ensaio?.eventId) eventIds.push(resumo.ensaio.eventId);
    if (resumo.montagem?.eventId) eventIds.push(resumo.montagem.eventId);
    if (resumo.evento?.length > 0) {
      resumo.evento.forEach((ev) => ev.eventId && eventIds.push(ev.eventId));
    }
    if (resumo.desmontagem?.eventId) eventIds.push(resumo.desmontagem.eventId);

    // 🔎 LOG DE DEBUG
    console.log("🔎 Enviando para deletar (frontend):", eventIds, "local:", localSelecionado);

    if (eventIds.length === 0) {
      setAlertMessage("⚠️ Nenhum evento encontrado para deletar.");
      return;
    }

    // Chamar backend para deletar tudo de uma vez
    // Tenta o endpoint POST atual
// Tenta o endpoint POST atual
let res = await fetch("http://localhost:4000/api/cancel-all-events", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    local: localSelecionado,
    eventIds,
  }),
});

// Fallback: se o servidor não tiver esse endpoint, tenta o alias DELETE
if (res.status === 404) {
  console.warn("⚠️ /api/cancel-all-events retornou 404. Tentando alias DELETE /api/cancel-all/:local...");
  res = await fetch(`http://localhost:4000/api/cancel-all/${localSelecionado}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventIds }),
  });
}

// 🔎 Logar resposta do backend
const resultado = await res.json().catch(() => null);
console.log("🗑️ Resposta do backend ao deletar:", resultado);


// Fallback: se o servidor não tiver esse endpoint, tenta o alias DELETE
if (res.status === 404) {
  console.warn("⚠️ /api/cancel-all-events retornou 404. Tentando alias DELETE /api/cancel-all/:local...");
  res = await fetch(`http://localhost:4000/api/cancel-all/${localSelecionado}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventIds }),
  });
}


    // Limpa resumo, mas mantém os dados do usuário
    setResumo({ evento: [] });
    setFirstStepDone(false);
    setAlertMessage("🗑️ Todos os eventos foram removidos do Google Calendar!");
    setTimeout(() => setAlertMessage(null), 4000);
  } catch (err) {
    console.error("Erro ao deletar todos os eventos:", err);
    setAlertMessage("❌ Erro ao deletar todos os eventos.");
    setTimeout(() => setAlertMessage(null), 4000);
  }
};



    const handleSendEmail = async () => {
  try {
    const etapas = [];

    // Construir payload correto
    if (resumo.ensaio) {
      etapas.push({
        nome: "ensaio",
        inicio: `${resumo.ensaio.date.split("T")[0]}T${resumo.ensaio.start}:00`,
        fim: `${resumo.ensaio.date.split("T")[0]}T${resumo.ensaio.end}:00`,
      });
    }
    if (resumo.montagem) {
      etapas.push({
        nome: "montagem",
        inicio: `${resumo.montagem.date.split("T")[0]}T${resumo.montagem.start}:00`,
        fim: `${resumo.montagem.date.split("T")[0]}T${resumo.montagem.end}:00`,
      });
    }
    resumo.evento.forEach((ev) => {
      etapas.push({
        nome: "evento",
        inicio: `${ev.date.split("T")[0]}T${ev.start}:00`,
        fim: `${ev.date.split("T")[0]}T${ev.end}:00`,
      });
    });
    if (resumo.desmontagem) {
      etapas.push({
        nome: "desmontagem",
        inicio: `${resumo.desmontagem.date.split("T")[0]}T${resumo.desmontagem.start}:00`,
        fim: `${resumo.desmontagem.date.split("T")[0]}T${resumo.desmontagem.end}:00`,
      });
    }

    // Enviar ao backend
    const response = await fetch("http://localhost:4000/api/create-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        local: localSelecionado,
        resumo: userData.eventName,
        etapas,
        userData,
      }),
    });

    const result = await response.json();

    if (result.success) {
      console.log("📌 Eventos criados no backend:", result.eventosCriados);

      // Atualiza estado
      setResumo((prevResumo) => ({ ...prevResumo }));
      setFirstStepDone(true);
      setAlertMessage(
        "✅ Primeira etapa concluída! Eventos salvos no Google Calendar e e-mails enviados pelo servidor."
      );
    } else {
      setAlertMessage("❌ Erro ao salvar eventos no Google Calendar.");
    }
  } catch (err) {
    console.error("Erro ao enviar para o backend:", err);
    setAlertMessage("❌ Falha na comunicação com o servidor.");
  } finally {
    setTimeout(() => setAlertMessage(null), 4000);
  }
};



//----------------------------------

  const isFormValid = () => {
    return (
      userData.name.trim() !== "" &&
      userData.email.trim() !== "" &&
      userData.phone.trim() !== "" &&
      userData.eventName.trim() !== "" &&
      resumo.evento && resumo.evento.length > 0
    );
  };

  const handleGeneratePDF = () => {
    const titulo = "Resumo da Solicitação – Primeira Etapa";
    const linhas = gerarTabelaEtapas();
const localTxt = locaisNomes[localSelecionado] || localSelecionado;

    const html = `<div><h1>${titulo}</h1><p>Local: ${localTxt}</p><table><tbody>${linhas}</tbody></table></div>`;
    // eslint-disable-next-line no-undef
    html2pdf().from(html).set({ filename: "resumo.pdf" }).save();
  };

const handleGoToSecondStep = async () => {
  try {
    const res = await fetch("http://localhost:4000/api/forms-link");
    const data = await res.json();

    if (data.formsLink) {
      window.open(data.formsLink, "_blank"); // abre link configurado no Admin
    } else {
      alert("⚠️ Nenhum link configurado no painel administrativo.");
    }
  } catch (err) {
    console.error("Erro ao buscar o link da segunda etapa:", err);
    alert("❌ Erro ao carregar link da segunda etapa.");
  }
};


  return (
    <div className="container mx-auto p-4">
      {alertMessage && <div className="mb-4 p-2 bg-green-100 text-green-700">{alertMessage}</div>}

      {currentStep === "select_local" && (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <h1 className="text-3xl font-bold mb-6">Agendamento DAC</h1>
          <div className="flex gap-4">
            <button onClick={() => handleLocalSelect("teatro")} className="px-6 py-3 bg-indigo-600 text-white rounded">
  {locaisNomes.teatro}
</button>
<button onClick={() => handleLocalSelect("igrejinha")} className="px-6 py-3 bg-purple-600 text-white rounded">
  {locaisNomes.igrejinha}
</button>

          </div>
        </div>
      )}

      {currentStep === "calendar" && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Primeira etapa: preencher dados básicos</h2>

          <div className="mb-4 p-4 border rounded bg-gray-50 max-w-md">
            <input type="text" placeholder="Nome" value={userData.name} onChange={(e) => setUserData({ ...userData, name: e.target.value })} className="p-2 border rounded w-full mb-2" />
            <input type="email" placeholder="E-mail" value={userData.email} onChange={(e) => setUserData({ ...userData, email: e.target.value })} className="p-2 border rounded w-full mb-2" />
            <input type="tel" placeholder="Telefone" value={userData.phone} onChange={(e) => setUserData({ ...userData, phone: e.target.value })} className="p-2 border rounded w-full mb-2" />
            <input type="text" placeholder="Nome do Evento" value={userData.eventName} onChange={(e) => setUserData({ ...userData, eventName: e.target.value })} className="p-2 border rounded w-full" />
          </div>

          <h2 className="text-xl font-bold mb-4">
		  Local Selecionado: {locaisNomes[localSelecionado] || localSelecionado}
		  </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">Selecione as Etapas:</h3>
              {stageOrder.map((etapa) => {
                const isDisabled = etapa === "desmontagem" && (!resumo.evento || resumo.evento.length === 0);
                return (
                  <button
                    key={etapa}
                    onClick={() => {
  if (!isDisabled) {
    setSelectedStage(selectedStage === etapa ? null : etapa);
  }
}}

                    disabled={isDisabled}
                    className={`block w-full p-2 mb-2 rounded ${isDisabled ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-gray-200 hover:bg-gray-300"}`}
                  >
                    {etapa} {etapa === "evento" ? "(Obrigatório)" : ""}
                    {isDisabled && " (liberado após Evento)"}
                  </button>
                );
              })}
            </div>

            <div>
              {selectedStage && (
                <Calendar onDateSelect={handleDateSelect} currentMonth={currentMonth} onMonthChange={setCurrentMonth} disabledDates={Object.keys(backendOcupados).filter((date) => backendOcupados[date].length === timeSlots.length)} eventDates={Object.keys(backendOcupados)} mainEventDatesSelected={resumo.evento.map((e) => new Date(e.date))} currentStage={selectedStage || "evento"} />
              )}

              {selectedDate && selectedStage && (
                <TimeBlockSelector selectedDate={selectedDate} timeSlots={timeSlots} selectedTimes={stageTimes} onSelectTime={(time) => {
                  setStageTimes((prev) => {
                    if (!prev.startTime) return { startTime: time, endTime: null };
                    if (time === prev.startTime) return { startTime: null, endTime: null };
                    if (time < prev.startTime) return { startTime: time, endTime: null };
                    if (time > prev.startTime) return { ...prev, endTime: time };
                    return { startTime: time, endTime: null };
                  });
                }} occupiedSlots={getOccupiedSlots(selectedDate)} stage={selectedStage} />
              )}

              {selectedDate && stageTimes.startTime && stageTimes.endTime && (
  <button
    onClick={() => confirmStage(selectedStage)}
    className="mt-2 px-4 py-2 bg-green-600 text-white rounded"
  >
    Confirmar {selectedStage}
  </button>
)}

            </div>
          </div>

          {/* Resumo */}
          <div className="mt-6 p-4 border rounded bg-gray-50">
            <h3 className="font-bold mb-2">Resumo da Solicitação</h3>
           <ul className="text-sm">
  {stageOrder.map((etapaOrdenada) => {
    const dados = resumo[etapaOrdenada];

    // Caso especial para EVENTO (pode ter vários)
    if (etapaOrdenada === "evento" && dados && dados.length > 0) {
      return dados.map((eventoItem, idx) => (
        <li key={idx} className="mb-1 flex justify-between">
          <span>
            evento {idx + 1}:{" "}
            {new Date(eventoItem.date).toLocaleDateString("pt-BR")}{" "}
            {eventoItem.start}-{eventoItem.end}
          </span>
          <button
            onClick={() =>
              setPendingRemovals([...pendingRemovals, { etapa: "evento", idx }])
            }
            className="ml-2 px-2 py-1 bg-red-500 text-white rounded text-xs"
          >
            Remover
          </button>
        </li>
      ));
    }

    // Outras etapas (ensaio, montagem, desmontagem)
    else if (dados && dados.date) {
      return (
        <li key={etapaOrdenada} className="mb-1 flex justify-between">
          <span>
            {etapaOrdenada}:{" "}
            {new Date(dados.date).toLocaleDateString("pt-BR")}{" "}
            {dados.start}-{dados.end}
          </span>
          <button
            onClick={() =>
              setPendingRemovals([...pendingRemovals, { etapa: etapaOrdenada }])
            }
            className="ml-2 px-2 py-1 bg-red-500 text-white rounded text-xs"
          >
            Remover
          </button>
        </li>
      );
    }

    return null;
  })}
</ul>

            {pendingRemovals.length > 0 && (
              <div className="mt-4 p-2 bg-yellow-100 border border-yellow-300 rounded">
                <p className="text-yellow-800 mb-2">Você marcou {pendingRemovals.length} item(ns) para remoção.</p>
                <button onClick={handleConfirmRemovals} className="px-4 py-2 bg-red-600 text-white rounded">Confirmar Cancelamento</button>
              </div>
            )}

            {/* Botões de ação */}
            <div className="mt-4 flex flex-wrap gap-3">
              {isFormValid() && !firstStepDone && (
                <button onClick={handleSendEmail} className="px-4 py-2 bg-blue-600 text-white rounded">Confirmar 1ª Etapa</button>
              )}
              {firstStepDone && (
  <>
    <button onClick={handleGeneratePDF} className="px-4 py-2 border rounded">Gerar PDF</button>
    <button onClick={() => window.print()} className="px-4 py-2 border rounded">Imprimir</button>
    <button onClick={handleGoToSecondStep} className="px-4 py-2 bg-amber-600 text-white rounded">Segunda Etapa</button>

   
  </>
)}

            </div>

            {firstStepDone && <div className="mt-6 text-green-700">🎉 Parabéns! Você concluiu a primeira etapa.</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
