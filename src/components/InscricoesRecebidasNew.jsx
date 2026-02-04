
import React, { useMemo } from 'react';
import { Theater, Church, FileText, CheckCircle, FileClock, Trash2, Edit, Eye } from 'lucide-react';

const InscricoesRecebidasNew = ({ 
  unificados, 
  loading, 
  inscricoesTab, 
  localFilters, 
  sortOrder, 
  assessmentFilter, 
  viewOnly, 
  evaluatorEmail,
  onShowFormData,
  onDelete,
  onEdit,
  onEvaluate
}) => {

  // --- NOVA LÓGICA DE PROCESSAMENTO DE DADOS ---
  const dadosProcessados = useMemo(() => {
    if (!unificados) return [];

    // 1. Filtragem Básica
    let filtrados = unificados.filter(item => {
      // Filtro de Local
      const passaLocal = (localFilters.teatro && item.local === 'teatro') || 
                         (localFilters.igrejinha && item.local === 'igrejinha');
      if (!passaLocal) return false;

      // Filtro de Tipo (Evento vs Ensaio)
      // No sistema original, 'eventos' inclui montagem/desmontagem ou eventos_json preenchido
      // Se não houver nenhum dado de agendamento, ainda assim queremos mostrar na aba de eventos se for uma inscrição válida
      const temEvento = (item.eventos_json && item.eventos_json !== '[]') || 
                        item.montagem_inicio || 
                        item.desmontagem_inicio ||
                        item.ensaio_inicio ||
                        item.evento_nome; // Se tem nome de evento, é um evento
      
      const tipoCorreto = (inscricoesTab === 'eventos') ? temEvento : !temEvento;
      if (!tipoCorreto) return false;

      // Filtro de Avaliação
      if (assessmentFilter !== 'todos') {
        const isFullyAssessed = item.assessmentsCount >= (item.requiredAssessments || 3);
        if (viewOnly) {
          const assessedByMe = item.evaluatorsWhoAssessed?.includes(evaluatorEmail);
          return assessmentFilter === 'avaliados' ? assessedByMe : !assessedByMe;
        } else {
          return assessmentFilter === 'avaliados' ? isFullyAssessed : !isFullyAssessed;
        }
      }

      return true;
    });

    // 2. Ordenação
    return filtrados.sort((a, b) => {
      switch (sortOrder) {
        case 'nota_desc': return (b.finalScore ?? -1) - (a.finalScore ?? -1);
        case 'nota_asc': return (a.finalScore ?? 999) - (b.finalScore ?? 999);
        case 'id_asc': default: return a.id - b.id;
      }
    });
  }, [unificados, inscricoesTab, localFilters, sortOrder, assessmentFilter, viewOnly, evaluatorEmail]);

  // --- FUNÇÕES AUXILIARES DE RENDERIZAÇÃO ---
  const formatarDataHora = (isoString) => {
    if (!isoString) return '';
    // Adiciona o fuso horário se não houver, para evitar problemas de data mudando por causa do UTC
    const date = isoString.includes('T') ? new Date(isoString) : new Date(isoString + 'T00:00:00');
    
    return date.toLocaleString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const renderEtapas = (u) => {
    const etapas = [];
    if (u.ensaio_inicio) {
      etapas.push({ nome: 'Ensaio', inicio: u.ensaio_inicio, fim: u.ensaio_fim });
    }
    if (u.montagem_inicio) {
      etapas.push({ nome: 'Montagem', inicio: u.montagem_inicio, fim: u.montagem_fim });
    }
    if (u.eventos_json) {
      try {
        const evs = JSON.parse(u.eventos_json);
        evs.forEach((ev, i) => {
          // Evita duplicar se já estiver nas colunas fixas (opcional, mas bom para clareza)
          etapas.push({ nome: ev.nome || `Evento ${i + 1}`, inicio: ev.inicio, fim: ev.fim });
        });
      } catch (e) {}
    }
    if (u.desmontagem_inicio) {
      etapas.push({ nome: 'Desmontagem', inicio: u.desmontagem_inicio, fim: u.desmontagem_fim });
    }

    // Remover duplicatas baseadas em nome e início (caso o JSON tenha o que já está nas colunas)
    const etapasUnicas = etapas.reduce((acc, current) => {
      const x = acc.find(item => item.nome === current.nome && item.inicio === current.inicio);
      if (!x) return acc.concat([current]);
      else return acc;
    }, []);

    return (
      <div className="flex flex-col gap-1 text-xs">
        {etapasUnicas.length > 0 ? etapasUnicas.map((et, idx) => (
          <div key={idx} className="whitespace-nowrap">
            <span className="font-bold">{et.nome}:</span> {formatarDataHora(et.inicio)} - {new Date(et.fim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )) : <span className="text-gray-400 italic">Sem etapas registradas</span>}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
        <p className="ml-4 text-gray-600 font-medium">Carregando inscrições...</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow">
      <table className="w-full text-sm text-left text-gray-600">
        <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-b">
          <tr>
            <th className="px-4 py-3 w-12">#</th>
            <th className="px-6 py-3">Evento / Proponente</th>
            <th className="px-6 py-3">Local</th>
            <th className="px-6 py-3">Etapas Agendadas</th>
            {!viewOnly && <th className="px-6 py-3 text-center">Nota</th>}
            <th className="px-6 py-3 text-center">Status</th>
            <th className="px-6 py-3 text-center">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {dadosProcessados.length > 0 ? (
            dadosProcessados.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-4 font-medium text-gray-900">{String(u.id).padStart(2, '0')}</td>
                <td className="px-6 py-4">
                  <div className="font-bold text-gray-800">{u.evento_nome || 'Sem Nome'}</div>
                  <div className="text-xs text-gray-500">{u.nome}</div>
                  <div className="text-[10px] text-gray-400">{u.email}</div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${u.local === 'teatro' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                    {u.local === 'teatro' ? <Theater size={12} /> : <Church size={12} />}
                    {u.local === 'teatro' ? 'Teatro' : 'Igrejinha'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {renderEtapas(u)}
                </td>
                {!viewOnly && (
                  <td className="px-6 py-4 text-center font-bold text-lg text-gray-700">
                    {u.assessmentsCount >= (u.requiredAssessments || 3) ? u.finalScore?.toFixed(2) : '-'}
                  </td>
                )}
                <td className="px-6 py-4 text-center">
                  {u.assessmentsCount >= (u.requiredAssessments || 3) ? (
                    <div className="flex flex-col items-center text-green-600">
                      <CheckCircle size={20} />
                      <span className="text-[10px] font-bold">Concluído</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-amber-500">
                      <FileClock size={20} />
                      <span className="text-[10px] font-bold">{u.assessmentsCount || 0}/{u.requiredAssessments || 3}</span>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-center gap-2">
                    <button 
                      onClick={() => onShowFormData(u)}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                      title="Ver Ficha Detalhada"
                    >
                      <FileText size={18} />
                    </button>
                    
                    {viewOnly ? (
                      <button 
                        onClick={() => onEvaluate(u)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-full transition-colors"
                        title="Avaliar"
                      >
                        <Edit size={18} />
                      </button>
                    ) : (
                      <>
                        <button 
                          onClick={() => onEdit(u)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                          title="Editar"
                        >
                          <Edit size={18} />
                        </button>
                        <button 
                          onClick={() => onDelete(u.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="7" className="px-6 py-10 text-center text-gray-500 italic">
                Nenhuma inscrição encontrada para os filtros selecionados.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default InscricoesRecebidasNew;
