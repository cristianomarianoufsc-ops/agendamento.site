// Arquivo: src/components/EvaluationDrawer.jsx
// VERSÃO FINAL BASEADA NO SEU CÓDIGO COMPLETO, COM A ORDEM CORRIGIDA

import React, { useState, useEffect, useRef } from 'react';
import { User, Calendar, FileText, Star, ChevronDown, Save, Edit } from 'lucide-react';

// --- COMPONENTES REUTILIZÁVEIS ---
const Section = ({ icon, title, children }) => ( <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200"> <h4 className="text-lg font-bold text-gray-800 flex items-center gap-3 mb-4 border-b pb-3">{icon}{title}</h4> <div className="space-y-3">{children}</div> </div> );
const SmartInfoRow = ({ label, value }) => { const isLink = (text) => typeof text === 'string' && (text.startsWith('http://' ) || text.startsWith('https://' )); const renderValue = () => { if (!value) return <span className="italic text-gray-400">Não informado</span>; const parts = value.split(', '); return ( <div className="flex flex-col gap-1"> {parts.map((part, index) => isLink(part) ? ( <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all"> {part.split('/').pop().split('?')[0] || part} </a> ) : <span key={index}>{part}</span>)} </div> ); }; return ( <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 py-2 border-b border-gray-100"> <div className="text-sm font-bold text-gray-600">{label}</div> <div className="col-span-2 text-sm text-gray-800">{renderValue()}</div> </div> ); };
const InfoRow = ({ label, value }) => ( <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 py-2 border-b border-gray-100"> <div className="text-sm font-bold text-gray-600">{label}</div> <div className="col-span-2 text-sm text-gray-800">{value || <span className="italic text-gray-400">Não informado</span>}</div> </div> );

// --- COMPONENTE PRINCIPAL ---
const EvaluationDrawer = ({ user, criteria, evaluatorEmail, onSaveSuccess }) => {
  const drawerRef = useRef(null);
  const evaluationSectionRef = useRef(null);

  useEffect(() => {
    // Tenta focar no topo do drawer para evitar que o scroll vá para o topo da página
    if (drawerRef.current) {
      drawerRef.current.focus();
    }
  }, [user]); // Roda quando o drawer é aberto/atualizado com um novo usuário

  // --- ESTADOS ---
  const [assessments, setAssessments] = useState({});
  const [isEditing, setIsEditing] = useState(true);
  const [hasBeenAssessed, setHasBeenAssessed] = useState(false);
  const evaluationOptions = ['Não atende ao critério', 'Atende parcialmente ao critério', 'Atende plenamente ao critério'];
  const colorMap = { 'Não atende ao critério': 'bg-red-100 text-red-800 border-red-200', 'Atende parcialmente ao critério': 'bg-yellow-100 text-yellow-800 border-yellow-200', 'Atende plenamente ao critério': 'bg-green-100 text-green-800 border-green-200', '': 'bg-white border-gray-300' };

  // Lógica do useEffect para definir o estado inicial
  // CÓDIGO CORRIGIDO (PREENCHE OS CAMPOS QUANDO JÁ AVALIADO)
  useEffect(() => {
    if (user && criteria && criteria.length > 0 && evaluatorEmail) {
      const myAssessment = user.allAssessments?.find(a => a.evaluator_email === evaluatorEmail);
      const alreadyAssessed = !!myAssessment;

      setHasBeenAssessed(alreadyAssessed);
      setIsEditing(!alreadyAssessed);

      const initialAssessments = {};
      const scoreToOptionMap = { 0: 'Não atende ao critério', 1: 'Atende parcialmente ao critério', 2: 'Atende plenamente ao critério' };
      
      if (alreadyAssessed) {
        // LÓGICA CORRIGIDA: Lê as notas salvas do JSON e preenche o estado 'initialAssessments'
        const savedScores = JSON.parse(myAssessment.scores_json);
        criteria.forEach(crit => {
          const score = savedScores[crit.id]; // Pega a nota (0, 1, ou 2) para este critério
          // Converte a nota de volta para o texto da opção e define no estado inicial
          initialAssessments[crit.id] = score !== undefined ? scoreToOptionMap[score] : '';
        });
      } else {
        // Se não foi avaliado, inicializa todos os campos como vazios
        criteria.forEach(crit => {
          initialAssessments[crit.id] = '';
        });
      }
      // Define o estado 'assessments' com os valores corretos
      setAssessments(initialAssessments);
    }
  }, [user, criteria, evaluatorEmail]);

  const handleAssessmentChange = (criterionId, value) => {
    setAssessments(prev => ({ ...prev, [criterionId]: value }));
  };

  // Lógica para salvar a avaliação
  const scrollToEvaluation = () => {
    // Usando 'block: "start"' para garantir que o elemento fique no topo da área visível
    evaluationSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const handleSaveAssessment = async () => {
    if (!criteria || criteria.length === 0) {
      alert("❌ Não há critérios de avaliação definidos.");
      return;
    }
    if (criteria.some(crit => !assessments[crit.id])) {
      alert("⚠️ Por favor, avalie todos os critérios antes de salvar.");
      return;
    }
    const scoreMap = { 'Não atende ao critério': 0, 'Atende parcialmente ao critério': 1, 'Atende plenamente ao critério': 2 };
    const scoresPayload = {};
    criteria.forEach(crit => { scoresPayload[crit.id] = scoreMap[assessments[crit.id]]; });
    const finalPayload = { inscriptionId: user.id, evaluatorEmail: evaluatorEmail, scoresJson: scoresPayload };

    try {
      const response = await fetch(`/api/save-assessment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload ),
      });
      if (response.ok) {
        alert(`✅ Avaliação salva com sucesso!`);
        // A lógica do seu backup: atualiza o estado local e notifica o pai.
        setIsEditing(false);
        setHasBeenAssessed(true);
        if (onSaveSuccess) {
          onSaveSuccess();
        }
      } else {
        const result = await response.json();
        throw new Error(result.error || 'Erro desconhecido no servidor.');
      }
    } catch (error) {
      console.error("Erro ao salvar avaliação:", error);
      alert(`❌ Falha ao salvar a avaliação. Motivo: ${error.message}`);
    }
  };

  // --- LÓGICA DE RENDERIZAÇÃO ---

  const renderAllFormsData = () => { if (!user?.formsData) { return <InfoRow label="Status Etapa 2" value="Proponente ainda não preencheu o formulário." />; } const formKeys = Object.keys(user.formsData); const keysToIgnore = ["carimbo de data/hora", "timestamp"]; return formKeys.map(key => { if (keysToIgnore.some(ignored => key.toLowerCase().includes(ignored)) || !user.formsData[key]) { return null; } return <SmartInfoRow key={key} label={key} value={user.formsData[key]} />; }); };
  const renderScheduledSteps = () => { const steps = []; if (user.ensaio_inicio) steps.push({ label: 'Ensaio', start: user.ensaio_inicio, end: user.ensaio_fim }); if (user.montagem_inicio) steps.push({ label: 'Montagem', start: user.montagem_inicio, end: user.montagem_fim }); if (user.eventos_json) JSON.parse(user.eventos_json).forEach((ev, i) => steps.push({ label: `Evento ${i + 1}`, start: ev.inicio, end: ev.fim })); if (user.desmontagem_inicio) steps.push({ label: 'Desmontagem', start: user.desmontagem_inicio, end: user.desmontagem_fim }); if (steps.length === 0) return <SmartInfoRow label="Agendamentos" value="Nenhuma etapa encontrada." />; return steps.map(step => (<SmartInfoRow key={step.label} label={step.label} value={`${new Date(step.start).toLocaleDateString('pt-BR')} das ${new Date(step.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} às ${new Date(step.end).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`} />)); };

  // Seção de Avaliação com critérios dinâmicos
  const EvaluationSection = (
    <Section icon={<Star size={22} className="text-amber-600" />} title="Avaliação de Critérios">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left text-sm font-bold text-gray-600 border border-gray-200 w-1/3">Critério</th>
              <th className="p-3 text-left text-sm font-bold text-gray-600 border border-gray-200 w-1/3">Conceituação</th>
              <th className="p-3 text-left text-sm font-bold text-gray-600 border border-gray-200 w-1/3">Avaliação</th>
            </tr>
          </thead>
          <tbody>
            {criteria && criteria.map(criterion => (
              <tr key={criterion.id} className="bg-white">
                <td className="p-3 text-sm font-semibold text-gray-800 border border-gray-200 align-top">{criterion.title}</td>
                <td className="p-3 text-sm text-gray-600 border border-gray-200 align-top">{criterion.description}</td>
                <td className="p-3 border border-gray-200 align-top">
                  <div className="relative">
                    <select
                      value={assessments[criterion.id] || ''}
                      onChange={(e) => handleAssessmentChange(criterion.id, e.target.value)}
                      disabled={!isEditing}
                      className={`w-full p-2 text-sm rounded-md shadow-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors duration-200 ${colorMap[assessments[criterion.id] || '']} ${!isEditing ? 'cursor-not-allowed' : ''}`}
                    >
                      <option value="" disabled>Selecione uma opção...</option>
                      {evaluationOptions.map(option => (<option key={option} value={option}>{option}</option>))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700"><ChevronDown size={16} /></div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-6 border-t pt-4">
        {isEditing ? (
          <button onClick={() => { handleSaveAssessment(); scrollToEvaluation(); }} className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-transform duration-200 hover:scale-[1.02]">
            <Save size={18} /> Salvar Avaliação
          </button>
        ) : (
          <button onClick={() => { setIsEditing(true); scrollToEvaluation(); }} className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-transform duration-200 hover:scale-[1.02]">
            <Edit size={18} /> Editar Avaliação
          </button>
        )}
      </div>
    </Section>
  );

  // ✅ ESTRUTURA DE RENDERIZAÇÃO DO SEU BACKUP, COM A ORDEM CORRIGIDA
  // CÓDIGO CORRIGIDO (PAINEL DE AVALIAÇÃO SEMPRE NO FINAL)
  return (
    <div ref={drawerRef} tabIndex={-1} className="bg-gray-100 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Bloco de informações sempre aparece primeiro */}
        <Section icon={<User size={22} className="text-blue-600" />} title="Informações Gerais">
          <InfoRow label="Nº da Inscrição" value={String(user.id).padStart(2, '0')} />
          <InfoRow label="Nome do Evento/Ensaio" value={user.evento_nome} />
          <InfoRow label="Nome do Responsável" value={user.nome} />
          {/* Mostra contato apenas se ainda não foi avaliado */}
          {!hasBeenAssessed && (
            <>
              <InfoRow label="Email de Contato" value={user.email} />
              <InfoRow label="Telefone de Contato" value={user.telefone} />
            </>
          )}
        </Section>
        <Section icon={<Calendar size={22} className="text-green-600" />} title="Datas e Horários Agendados">
          {renderScheduledSteps()}
        </Section>
        <Section icon={<FileText size={22} className="text-purple-600" />} title="Ficha de Inscrição Detalhada">
          {renderAllFormsData()}
        </Section>
        
        {/* Painel de avaliação SEMPRE aparece por último */}
        <div ref={evaluationSectionRef}>{EvaluationSection}</div>
      </div>
    </div>
  );

};

export default EvaluationDrawer;
