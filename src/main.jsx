import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";

// 1. Importe TODOS os componentes que servirão como páginas
import AppVertical from "./App.jsx"; // Renomeado para clareza (Agendamento Completo)
import AdminPanel from "./components/Admin.jsx"; // Importando o painel administrativo correto (DEIXADO POR COMPATIBILIDADE)
import EnsaioPage from "./EnsaioPage.jsx"; // A NOVA PÁGINA DE ENSAIOS
import Pagina from "./pages/Pagina.jsx"; // A NOVA PÁGINA COM DADOS DO CSV
import MeusComprovantes from "./pages/MeusComprovantes.jsx"; // A NOVA PÁGINA DE COMPROVANTES
import Admin from "./components/Admin.jsx"; // Este é o AppVertical com props de admin, mas o nome é confuso. Deixando para trás.
import ErrorBoundary from "./components/ErrorBoundary.jsx";

import "./index.css";

// --- ✅ COMPONENTE DA PÁGINA INICIAL ATUALIZADO E DINÂMICO ---
const HomePage = () => {
  const [config, setConfig] = useState({
    enableInternalEdital: false,
    enableExternalEdital: true,
    enableRehearsal: true,
    buttonExternalEditalText: "Edital Externo", // NOVO CAMPO
  });  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/config" )
      .then(res => res.json())
      .then(data => {
        setConfig(data);        setLoading(false);      })
      .catch(err => {
        console.error("Erro ao buscar configurações da página inicial:", err);        setLoading(false);      });  }, []);
  // Componente de botão reutilizável para evitar repetição
  const ActionButton = ({ to, label, color, enabled, external = false }) => {
    const disabledStyle = {
      background: '#9ca3af',
      boxShadow: '0 4px 14px 0 rgba(156, 163, 175, 0.39)',
      cursor: 'not-allowed'
    };

    const enabledStyle = {
      background: color,
      boxShadow: `0 4px 14px 0 rgba(${color === '#2563eb' ? '0, 118, 255' : '34, 197, 94'}, 0.39)`,
    };
    
    const finalStyle = {
      padding: '1rem 2rem',
      color: 'white',
      textDecoration: 'none',
      borderRadius: '8px',
      fontWeight: 'bold',
      width: '280px',
      transition: 'background-color 0.3s',
      ...(enabled ? enabledStyle : disabledStyle)
    };

    if (!enabled) {
      return (
        <a href="#" onClick={(e) => e.preventDefault()} style={finalStyle}>
          {label}
        </a>
      );    }

    if (external) {
      return (
        <a 
          href={to} 
          target="_blank" 
          rel="noopener noreferrer" 
          style={finalStyle}
        >
          {label}
        </a>
      );
    }

    return <Link to={to} style={finalStyle}>{label}</Link>;
  };

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: '5rem', fontFamily: 'sans-serif' }}>Carregando...</div>;
  }

  return (
    <div style={{ fontFamily: 'sans-serif' }}>
      {/* Botão de Acesso à Área Administrativa no Canto Superior Direito */}
      <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
        <a 
          href="/admin" 
          target="_blank" 
          style={{ 
            padding: '0.5rem 1rem', 
            color: '#2563eb', 
            textDecoration: 'none', 
            borderRadius: '4px', 
            fontWeight: 'bold',
            border: '1px solid #2563eb',
            transition: 'background-color 0.3s, color 0.3s'
          }}
          onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; e.currentTarget.style.color = 'white'; }}
          onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#2563eb'; }}
        >
          Área Administrativa
        </a>
      </div>

      {/* Conteúdo Principal Centralizado */}      <div style={{ textAlign: 'center', marginTop: '5rem', padding: '1rem' }}>
        <h1 style={{ fontSize: '2.5rem', color: '#333' }}>Sistema de Agendamento DAC</h1>
        <p style={{ fontSize: '1.2rem', color: '#666' }}>O que você gostaria de fazer?</p>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', marginTop: '2.5rem' }}>
        
        <ActionButton
          to="#" // Rota do edital interno, se existir
          label="Edital Interno"
          color="#2563eb"
          enabled={config.enableInternalEdital}
        />

        <ActionButton
          to="/agendamento"
          label={config.buttonExternalEditalText || "Edital Externo"}
          color="#2563eb"
          enabled={config.enableExternalEdital}
        />

        <ActionButton
          to="/ensaio"
          label="Agendar Apenas Ensaio"
          color="#16a34a"
          enabled={config.enableRehearsal}
        />

        <ActionButton
          to="/meus-comprovantes"
          label="Meus Comprovantes (PDF)"
          color="#6366f1"
          enabled={true}
          external={false}
        />
        </div>
      </div>
    </div>
  );};



// 3. Defina todas as rotas da sua aplicação aqui
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
      <Routes>
        {/* Rota principal que mostra os botões de escolha */}
        <Route path="/" element={<HomePage />} />

        {/* Rota para o agendamento completo (seu componente App.jsx original) */}
        <Route path="/agendamento" element={<AppVertical />} />
        
        {/* ROTA ADICIONADA: Rota para a página de agendamento de ensaio */}
        <Route path="/ensaio" element={<EnsaioPage />} />

        {/* ================================================================== */}
        {/* SEU ROTEAMENTO ATUAL (JÁ CORRETO)                                 */}
        {/* ================================================================== */}

        {/* Rota para o painel de administração COMPLETO */}
        <Route path="/admin" element={<Admin />} />

        {/* Rota para o painel de administração SOMENTE LEITURA (Se Admin for o AppVertical com props) */}
        <Route path="/admin-viewer" element={<Admin viewOnly={true} />} />
        
        {/* Rota para a página de visualização do CSV */}
        <Route path="/csv-data" element={<Pagina />} />
        <Route path="/meus-comprovantes" element={<MeusComprovantes />} />
        
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);