
import React, { useMemo } from 'react';
import { Theater, Church, FileText, Trash2, Edit, User, Mail, Phone, Calendar } from 'lucide-react';

const InscricoesRecebidasNew = ({ 
  unificados, 
  loading, 
  onShowFormData,
  onDelete,
  onEdit
}) => {

  // --- PROCESSAMENTO DE DADOS (APENAS 1ª ETAPA) ---
  const dadosProcessados = useMemo(() => {
    if (!unificados) return [];
    
    // Para esta aba de "Novas Inscrições (Debug)", mostramos tudo da 1ª etapa
    // sem filtros de avaliação ou de etapa 2.
    return [...unificados].sort((a, b) => b.id - a.id); // Ordenar por ID decrescente (mais recentes primeiro)
  }, [unificados]);

  // --- FUNÇÕES AUXILIARES DE RENDERIZAÇÃO ---
  const formatarDataHora = (isoString) => {
    if (!isoString) return '';
    const date = isoString.includes('T') ? new Date(isoString) : new Date(isoString + 'T00:00:00');
    
    return date.toLocaleString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const renderAgendamentos = (u) => {
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
          etapas.push({ nome: ev.nome || `Evento ${i + 1}`, inicio: ev.inicio, fim: ev.fim });
        });
      } catch (e) {}
    }
    if (u.desmontagem_inicio) {
      etapas.push({ nome: 'Desmontagem', inicio: u.desmontagem_inicio, fim: u.desmontagem_fim });
    }

    return (
      <div className="flex flex-col gap-1 text-xs">
        {etapas.length > 0 ? etapas.map((et, idx) => (
          <div key={idx} className="bg-gray-50 p-1 rounded border border-gray-100">
            <span className="font-bold text-blue-700">{et.nome}:</span> 
            <div className="text-gray-600">
              {formatarDataHora(et.inicio)} às {new Date(et.fim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        )) : <span className="text-gray-400 italic">Nenhum agendamento</span>}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
        <p className="ml-4 text-gray-600 font-medium">Carregando dados da 1ª etapa...</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
      <table className="w-full text-sm text-left text-gray-600">
        <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
          <tr>
            <th className="px-4 py-4 w-12 text-center">ID</th>
            <th className="px-6 py-4">Informações do Evento (1ª Etapa)</th>
            <th className="px-6 py-4">Responsável / Contato</th>
            <th className="px-6 py-4">Local</th>
            <th className="px-6 py-4">Agendamentos (PDF)</th>
            <th className="px-6 py-4 text-center">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {dadosProcessados.length > 0 ? (
            dadosProcessados.map((u) => (
              <tr key={u.id} className="hover:bg-blue-50/30 transition-colors">
                <td className="px-4 py-4 text-center font-mono font-bold text-gray-400">
                  #{String(u.id).padStart(3, '0')}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-900 text-base">{u.evento_nome || 'Sem Nome'}</span>
                    <span className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                      <Calendar size={12} /> Criado em: {formatarDataHora(u.created_at || new Date().toISOString())}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-gray-700 font-medium">
                      <User size={14} className="text-gray-400" /> {u.nome}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Mail size={14} className="text-gray-400" /> {u.email}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Phone size={14} className="text-gray-400" /> {u.telefone || 'Não informado'}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${u.local === 'teatro' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-purple-100 text-purple-700 border border-purple-200'}`}>
                    {u.local === 'teatro' ? <Theater size={14} /> : <Church size={14} />}
                    {u.local === 'teatro' ? 'Teatro' : 'Igrejinha'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {renderAgendamentos(u)}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-center gap-2">
                    <button 
                      onClick={() => onShowFormData(u)}
                      className="p-2.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors border border-transparent hover:border-blue-200"
                      title="Ver Detalhes"
                    >
                      <FileText size={20} />
                    </button>
                    <button 
                      onClick={() => onEdit(u)}
                      className="p-2.5 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors border border-transparent hover:border-amber-200"
                      title="Editar"
                    >
                      <Edit size={20} />
                    </button>
                    <button 
                      onClick={() => onDelete(u.id)}
                      className="p-2.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors border border-transparent hover:border-red-200"
                      title="Excluir"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="6" className="px-6 py-20 text-center">
                <div className="flex flex-col items-center justify-center text-gray-400">
                  <FileText size={48} className="mb-2 opacity-20" />
                  <p className="italic text-lg">Nenhuma inscrição encontrada na base de dados.</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default InscricoesRecebidasNew;
