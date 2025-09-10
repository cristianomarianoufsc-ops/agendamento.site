import React from "react";

function Calendar({ onDateSelect, disabledDates = [], onMonthChange, currentMonth, eventDates = [], mainEventDatesSelected = [], currentStage }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Zera o horário para comparação apenas de data

  const isDisabled = (date) => {
    const isPast = date < today;

    const isDisabledFromFullEvents = disabledDates.some(disabled =>
      date.toDateString() === new Date(disabled).toDateString()
    );

    const isMainEventDateAlreadySelected = currentStage === 'evento' && mainEventDatesSelected.some(selectedMainDate =>
      date.toDateString() === selectedMainDate.toDateString()
    );

    return isPast || isDisabledFromFullEvents || isMainEventDateAlreadySelected;
  };

  const hasEvent = (date) => {
    return eventDates.some(eventDate =>
      date.toDateString() === new Date(eventDate).toDateString()
    );
  };

  const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const startDay = startOfMonth.getDay(); // 0 = domingo
  const totalDays = endOfMonth.getDate();

  const daysOfWeek = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const calendarDays = [];

  for (let i = 0; i < startDay; i++) {
    calendarDays.push(<div key={`empty-${i}`} />);
  }

  for (let i = 1; i <= totalDays; i++) {
    const day = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
    const disabled = isDisabled(day);
    const eventDay = hasEvent(day);

    calendarDays.push(
      <button
        key={i}
        onClick={() => !disabled && onDateSelect(day)}
        disabled={disabled}
        className={`p-2 rounded w-10 h-10 text-center border
          ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-200"}
          ${eventDay ? "bg-yellow-300 font-bold" : ""}
        `}
        title={eventDay ? "Dia com evento" : ""}
      >
        {i}
      </button>
    );
  }

  const handlePrevMonth = () => {
    const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    onMonthChange(prevMonth);
  };

  const handleNextMonth = () => {
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    onMonthChange(nextMonth);
  };

  return (
    <div className="max-w-xs mb-4">
      <div className="flex justify-between items-center mb-2">
        <button onClick={handlePrevMonth} className="px-2 py-1">&lt;</button>
        <h2 className="text-lg font-bold">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h2>
        <button onClick={handleNextMonth} className="px-2 py-1">&gt;</button>
      </div>
      <div className="grid grid-cols-7 mb-2 text-center font-semibold">
        {daysOfWeek.map((day, idx) => (
          <div key={idx}>{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {calendarDays}
      </div>
    </div>
  );
}

export default Calendar;
