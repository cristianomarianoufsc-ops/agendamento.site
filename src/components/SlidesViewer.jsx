import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Doughnut } from 'react-chartjs-2';

const SlidesViewer = ({ analysisData, onClose }) => {
  const [currentSlide, setCurrentSlide] = useState(1);
  const totalSlides = 6;

  const totalInscricoes = analysisData.inscriptions.length;
  const avaliadasCount = analysisData.inscriptions.filter(
    (i) => i.finalScore !== null && i.finalScore !== undefined
  ).length;
  const emConflito = analysisData.inscriptions.filter((i) => i.hasConflict).length;
  const teatroCount = analysisData.inscriptions.filter((i) => i.local === 'Teatro').length;
  const igrejinhaCount = analysisData.inscriptions.filter((i) => i.local === 'Igrejinha').length;

  const percentualAvaliadas = totalInscricoes > 0 ? ((avaliadasCount / totalInscricoes) * 100).toFixed(1) : 0;
  const percentualPendentes = totalInscricoes > 0 ? (((totalInscricoes - avaliadasCount) / totalInscricoes) * 100).toFixed(1) : 0;
  const emConflitoPct = totalInscricoes > 0 ? ((emConflito / totalInscricoes) * 100).toFixed(1) : 0;

  const topProposals = analysisData.inscriptions
    .filter((i) => i.finalScore !== null && i.finalScore !== undefined)
    .sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0))
    .slice(0, 5);

  const locaisChartData = {
    labels: ['Teatro', 'Igrejinha'],
    datasets: [
      {
        data: [teatroCount, igrejinhaCount],
        backgroundColor: ['#3498DB', '#E74C3C'],
        borderColor: ['#2980B9', '#C0392B'],
        borderWidth: 2,
      },
    ],
  };

  const conflitosChartData = {
    labels: ['Sem Conflito', 'Com Conflito'],
    datasets: [
      {
        data: [totalInscricoes - emConflito, emConflito],
        backgroundColor: ['#27AE60', '#E74C3C'],
        borderColor: ['#229954', '#C0392B'],
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          font: { size: 14, weight: 'bold' },
          padding: 20,
        },
      },
    },
  };

  const nextSlide = () => {
    if (currentSlide < totalSlides) setCurrentSlide(currentSlide + 1);
  };

  const previousSlide = () => {
    if (currentSlide > 1) setCurrentSlide(currentSlide - 1);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowRight') nextSlide();
    if (e.key === 'ArrowLeft') previousSlide();
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide]);

  const renderSlide = () => {
    switch (currentSlide) {
      case 1:
        return (
          <div className="w-full h-full bg-gradient-to-br from-blue-900 to-blue-700 text-white p-12 flex flex-col justify-between">
            <div>
              <h1 className="text-6xl font-black mb-3">Análise do Edital</h1>
              <h2 className="text-3xl font-light opacity-90">Agendamento de Espaços Culturais - UFSC</h2>
            </div>
            <div className="grid grid-cols-3 gap-8 mb-8">
              <div className="bg-white bg-opacity-10 p-6 rounded-lg border-l-4 border-red-400">
                <p className="text-sm opacity-80 uppercase tracking-widest">Total de Inscrições</p>
                <p className="text-5xl font-black mt-3">{totalInscricoes}</p>
              </div>
              <div className="bg-white bg-opacity-10 p-6 rounded-lg border-l-4 border-green-400">
                <p className="text-sm opacity-80 uppercase tracking-widest">Avaliadas</p>
                <p className="text-5xl font-black mt-3">{avaliadasCount}</p>
              </div>
              <div className="bg-white bg-opacity-10 p-6 rounded-lg border-l-4 border-yellow-400">
                <p className="text-sm opacity-80 uppercase tracking-widest">Em Conflito</p>
                <p className="text-5xl font-black mt-3">{emConflito}</p>
              </div>
            </div>
            <div className="text-base opacity-90">
              <p>📅 Período: {new Date().toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="w-full h-full bg-white p-12 flex flex-col">
            <h2 className="text-4xl text-blue-900 mb-10 font-black">Status da Avaliação</h2>
            <div className="grid grid-cols-2 gap-8 flex-1">
              <div>
                <div className="bg-gradient-to-br from-green-500 to-green-600 p-8 rounded-lg text-white mb-6">
                  <p className="text-sm opacity-90 uppercase tracking-widest">Avaliações Concluídas</p>
                  <p className="text-5xl font-black mt-3">{avaliadasCount}/{totalInscricoes}</p>
                  <p className="text-xl opacity-95 mt-3">{percentualAvaliadas}% Completo</p>
                </div>
                <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 p-8 rounded-lg text-white">
                  <p className="text-sm opacity-90 uppercase tracking-widest">Pendentes</p>
                  <p className="text-5xl font-black mt-3">{totalInscricoes - avaliadasCount}</p>
                  <p className="text-xl opacity-95 mt-3">{percentualPendentes}%</p>
                </div>
              </div>
              <div className="bg-gray-100 p-8 rounded-lg border-l-4 border-blue-900">
                <h3 className="text-xl text-blue-900 font-bold mb-6">Informações Gerais</h3>
                <div className="space-y-3 text-base text-gray-700">
                  <p>
                    <strong>👥 Total de Avaliadores:</strong> {analysisData.totalEvaluators}
                  </p>
                  <p>
                    <strong>📋 Critérios Dinâmicos:</strong>{' '}
                    {analysisData.evaluationCriteria ? analysisData.evaluationCriteria.length : 0}
                  </p>
                  <p>
                    <strong>⚠️ Com Conflito:</strong> {emConflito} ({emConflitoPct}%)
                  </p>
                  <p>
                    <strong>✅ Status:</strong> Em Andamento
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="w-full h-full bg-white p-12 flex flex-col">
            <h2 className="text-4xl text-blue-900 mb-8 font-black">Top Propostas</h2>
            <div className="flex-1 overflow-y-auto space-y-4">
              {topProposals.map((p, idx) => {
                const scorePercent = (p.finalScore / 10) * 100;
                const medals = ['🥇', '🥈', '🥉', '→', '→'];
                return (
                  <div key={idx} className="p-5 bg-gray-100 rounded-lg border-l-4 border-blue-900">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold text-lg text-blue-900">
                          {medals[idx]} {p.nome}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">{p.local || 'Local não informado'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-black text-blue-900">{p.finalScore.toFixed(2)}</p>
                        <p className="text-xs text-gray-600 mt-1">de 10</p>
                      </div>
                    </div>
                    <div className="bg-gray-300 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-green-500 to-blue-900 h-full"
                        style={{ width: `${scorePercent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="w-full h-full bg-white p-12 flex flex-col">
            <h2 className="text-4xl text-blue-900 mb-10 font-black">Distribuição por Local</h2>
            <div className="grid grid-cols-2 gap-10 flex-1">
              <div className="flex items-center justify-center">
                <Doughnut data={locaisChartData} options={chartOptions} />
              </div>
              <div className="flex flex-col justify-center">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-lg text-white mb-4">
                  <p className="text-sm opacity-90 uppercase tracking-widest">🎭 Teatro</p>
                  <p className="text-4xl font-black mt-2">{teatroCount}</p>
                  <p className="text-lg opacity-95 mt-2">
                    {totalInscricoes > 0 ? ((teatroCount / totalInscricoes) * 100).toFixed(1) : 0}% das inscrições
                  </p>
                </div>
                <div className="bg-gradient-to-br from-red-500 to-red-600 p-6 rounded-lg text-white">
                  <p className="text-sm opacity-90 uppercase tracking-widest">⛪ Igrejinha</p>
                  <p className="text-4xl font-black mt-2">{igrejinhaCount}</p>
                  <p className="text-lg opacity-95 mt-2">
                    {totalInscricoes > 0 ? ((igrejinhaCount / totalInscricoes) * 100).toFixed(1) : 0}% das inscrições
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="w-full h-full bg-white p-12 flex flex-col">
            <h2 className="text-4xl text-blue-900 mb-10 font-black">Análise de Conflitos</h2>
            <div className="grid grid-cols-2 gap-10 flex-1">
              <div className="flex items-center justify-center">
                <Doughnut data={conflitosChartData} options={chartOptions} />
              </div>
              <div className="flex flex-col justify-center">
                <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-lg text-white mb-4">
                  <p className="text-sm opacity-90 uppercase tracking-widest">✅ Sem Conflito</p>
                  <p className="text-4xl font-black mt-2">{totalInscricoes - emConflito}</p>
                  <p className="text-lg opacity-95 mt-2">
                    {totalInscricoes > 0 ? (((totalInscricoes - emConflito) / totalInscricoes) * 100).toFixed(1) : 0}%
                  </p>
                </div>
                <div className="bg-gradient-to-br from-red-500 to-red-600 p-6 rounded-lg text-white">
                  <p className="text-sm opacity-90 uppercase tracking-widest">⚠️ Com Conflito</p>
                  <p className="text-4xl font-black mt-2">{emConflito}</p>
                  <p className="text-lg opacity-95 mt-2">{emConflitoPct}%</p>
                </div>
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="w-full h-full bg-gradient-to-br from-blue-900 to-blue-700 text-white p-12 flex flex-col justify-center">
            <h2 className="text-5xl font-black mb-10">Próximos Passos</h2>
            <div className="space-y-6 text-xl">
              <p className="pb-4 border-b border-white border-opacity-20">
                <span className="text-3xl mr-4">1️⃣</span> Revisar propostas em conflito de agendamento
              </p>
              <p className="pb-4 border-b border-white border-opacity-20">
                <span className="text-3xl mr-4">2️⃣</span> Consolidar agenda final com horários definitivos
              </p>
              <p className="pb-4 border-b border-white border-opacity-20">
                <span className="text-3xl mr-4">3️⃣</span> Notificar proponentes sobre decisões
              </p>
              <p>
                <span className="text-3xl mr-4">4️⃣</span> Publicar calendário definitivo dos eventos
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-11/12 h-5/6 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white p-6 flex justify-between items-center rounded-t-lg">
          <div>
            <h1 className="text-2xl font-bold">📊 Visualizador de Slides</h1>
            <p className="text-sm opacity-90">Análise do Edital de Agendamento - UFSC</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Slide Container */}
        <div className="flex-1 overflow-hidden">{renderSlide()}</div>

        {/* Footer Controls */}
        <div className="bg-gray-100 p-6 flex justify-between items-center rounded-b-lg border-t">
          <button
            onClick={previousSlide}
            disabled={currentSlide === 1}
            className="flex items-center gap-2 px-6 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft size={20} /> Anterior
          </button>

          <div className="text-center">
            <p className="text-lg font-bold text-gray-700">
              Slide {currentSlide} de {totalSlides}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={nextSlide}
              disabled={currentSlide === totalSlides}
              className="flex items-center gap-2 px-6 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Próximo <ChevronRight size={20} />
            </button>
            <button
              onClick={() => alert('💾 Funcionalidade de download será implementada em breve!')}
              className="flex items-center gap-2 px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
            >
              <Download size={20} /> Baixar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SlidesViewer;
