import React from 'react';
import { X, Download, TrendingUp, Users, AlertTriangle, MapPin, CheckCircle, List } from 'lucide-react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

const InsightsViewer = ({ analysisData, onClose }) => {
  const totalInscricoes = analysisData.inscriptions.length;
  const avaliadasCount = analysisData.inscriptions.filter(
    (i) => (i.finalScore !== null && i.finalScore !== undefined) || (i.finalscore !== null && i.finalscore !== undefined)
  ).length;
  
  // Função auxiliar para pegar valor de chave independente de case
  const getVal = (obj, key) => {
    const lowerKey = key.toLowerCase();
    const foundKey = Object.keys(obj).find(k => k.toLowerCase() === lowerKey);
    return foundKey ? obj[foundKey] : null;
  };

  const emConflito = analysisData.inscriptions.filter((i) => {
    const val = getVal(i, 'hasConflict');
    return val === 1 || val === true || val === '1' || val === 'true';
  }).length;

  const teatroCount = analysisData.inscriptions.filter((i) => {
    const val = getVal(i, 'local');
    return val === 'Teatro' || val === 'teatro' || val === 'TEATRO';
  }).length;

  const igrejinhaCount = analysisData.inscriptions.filter((i) => {
    const val = getVal(i, 'local');
    return val === 'Igrejinha' || val === 'igrejinha' || val === 'IGREJINHA';
  }).length;

  const percentualAvaliadas = totalInscricoes > 0 ? ((avaliadasCount / totalInscricoes) * 100).toFixed(1) : 0;
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
        backgroundColor: ['#3B82F6', '#EF4444'],
        borderColor: ['#2563EB', '#DC2626'],
        borderWidth: 1,
      },
    ],
  };

  const conflitosChartData = {
    labels: ['Sem Conflito', 'Com Conflito'],
    datasets: [
      {
        data: [totalInscricoes - emConflito, emConflito],
        backgroundColor: ['#10B981', '#F59E0B'],
        borderColor: ['#059669', '#D97706'],
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          boxWidth: 12,
          padding: 15,
          font: { size: 12 }
        },
      },
    },
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header Fixo */}
        <div className="bg-white border-b border-gray-200 p-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <TrendingUp size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Insights do Edital</h1>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Análise de Dados e Estatísticas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Conteúdo com Scroll Vertical */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          
          {/* Grid de Cards Principais */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-3 text-blue-600">
                <List size={20} />
                <span className="text-sm font-bold uppercase">Total</span>
              </div>
              <p className="text-3xl font-black text-gray-800">{totalInscricoes}</p>
              <p className="text-xs text-gray-500 mt-1">Inscrições recebidas</p>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-3 text-green-600">
                <CheckCircle size={20} />
                <span className="text-sm font-bold uppercase">Avaliadas</span>
              </div>
              <p className="text-3xl font-black text-gray-800">{avaliadasCount}</p>
              <p className="text-xs text-gray-500 mt-1">{percentualAvaliadas}% do total concluído</p>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-3 text-amber-500">
                <AlertTriangle size={20} />
                <span className="text-sm font-bold uppercase">Conflitos</span>
              </div>
              <p className="text-3xl font-black text-gray-800">{emConflito}</p>
              <p className="text-xs text-gray-500 mt-1">{emConflitoPct}% com sobreposição</p>
            </div>
          </div>

          {/* Seção de Gráficos e Detalhes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Distribuição por Local */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                <MapPin size={18} className="text-indigo-500" /> Distribuição por Local
              </h3>
              <div className="flex flex-col items-center">
                <div className="h-48 w-full mb-6">
                  <Doughnut data={locaisChartData} options={chartOptions} />
                </div>
                <div className="w-full space-y-3">
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm font-semibold text-blue-700">Teatro</span>
                    <span className="font-bold text-blue-800">{teatroCount}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                    <span className="text-sm font-semibold text-red-700">Igrejinha</span>
                    <span className="font-bold text-red-800">{igrejinhaCount}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Status de Conflitos */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                <AlertTriangle size={18} className="text-indigo-500" /> Análise de Conflitos
              </h3>
              <div className="flex flex-col items-center">
                <div className="h-48 w-full mb-6">
                  <Doughnut data={conflitosChartData} options={chartOptions} />
                </div>
                <div className="w-full space-y-3">
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span className="text-sm font-semibold text-green-700">Sem Conflito</span>
                    <span className="font-bold text-green-800">{totalInscricoes - emConflito}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg">
                    <span className="text-sm font-semibold text-amber-700">Com Conflito</span>
                    <span className="font-bold text-amber-800">{emConflito}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Propostas */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
              <TrendingUp size={18} className="text-indigo-500" /> Top 5 Propostas (Melhores Notas)
            </h3>
            <div className="space-y-3">
              {topProposals.length > 0 ? topProposals.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-indigo-200 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm ${
                      idx === 0 ? 'bg-yellow-100 text-yellow-700' : 
                      idx === 1 ? 'bg-gray-200 text-gray-700' : 
                      idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 text-sm">{getVal(p, 'nome') || getVal(p, 'evento_nome') || 'Sem Nome'}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <MapPin size={10} /> {getVal(p, 'local') || 'Sem Local'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-indigo-600">{(getVal(p, 'finalScore') || 0).toFixed(2)}</p>
                    <p className="text-[10px] text-gray-400 uppercase font-bold">Pontos</p>
                  </div>
                </div>
              )) : (
                <p className="text-center py-8 text-gray-400 italic">Nenhuma proposta avaliada até o momento.</p>
              )}
            </div>
          </div>

          {/* Informações Adicionais */}
          <div className="bg-indigo-600 p-6 rounded-xl text-white shadow-lg shadow-indigo-200">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Users size={18} /> Informações do Sistema
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-white bg-opacity-10 p-3 rounded-lg">
                <p className="opacity-70 text-xs uppercase font-bold mb-1">Avaliadores</p>
                <p className="text-xl font-bold">{analysisData.totalEvaluators}</p>
              </div>
              <div className="bg-white bg-opacity-10 p-3 rounded-lg">
                <p className="opacity-70 text-xs uppercase font-bold mb-1">Critérios</p>
                <p className="text-xl font-bold">{analysisData.evaluationCriteria?.length || 0}</p>
              </div>
            </div>
          </div>

        </div>

        {/* Footer Fixo */}
        <div className="bg-white border-t border-gray-200 p-4 flex justify-end gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors text-sm"
          >
            <Download size={18} /> Imprimir Relatório
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors text-sm shadow-md shadow-indigo-100"
          >
            Fechar
          </button>
        </div>
      </div>
      
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
};

export default InsightsViewer;
