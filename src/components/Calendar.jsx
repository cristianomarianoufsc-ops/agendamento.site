import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// ATUALIZADO: Adicionada a prop 'selectedDate'
const Calendar = ({ onDateSelect, selectedDate, currentMonth, onMonthChange, disabledDates = [], eventDates = [], mainEventDatesSelected = [] }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const lastDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startDayOfWeek = firstDayOfMonth.getDay();

  const days = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className="p-1"></div>);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
    // ✅ CORREÇÃO: Garante que a data de comparação seja YYYY-MM-DD
    const dateString = date.toISOString().split('T')[0];
    const isPast = date < today;
    // ✅ ATUALIZADO: Verifica se a data está na lista de datas desabilitadas (bloqueadas pelo admin ou lotadas)
    const isDisabled = disabledDates.includes(dateString) || isPast;

    // Lógica para estilização
    const isMainEvent = mainEventDatesSelected.some(d => d.getTime() === date.getTime());
    const hasOtherEvent = eventDates.includes(dateString) && !isMainEvent;
    
    // ATUALIZADO: Lógica para saber se este é o dia atualmente selecionado
    const isCurrentlySelected = selectedDate && selectedDate.toDateString() === date.toDateString();

    let buttonClass = "w-full aspect-square flex items-center justify-center rounded-full text-sm font-semibold transition-colors duration-200";

    // ATUALIZADO: Nova ordem de prioridade para os estilos
    if (isDisabled) {
      buttonClass += " bg-gray-100 text-gray-400 cursor-not-allowed";
    } else if (isCurrentlySelected) {
      // 1ª Prioridade: Destaca o dia clicado com azul
      buttonClass += " bg-blue-600 text-white scale-110 shadow-lg";
    } else if (isMainEvent) {
      // 2ª Prioridade: Marca os eventos principais já agendados com amarelo forte
      buttonClass += " bg-yellow-400 text-black";
    } else if (hasOtherEvent) {
      // 3ª Prioridade: Marca outros dias ocupados com amarelo claro
      buttonClass += " bg-yellow-200 text-yellow-800 hover:bg-yellow-300";
    } else {
      // Padrão: Dia livre
      buttonClass += " bg-white text-gray-700 hover:bg-blue-100";
    }

    days.push(
      <div key={i} className="p-1">
        <button
          onClick={() => !isDisabled && onDateSelect(date)}
          disabled={isDisabled}
          className={buttonClass}
        >
          {i}
        </button>
      </div>
    );
  }

  const handlePrevMonth = () => {
    onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  return (
    <div className="w-full bg-white rounded-lg">
      <div className="flex items-center justify-between mb-4 px-2">
        <button onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-gray-100">
          <ChevronLeft size={20} />
        </button>
        <h3 className="text-lg font-bold text-gray-800">
          {currentMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
        </h3>
        <button onClick={handleNextMonth} className="p-2 rounded-full hover:bg-gray-100">
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-500 mb-2 px-2">
        <div>Dom</div>
        <div>Seg</div>
        <div>Ter</div>
        <div>Qua</div>
        <div>Qui</div>
        <div>Sex</div>
        <div>Sab</div>
      </div>
      <div className="grid grid-cols-7 gap-1 px-2">
        {days}
      </div>
    </div>
  );
};

export default Calendar;
