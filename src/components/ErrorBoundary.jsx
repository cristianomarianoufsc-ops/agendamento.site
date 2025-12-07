import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('❌ ERRO CAPTURADO PELO ERROR BOUNDARY:', error);
    console.error('📍 Stack trace:', errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', backgroundColor: '#fee', color: '#c00' }}>
          <h1>❌ Erro na Aplicação</h1>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            <summary>Detalhes do erro</summary>
            <p><strong>Erro:</strong> {this.state.error && this.state.error.toString()}</p>
            <p><strong>Stack:</strong> {this.state.errorInfo && this.state.errorInfo.componentStack}</p>
          </details>
          <button onClick={() => window.location.reload()}>Recarregar Página</button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
