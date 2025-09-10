// src/App.jsx
import React, { useState, useEffect } from "react";
import Calendar from "./components/Calendar";
import TimeBlockSelector from "./components/TimeBlockSelector";
import PessoaFisicaForm from "./components/PessoaFisicaForm";
import PessoaJuridicaForm from "./components/PessoaJuridicaForm";
import Proposta from "./components/Proposta";
import DadosDaProposta from "./components/DadosDaProposta";
import ResumoProposta from "./components/ResumoProposta";
import AcessComu from "./components/AcessComu";
import Gratuidade from "./components/Gratuidade";
import ResumoTotal from "./components/ResumoTotal";

const App = () => {
  const [localSelecionado, setLocalSelecionado] = useState(null);
  const [selectedStage, setSelectedStage] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [etapasSelecionadas, setEtapasSelecionadas] = useState([]);
  const [stageTimes, setStageTimes] = useState({ startTime: null, endTime: null });
  const [resumo, setResumo] = useState({ evento: [] });
  
  const [dadosPessoa, setDadosPessoa] = useState(null);
  const [dadosProposta, setDadosProposta] = useState(null);
  const [dadosAcessibilidade, setDadosAcessibilidade] = useState(null);
  const [dadosGratuidade, setDadosGratuidade] = useState(null);

  const [backendOcupados, setBackendOcupados] = useState({});

  const [currentStep, setCurrentStep] = useState('select_local');
  
  // Estado centralizado para os arquivos
  const [arquivos, setArquivos] = useState({});

  // Novo estado para o controle do modal de erro
  const [showErrorMessage, setShowErrorMessage] = useState(false);

  const timeSlots = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
    "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
    "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
    "17:00", "17:30", "18:00", "18:30", "19:00", "19:30",
    "20:00", "20:30", "21:00", "21:30", "22:00"
  ];

  const stageOrder = ["ensaio", "montagem", "evento", "desmontagem"];

  useEffect(() => {
    if (localSelecionado) {
      fetchOccupiedSlots(localSelecionado, currentMonth);
    }
  }, [localSelecionado, currentMonth]);

  const fetchOccupiedSlots = async (local, month) => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth() + 1;
    const formattedMonth = monthIndex < 10 ? `0${monthIndex}` : `${monthIndex}`;
    const timeMin = `${year}-${formattedMonth}-01T00:00:00Z`;
    const timeMax = `${year}-${formattedMonth}-${new Date(year, monthIndex, 0).getDate()}T23:59:59Z`;

    try {
      // CORREÇÃO AQUI: Mudando a URL para usar o proxy do Vite
      const response = await fetch(`/api_ical/${local}/horarios?timeMin=${timeMin}&timeMax=${timeMax}`);
      const data = await response.json();
      setBackendOcupados(data);
    } catch (error) {
      console.error("Erro ao buscar horários ocupados:", error);
      // Limpa os horários ocupados em caso de erro para evitar que o calendário trave
      setBackendOcupados({});
    }
  };

  const handleLocalSelect = (local) => {
    setLocalSelecionado(local);
    setCurrentStep('calendar');
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setStageTimes({ startTime: null, endTime: null });
  };

  // 🔹 Correção feita aqui: converte horários ISO para "HH:MM"
  const getOccupiedSlots = (date) => {
    if (!date) return [];
    const dateString = date.toISOString().split('T')[0];
    const slots = backendOcupados[dateString] || [];

    return slots.map(slot => {
      const start = new Date(slot.start).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
      const end = new Date(slot.end).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
      return { start, end };
    });
  };

  const confirmStage = (etapa) => {
    if (selectedDate && stageTimes.startTime && stageTimes.endTime) {
      setResumo(prevResumo => {
        const newResumo = { ...prevResumo };
        const newEntry = {
          date: selectedDate.toISOString(),
          start: stageTimes.startTime,
          end: stageTimes.endTime
        };
        if (etapa === 'evento') {
          newResumo.evento = [...(newResumo.evento || []), newEntry];
        } else {
          newResumo[etapa] = newEntry;
        }
        return newResumo;
      });
      setEtapasSelecionadas(prev => {
        if (!prev.includes(etapa)) {
          return [...prev, etapa].sort((a, b) => stageOrder.indexOf(a) - stageOrder.indexOf(b));
        }
        return prev;
      });
      setSelectedStage(null);
      setSelectedDate(null);
      setStageTimes({ startTime: null, endTime: null });
    }
  };

  const handleNextCalendarStep = () => {
    if (resumo.evento && resumo.evento.length > 0) {
      setCurrentStep('select_person_type');
    } else {
      // Corrigido: Substitui o alert() por um estado de erro
      setShowErrorMessage(true);
    }
  };

  const handlePersonTypeSelect = (type) => {
    setDadosPessoa({ tipo: type });
    if (type === 'fisica') {
      setCurrentStep('pessoa_fisica_form');
    } else {
      setCurrentStep('pessoa_juridica_form');
    }
  };
  
  // Função para lidar com o upload de arquivos e atualizar o estado centralizado
  const handleUpload = (key, file) => {
    setArquivos(prev => ({ ...prev, [key]: file }));
  };

  const handlePessoaFormNext = (dados) => {
    setDadosPessoa(prev => ({ ...prev, ...dados }));
    setCurrentStep('proposta_form');
  };

  const handlePropostaFormNext = (dados) => {
    setDadosProposta(dados);
    setCurrentStep('dados_da_proposta_form');
  };

  const handleDadosPropostaNext = (dados) => {
    setDadosProposta(prev => ({...prev, ...dados}));
    setCurrentStep('resumo_proposta_form');
  };
  
  const handlePessoaFormBack = () => {
    setCurrentStep('select_person_type');
  };
  
  const handlePropostaBack = () => {
    setCurrentStep(dadosPessoa?.tipo === 'fisica' ? 'pessoa_fisica_form' : 'pessoa_juridica_form');
  };

  const handleDadosPropostaBack = () => {
    setCurrentStep('proposta_form');
  };

  const handleRemoveStage = (etapaParaRemover) => {
    setResumo(prevResumo => {
      const newResumo = { ...prevResumo };
      if (etapaParaRemover === 'evento') {
        newResumo.evento = [];
      } else {
        delete newResumo[etapaParaRemover];
      }
      return newResumo;
    });

    setEtapasSelecionadas(prev => prev.filter(etapa => etapa !== etapaParaRemover));
  };
  
  const handleResumoPropostaConfirm = () => {
    setCurrentStep('acessibilidade_form');
  };
  
  const handleResumoPropostaBack = () => {
    setCurrentStep('dados_da_proposta_form');
  };
  
  const handleAcessibilidadeNext = (dados) => {
    setDadosAcessibilidade(dados);
    setCurrentStep('gratuidade_form');
  };
  
  const handleAcessibilidadeBack = () => {
    setCurrentStep('resumo_proposta_form');
  };
  
  const handleGratuidadeNext = (dados) => {
    setDadosGratuidade(dados);
    setCurrentStep('resumo_total');
  };
  
  const handleGratuidadeBack = () => {
    setCurrentStep('acessibilidade_form');
  };

  const dadosCompletos = {
    localSelecionado,
    resumoAgendamento: resumo,
    dadosPessoa,
    dadosProposta,
    dadosAcessibilidade,
    dadosGratuidade,
    // Adiciona o estado dos arquivos ao objeto final
    arquivos,
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-center mb-6">Agendamento de Espaços Culturais</h1>

      {currentStep === 'select_local' && (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          
          <ul className="list-disc list-inside text-gray-700 mb-6 px-4 text-sm max-w-2xl text-left">
            <li>Verificar previamente a disponibilidade do espaço requisitado na agenda deste formulário;</li>
            <li>Registrar todos os períodos necessários à realização da proposta, incluindo montagem, ensaio, realização do evento e desmontagem;</li>
            <li>Para eventos com cobrança de ingresso, a taxa de locação será calculada com base em todos os períodos reservados, incluindo aqueles destinados à montagem, desmontagem e ensaio, conforme disposto no item 11.4.2 do edital;</li>
            <li>Respeitar os prazos para solicitação de reserva do espaço, de acordo com o item 8.1.6. do edital;</li>
            <li>A confirmação da disponibilidade de uso será feita posteriormente pela equipe do DAC.</li>
          </ul>

          <h2 className="text-2xl font-bold mb-4">Selecione o Local</h2>

          <div className="flex gap-4">
            <button
              onClick={() => handleLocalSelect('teatro')}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 transition duration-300"
            >
              Teatro
            </button>
            <button
              onClick={() => handleLocalSelect('igrejinha')}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg shadow-md hover:bg-purple-700 transition duration-300"
            >
              Igrejinha
            </button>
          </div>
        </div>
      )}

      {currentStep !== 'select_local' && (
        <>
          {currentStep === 'calendar' && (
            <div>
              <h2 className="text-xl font-bold mb-4">
                Local Selecionado: {localSelecionado === 'teatro' ? 'Teatro' : 'Igrejinha'}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Selecione as Etapas:</h3>
                  {stageOrder.map((etapa) => (
                    <button
                      key={etapa}
                      onClick={() => {
                        setSelectedStage(prevStage => prevStage === etapa ? null : etapa);
                        setSelectedDate(null);
                        setStageTimes({ startTime: null, endTime: null });
                      }}
                      className={`block w-full text-left p-2 mb-2 rounded ${selectedStage === etapa ? "bg-blue-500 text-white" : "bg-gray-200"}`}
                    >
                      {etapa.charAt(0).toUpperCase() + etapa.slice(1)} {etapa === "evento" ? "(Obrigatório)" : ""}
                    </button>
                  ))}
                </div>

                <div>
                  {selectedStage && (
                    <Calendar
                      onDateSelect={handleDateSelect}
                      currentMonth={currentMonth}
                      onMonthChange={setCurrentMonth}
                      disabledDates={Object.keys(backendOcupados).filter(date => {
                        const slots = backendOcupados[date];
                        return slots && slots.length === timeSlots.length;
                      })}
                      eventDates={Object.keys(backendOcupados).filter(date => backendOcupados[date] && backendOcupados[date].length > 0)}
                      mainEventDatesSelected={resumo.evento.map(e => new Date(e.date))}
                      currentStage={selectedStage}
                    />
                  )}

                  {selectedDate && selectedStage && (
                    <TimeBlockSelector
                      selectedDate={selectedDate}
                      timeSlots={timeSlots}
                      selectedTimes={stageTimes}
                      onSelectTime={(time) => {
                        setStageTimes(prev => {
                          if (!prev.startTime) return { startTime: time, endTime: null };
                          if (time === prev.startTime) return { startTime: null, endTime: null };
                          if (time < prev.startTime) return { startTime: time, endTime: null };
                          if (time > prev.startTime) return { ...prev, endTime: time };
                          return { startTime: time, endTime: null };
                        });
                      }}
                      occupiedSlots={getOccupiedSlots(selectedDate)}
                      stage={selectedStage}
                    />
                  )}
                  {selectedDate && stageTimes.startTime && stageTimes.endTime && (
                    <button onClick={() => confirmStage(selectedStage)} className="mt-2 px-4 py-2 bg-green-600 text-white rounded">
                      Confirmar {selectedStage === "evento" ? "Evento" : selectedStage}
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-6 p-4 border rounded bg-gray-50">
                <h3 className="font-bold mb-2">Resumo da Solicitação</h3>
                {(Object.keys(resumo).length === 0 || (resumo.evento && resumo.evento.length === 0 && Object.keys(resumo).filter(k => k !== 'evento').length === 0)) && (
                  <p className="text-sm text-gray-500">Nenhum agendamento feito.</p>
                )}
                <ul className="text-sm">
                  {stageOrder.map((etapaOrdenada) => {
                    const dados = resumo[etapaOrdenada];
                    if (etapaOrdenada === 'evento' && dados && dados.length > 0) {
                      return (
                        <li key={etapaOrdenada} className="mb-1">
                          <strong>{etapaOrdenada.charAt(0).toUpperCase() + etapaOrdenada.slice(1)}:</strong>
                          <ul>
                            {dados.map((eventoItem, idx) => (
                              <li key={idx} className="mb-1 flex items-center justify-between ml-4">
                                <div>
                                  {new Date(eventoItem.date).toLocaleDateString()} de {eventoItem.start} até {eventoItem.end}
                                </div>
                                <button
                                  onClick={() => {
                                    setResumo(prevResumo => {
                                      const newEventos = prevResumo.evento.filter((_, i) => i !== idx);
                                      return { ...prevResumo, evento: newEventos };
                                    });
                                  }}
                                  className="ml-2 px-2 py-1 bg-red-500 text-white rounded text-xs"
                                >
                                  Remover
                                </button>
                              </li>
                            ))}
                          </ul>
                        </li>
                      );
                    } else if (dados && dados.date) {
                      const displayEtapa = etapaOrdenada.charAt(0).toUpperCase() + etapaOrdenada.slice(1);
                      return (
                        <li key={etapaOrdenada} className="mb-1 flex items-center justify-between">
                          <div>
                            <strong>{displayEtapa}:</strong> {new Date(dados.date).toLocaleDateString()} de {dados.start} até {dados.end}
                          </div>
                          <button
                            onClick={() => handleRemoveStage(etapaOrdenada)}
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
              </div>

              {resumo.evento && resumo.evento.length > 0 && (
                <div className="flex justify-center mt-4">
                  <button
                    onClick={handleNextCalendarStep}
                    className="px-4 py-2 bg-blue-600 text-white rounded"
                  >
                    Salvar e Continuar
                  </button>
                </div>
              )}
            </div>
          )}

          {currentStep === 'select_person_type' && (
            <div className="flex flex-col items-center justify-center p-8 bg-white rounded-lg shadow-md">
              <h2 className="text-2xl font-bold mb-6 text-center">Você é Pessoa Física ou Jurídica?</h2>
              <div className="flex gap-4">
                <button
                  onClick={() => handlePersonTypeSelect('fisica')}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition duration-300"
                >
                  Pessoa Física
                </button>
                <button
                  onClick={() => handlePersonTypeSelect('juridica')}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 transition duration-300"
                >
                  Pessoa Jurídica
                </button>
              </div>
              <button
                onClick={() => setCurrentStep('calendar')}
                className="mt-6 px-6 py-3 bg-gray-500 text-white rounded-lg shadow-md hover:bg-gray-600 transition duration-300"
              >
                Voltar para Calendário
              </button>
            </div>
          )}

          {currentStep === 'pessoa_fisica_form' && (
            <PessoaFisicaForm
              onNext={handlePessoaFormNext}
              onBack={handlePessoaFormBack}
              onUpload={handleUpload}
            />
          )}

          {currentStep === 'pessoa_juridica_form' && (
            <PessoaJuridicaForm
              onNext={handlePessoaFormNext}
              onBack={handlePessoaFormBack}
              onUpload={handleUpload}
            />
          )}

          {currentStep === 'proposta_form' && (
            <Proposta
              onNext={handlePropostaFormNext}
              onBack={handlePropostaBack}
              onUpload={handleUpload}
            />
          )}

          {currentStep === 'dados_da_proposta_form' && (
            <DadosDaProposta
              onNext={handleDadosPropostaNext}
              onBack={handleDadosPropostaBack}
              onUpload={handleUpload}
            />
          )}

          {currentStep === 'resumo_proposta_form' && (
            <ResumoProposta 
              dadosProposta={dadosProposta} 
              onConfirm={handleResumoPropostaConfirm}
              onBack={handleResumoPropostaBack} 
            />
          )}

          {currentStep === 'acessibilidade_form' && (
            <AcessComu 
              onNext={handleAcessibilidadeNext} 
              onBack={handleAcessibilidadeBack}
            />
          )}

          {currentStep === 'gratuidade_form' && (
            <Gratuidade
              onNext={handleGratuidadeNext}
              onBack={handleGratuidadeBack}
            />
          )}

          {currentStep === 'resumo_total' && (
            <ResumoTotal
              dadosCompletos={dadosCompletos}
              arquivos={arquivos}
              onBack={() => setCurrentStep('gratuidade_form')}
            />
          )}
        </>
      )}

      {/* Modal de Erro para o caso de não ter evento selecionado */}
      {showErrorMessage && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl text-center max-w-sm">
            <h3 className="text-lg font-bold text-red-600 mb-4">Atenção!</h3>
            <p className="text-gray-700 mb-6">É obrigatório agendar pelo menos um Evento Principal antes de continuar.</p>
            <button
              onClick={() => setShowErrorMessage(false)}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition duration-300"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
