import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  MapPin, 
  X, 
  Printer,
  Theater,
  Church,
  Calendar
} from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

const InsightsViewer = ({ analysisData, onClose }) => {
  // Função auxiliar para pegar valor de chave independente de case
  const getVal = (obj, key) => {
    const lowerKey = key.toLowerCase();
    const foundKey = Object.keys(obj).find(k => k.toLowerCase() === lowerKey);
    return foundKey ? obj[foundKey] : null;
  };

  // --- LÓGICA DINÂMICA DE CONFLITOS (Sincronizada com Admin.jsx) ---
  const processedInscriptions = useMemo(() => {
    if (!analysisData?.inscriptions) return [];

    const inscriptions = [...analysisData.inscriptions];

    // 1. Função para extrair slots de tempo
    const getSlots = (item) => {
      const slots = [];
      const addSlot = (inicio, fim) => {
        if (inicio && fim) {
          const start = new Date(inicio);
          const end = new Date(fim);
          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            slots.push({
              id: item.id,
              local: (getVal(item, 'local') || '').toLowerCase(),
              start: start.getTime(),
              end: end.getTime(),
              dateStr: start.toISOString().substring(0, 10)
            });
          }
        }
      };

      addSlot(getVal(item, 'ensaio_inicio'), getVal(item, 'ensaio_fim'));
      addSlot(getVal(item, 'montagem_inicio'), getVal(item, 'montagem_fim'));
      addSlot(getVal(item, 'desmontagem_inicio'), getVal(item, 'desmontagem_fim'));
      
      const eventosJson = getVal(item, 'eventos_json');
      if (eventosJson) {
        try {
          const eventos = typeof eventosJson === 'string' ? JSON.parse(eventosJson) : eventosJson;
          eventos.forEach(ev => addSlot(ev.inicio, ev.fim));
        } catch (e) {}
      }
      return slots;
    };

    // 2. Coletar todos os slots
    const allSlots = inscriptions.flatMap(item => getSlots(item));

    // 3. Identificar conflitos
    const conflitos = new Map();
    inscriptions.forEach(item => conflitos.set(item.id, new Set([item.id])));

    const checkOverlap = (s1, s2) => s1.start < s2.end && s2.start < s1.end;

    for (let i = 0; i < allSlots.length; i++) {
      for (let j = i + 1; j < allSlots.length; j++) {
        const s1 = allSlots[i];
        const s2 = allSlots[j];

        if (s1.id !== s2.id && s1.local === s2.local && s1.dateStr === s2.dateStr && checkOverlap(s1, s2)) {
          const g1 = conflitos.get(s1.id);
          const g2 = conflitos.get(s2.id);
          if (g1 !== g2) {
            const newGroup = new Set([...g1, ...g2]);
            g1.forEach(id => conflitos.set(id, newGroup));
            g2.forEach(id => conflitos.set(id, newGroup));
          }
        }
      }
    }

    // 4. Marcar inscrições com conflito
    return inscriptions.map(item => ({
      ...item,
      dynamicHasConflict: conflitos.get(item.id).size > 1
    }));
  }, [analysisData]);

  const totalInscricoes = processedInscriptions.length;
  const avaliadasCount = processedInscriptions.filter(
    (i) => (getVal(i, 'finalScore') !== null && getVal(i, 'finalScore') !== undefined)
  ).length;
  
  const emConflito = processedInscriptions.filter(i => i.dynamicHasConflict).length;

  const teatroCount = processedInscriptions.filter((i) => {
    const val = (getVal(i, 'local') || '').toLowerCase();
    return val === 'teatro';
  }).length;

  const igrejinhaCount = processedInscriptions.filter((i) => {
    const val = (getVal(i, 'local') || '').toLowerCase();
    return val === 'igrejinha';
  }).length;

  const percentualAvaliadas = totalInscricoes > 0 ? ((avaliadasCount / totalInscricoes) * 100).toFixed(1) : 0;
  const emConflitoPct = totalInscricoes > 0 ? ((emConflito / totalInscricoes) * 100).toFixed(1) : 0;

  const localData = {
    labels: ['Teatro', 'Igrejinha'],
    datasets: [{
      data: [teatroCount, igrejinhaCount],
      backgroundColor: ['#4F46E5', '#9333EA'],
      borderWidth: 0,
    }],
  };

  const conflictData = {
    labels: ['Sem Conflito', 'Com Conflito'],
    datasets: [{
      data: [totalInscricoes - emConflito, emConflito],
      backgroundColor: ['#10B981', '#EF4444'],
      borderWidth: 0,
    }],
  };

  const topPropostas = [...processedInscriptions]
    .filter(i => getVal(i, 'finalScore') !== null)
    .sort((a, b) => (getVal(b, 'finalScore') || 0) - (getVal(a, 'finalScore') || 0))
    .slice(0, 5);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-gray-50 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/20">
        
        {/* Header */}
        <div className="bg-white px-8 py-6 border-b border-gray-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
              <TrendingUp size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-800 tracking-tight">Insights do Edital</h2>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Análise de Dados e Estatísticas</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          
          {/* Top Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Users size={24} /></div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase">Total</p>
                <h3 className="text-3xl font-black text-gray-800">{totalInscricoes}</h3>
                <p className="text-[10px] text-gray-500">Inscrições recebidas</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-green-50 text-green-600 rounded-xl"><CheckCircle size={24} /></div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase">Avaliadas</p>
                <h3 className="text-3xl font-black text-gray-800">{avaliadasCount}</h3>
                <p className="text-[10px] text-gray-500">{percentualAvaliadas}% do total concluído</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-red-50 text-red-600 rounded-xl"><AlertTriangle size={24} /></div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase">Conflitos</p>
                <h3 className="text-3xl font-black text-gray-800">{emConflito}</h3>
                <p className="text-[10px] text-gray-500">{emConflitoPct}% com sobreposição</p>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-6">
                <MapPin size={18} className="text-indigo-500" />
                <h4 className="font-bold text-gray-700">Distribuição por Local</h4>
              </div>
              <div className="h-48 flex items-center justify-center relative">
                <Pie data={localData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                <div className="absolute right-0 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
                    <span className="w-3 h-3 rounded-full bg-indigo-600"></span> Teatro: {teatroCount}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
                    <span className="w-3 h-3 rounded-full bg-purple-600"></span> Igrejinha: {igrejinhaCount}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-6">
                <AlertTriangle size={18} className="text-red-500" />
                <h4 className="font-bold text-gray-700">Análise de Conflitos</h4>
              </div>
              <div className="h-48 flex items-center justify-center relative">
                <Pie data={conflictData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                <div className="absolute right-0 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
                    <span className="w-3 h-3 rounded-full bg-green-500"></span> Sem Conflito: {totalInscricoes - emConflito}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
                    <span className="w-3 h-3 rounded-full bg-red-500"></span> Com Conflito: {emConflito}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Ranking */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp size={18} className="text-indigo-500" />
              <h4 className="font-bold text-gray-700">Top 5 Propostas (Melhores Notas)</h4>
            </div>
            <div className="space-y-4">
              {topPropostas.length > 0 ? topPropostas.map((p, idx) => (
                <div key={p.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-indigo-200 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${
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

          {/* System Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-indigo-600 p-6 rounded-2xl text-white shadow-lg shadow-indigo-200">
              <div className="flex items-center gap-3 mb-4">
                <Users size={20} className="text-indigo-200" />
                <h4 className="font-bold">Avaliadores</h4>
              </div>
              <p className="text-3xl font-black">{analysisData.totalEvaluators || 0}</p>
              <p className="text-xs text-indigo-100 mt-1">Membros autorizados no sistema</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <Calendar size={20} className="text-indigo-500" />
                <h4 className="font-bold text-gray-700">Critérios</h4>
              </div>
              <p className="text-3xl font-black text-gray-800">{analysisData.criteria?.length || 0}</p>
              <p className="text-xs text-gray-400 mt-1">Parâmetros de avaliação ativos</p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-white px-8 py-6 border-t border-gray-100 flex justify-between items-center">
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm transition-all"
          >
            <Printer size={18} /> Imprimir Relatório
          </button>
          <button 
            onClick={onClose}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 transition-all"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default InsightsViewer;
