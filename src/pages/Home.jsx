
import React, { useState } from 'react';
import Header from '../components/Header';
import CalendarGrid from '../components/CalendarGrid';
import TimeBlockSelector from '../components/TimeBlockSelector';

function Home() {
  const [selecionado, setSelecionado] = useState(null);

  const horarios = [
    { hora: '08:00', status: 'disponível' },
    { hora: '08:30', status: 'parcial' },
    { hora: '09:00', status: 'indisponível' },
  ];

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <Header />
      <CalendarGrid />
      <TimeBlockSelector
        horarios={horarios}
        selecionado={selecionado}
        setSelecionado={setSelecionado}
      />
    </div>
  );
}

export default Home;
