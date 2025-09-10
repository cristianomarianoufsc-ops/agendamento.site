import React from "react";

const TimeBlockSelector = ({
  selectedDate,
  timeSlots,
  selectedTimes,
  onSelectTime,
  occupiedSlots,
  stage,
}) => {
  const toMinutes = (time) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };

  const isDisabled = (time) => {
    if (!selectedDate) return true;

    const t = toMinutes(time);

    // 🔴 Bloquear se já está ocupado (considerando intervalos)
    for (const slot of occupiedSlots) {
      const s = toMinutes(slot.start);
      const e = toMinutes(slot.end);
      if (t >= s && t < e) return true; // dentro de intervalo ocupado
    }

    // 📌 Regras específicas
    if (stage === "ensaio") {
      // Ensaio: pode iniciar até 15:30 e terminar até 16:30
      if (!selectedTimes.startTime && t > toMinutes("15:30")) return true; // limite p/ início
      if (selectedTimes.startTime && t > toMinutes("16:30")) return true;  // limite p/ término
    } else {
      // Outros estágios: início até 21:00 e término até 22:00
      if (!selectedTimes.startTime && t > toMinutes("21:00")) return true; // limite p/ início
      if (selectedTimes.startTime && t > toMinutes("22:00")) return true;  // limite p/ término
    }

    return false;
  };

  const isSelected = (time) => {
    if (!selectedTimes.startTime) return false;

    const t = toMinutes(time);
    const start = toMinutes(selectedTimes.startTime);
    const end = selectedTimes.endTime ? toMinutes(selectedTimes.endTime) : null;

    if (t === start) return true;
    if (end && t > start && t <= end) return true;
    return false;
  };

  return (
    <div className="grid grid-cols-4 gap-2">
      {timeSlots.map((time) => (
        <button
          key={time}
          disabled={isDisabled(time)}
          onClick={() => !isDisabled(time) && onSelectTime(time)}
          className={`p-2 rounded text-sm ${
            isDisabled(time)
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : isSelected(time)
              ? "bg-green-500 text-white"
              : "bg-gray-200 hover:bg-gray-300"
          }`}
        >
          {time}
        </button>
      ))}
    </div>
  );
};

export default TimeBlockSelector;
