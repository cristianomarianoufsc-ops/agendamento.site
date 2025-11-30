// src/components/Modal.jsx

import React from 'react';
import { CheckCircle } from 'lucide-react';
import './modal.css';

// Adicionada a prop 'showDefaultButton = true'
const Modal = ({ isOpen, onClose, title, children, showDefaultButton = true }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '64px',
            width: '64px',
            borderRadius: '50%',
            backgroundColor: '#f0fdf4'
          }}>
            <CheckCircle style={{ height: '40px', width: '40px', color: '#16a34a' }} />
          </div>
        </div>
        
        <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', textAlign: 'center', marginBottom: '0.5rem' }}>
          {title}
        </h3>
        
        <div style={{ color: '#4b5563', textAlign: 'center', marginBottom: '1.5rem' }}>
          {children}
        </div>
        
        {/* O botão OK padrão só aparece se showDefaultButton for true */}
        {showDefaultButton && (
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              backgroundColor: '#2563eb',
              color: 'white',
              borderRadius: '0.5rem',
              fontWeight: 'bold',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            OK
          </button>
        )}
      </div>
    </div>
  );
};

export default Modal;
