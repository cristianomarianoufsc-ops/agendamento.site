
import React from 'react';

// Conteúdo do CSV do Google Sheets (ID: 1Fh8G2vQ1Tu4_qXghW6q5X2noxvUAuJA0m70pAwxka-s)
// Os dados agora são buscados dinamicamente do backend.

const Pagina = () => {
  const [csvData, setCsvData] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/forms-data');
        if (!response.ok) {
          throw new Error(`Erro HTTP: ${response.status}`);
        }
        const data = await response.json();
        setCsvData(data);
      } catch (err) {
        console.error("Erro ao buscar dados do Forms:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', textAlign: 'center' }}>
        <h1>Carregando Dados do Google Sheets...</h1>
        <p>Isso pode levar alguns segundos.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', textAlign: 'center', color: 'red' }}>
        <h1>Erro ao Carregar Dados</h1>
        <p>Ocorreu um erro ao tentar buscar os dados do Forms/Sheets: <strong>{error}</strong></p>
        <p>Verifique se o ID da planilha está configurado corretamente no Admin e se a conta de serviço tem permissão de leitura.</p>
      </div>
    );
  }

  // Restante do componente de renderização
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
        Dados do Google Sheets (Dinâmico)
      </h1>
      <p style={{ marginBottom: '20px', color: '#555' }}>
        Total de Registros Encontrados: <strong>{csvData.length}</strong>
      </p>
      
      {csvData.map((row, rowIndex) => (
        <div 
          key={rowIndex} 
          style={{ 
            border: '1px solid #ccc', 
            borderRadius: '8px', 
            margin: '15px 0', 
            padding: '15px', 
            backgroundColor: rowIndex % 2 === 0 ? '#f9f9f9' : '#fff' 
          }}
        >
          <h2 style={{ marginTop: '0', fontSize: '1.2em', color: '#333' }}>
            Registro #{rowIndex + 1}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '10px' }}>
            {Object.entries(row).map(([key, value]) => (
              <p key={key} style={{ margin: '5px 0', wordBreak: 'break-word' }}>
                <strong style={{ color: '#000' }}>{key}:</strong> {value || 'N/A'}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Pagina;



