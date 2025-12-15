// src/components/TimeBlockSelector.jsx

import React from "react";
import { motion } from 'framer-motion';

// ✅ 1. RECEBA A NOVA PROP 'allowOverlap'
const TimeBlockSelector = ({
  selectedDate,
  timeSlots,
  selectedTimes,
  onSelectTime,
  occupiedSlots,
  stage,
  allowOverlap, // Nova prop que vem do App.jsx
  stageTimeLimits // ✅ NOVA PROP: Limites de horário
}) => {
  const toMinutes = (time) => {
    if (!time) return 0;
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const isToday = selectedDate && selectedDate.getTime() === today.getTime();
  const { startTime, endTime } = selectedTimes || {};

  return (
    <div className="w-full">
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 mt-4">
        {timeSlots.map((time, index) => {
          
          // =================================================================

          // ✅ LÓGICA DE VERIFICAÇÃO FINAL E CORRIGIDA
          // =================================================================
          const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();
          const timeInMinutes = toMinutes(time);

          const allConflictingSlots = occupiedSlots.filter(occupied => {
            // ✅ VALIDAÇÃO: Verifica se occupied existe e tem as propriedades necessárias
            if (!occupied || !occupied.start || !occupied.end) return false;
            const occupiedStart = toMinutes(occupied.start);
            const occupiedEnd = toMinutes(occupied.end);
            // Verifica sobreposição: [time, time+30] se sobrepõe a [occupiedStart, occupiedEnd]
            return timeInMinutes < occupiedEnd && (timeInMinutes + 30) > occupiedStart;
          });

          // --- Lógica de Classificação do Bloco ---
          // 1. É um bloco fixo (vermelho) se HOUVER qualquer conflito não contestável
          const isFixedBlock = allConflictingSlots.some(slot => !slot.isContestable);
          // 2. É um bloco em parcial (amarelo) se HOUVER qualquer conflito contestável E NÃO for um bloco fixo
          const isProponentBlock = !isFixedBlock && allConflictingSlots.some(slot => slot.isContestable);

          // --- Lógica de Estilo e Comportamento ---
          let isDisabled = false;
          let buttonClass = "p-2 text-sm font-semibold rounded-lg transition-all duration-150 w-full disabled:opacity-40";

          if (isFixedBlock) {
            // Cenário 1: É um evento fixo do DAC. Bloqueia sempre.
            isDisabled = true;
            buttonClass += " bg-red-100 text-red-400 cursor-not-allowed line-through";
          } else if (isProponentBlock) {
            // Cenário 2: É um evento de outro proponente. Sempre pinta de amarelo e permite clique.
            // A lógica de bloqueio (se allowOverlap for false) é mantida, mas a cor é sempre amarela para indicar parcial.
            if (!allowOverlap) {
              isDisabled = true;
            }
            buttonClass += " bg-yellow-400 text-white hover:bg-yellow-500";
          } else {
            // Cenário 3: Não há conflito. Lógica padrão.
            const isSelectedStart = time === startTime;
            const isSelectedEnd = time === endTime;
            const isInRange = startTime && endTime && timeInMinutes > toMinutes(startTime) && timeInMinutes < toMinutes(endTime);

            if (isSelectedStart || isSelectedEnd) {
              buttonClass += " bg-blue-600 text-white scale-105 shadow-md";
            } else if (isInRange) {
              buttonClass += " bg-blue-200 text-blue-800";
            } else {
              buttonClass += " bg-gray-100 text-gray-700 hover:bg-blue-100 hover:scale-105";
            }
          }

          // Adiciona desabilitação por tempo (horários passados)
          if ((isToday && timeInMinutes < currentTimeInMinutes) || (startTime && !endTime && timeInMinutes < toMinutes(startTime))) {
            isDisabled = true;
          }
          
          // ✅ NOVA LÓGICA DE LIMITE DE HORÁRIO DINÂMICO
          // ✅ VALIDAÇÃO: Verifica se stageTimeLimits existe antes de acessar
          const maxStartTimeMinutes = stageTimeLimits && stageTimeLimits.start ? toMinutes(stageTimeLimits.start) : 0;
          const maxEndTimeMinutes = stageTimeLimits && stageTimeLimits.end ? toMinutes(stageTimeLimits.end) : 24 * 60;

          if (!startTime) {
            // Se estiver selecionando o horário de INÍCIO
            if (timeInMinutes < maxStartTimeMinutes || timeInMinutes > maxEndTimeMinutes) {
              isDisabled = true;
            }
          } else {
            // Se estiver selecionando o horário de TÉRMINO
            if (timeInMinutes > maxEndTimeMinutes) {
              isDisabled = true;
            }
          }
          
          // Garante que o estilo de desabilitado seja aplicado se ainda não foi
          if (isDisabled && !buttonClass.includes('cursor-not-allowed')) {
             buttonClass += " bg-gray-200 text-gray-400 cursor-not-allowed";
          }
          // =================================================================
          // FIM DA LÓGICA
          // =================================================================

          return (
            <motion.button
              key={index}
              disabled={isDisabled}
              onClick={() => onSelectTime(time)}
              className={buttonClass}
              whileTap={{ scale: isDisabled ? 1 : 0.95 }}
            >
              {time}
            </motion.button>
          );
        })}
      </div>
      {/* Legenda (opcional, mas bom para clareza) */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-gray-500">
	        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-gray-100 border"></div><span>Livre</span></div>
		        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-400"></div><span>Em Parcial</span></div>
	        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-100 border border-red-200"></div><span>Ocupado (Fixo)</span></div>
      </div>
    </div>
  );
};

export default TimeBlockSelector;
