import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";

// 1. Importe TODOS os componentes que servirão como páginas
import AppVertical from "./App.jsx"; // Renomeado para clareza (Agendamento Completo)
import EnsaioPage from "./EnsaioPage.jsx"; // A NOVA PÁGINA DE ENSAIOS
import Admin from "./components/Admin.jsx";

import "./index.css";

// --- ✅ COMPONENTE DA PÁGINA INICIAL ATUALIZADO E DINÂMICO ---
const HomePage = () => {
  const [config, setConfig] = useState({
    enableInternalEdital: false,
    enableExternalEdital: true,
    enableRehearsal: true,
    buttonExternalEditalText: "Edital Externo", // NOVO CAMPO
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/config" )
      .then(res => res.json())
      .then(data => {
        setConfig(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Erro ao buscar configurações da página inicial:", err);
        setLoading(false);
      });
  }, []);

  // Componente de botão reutilizável para evitar repetição
  const ActionButton = ({ to, label, color, enabled }) => {
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
      );
    }

    return <Link to={to} style={finalStyle}>{label}</Link>;
  };

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: '5rem', fontFamily: 'sans-serif' }}>Carregando...</div>;
  }

  return (
    <div style={{ textAlign: 'center', marginTop: '5rem', fontFamily: 'sans-serif', padding: '1rem' }}>
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
      </div>
    </div>
  );
};


// 3. Defina todas as rotas da sua aplicação aqui
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
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
        <Route path="/admin" element={<Admin viewOnly={false} />} />

        {/* Rota para o painel de administração SOMENTE LEITURA */}
        <Route path="/admin-viewer" element={<Admin viewOnly={true} />} />
        
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
