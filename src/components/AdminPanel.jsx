// src/components/AdminPanel.jsx
import React, { useEffect, useState } from "react";

function AdminPanel() {
  const [inscricoes, setInscricoes] = useState([]);
  const [detalhes, setDetalhes] = useState(null);
  const [loading, setLoading] = useState(false);

  // Busca todas as inscrições ao carregar
  useEffect(() => {
    fetch("/admin/inscricoes")
      .then((res) => res.json())
      .then((data) => setInscricoes(data))
      .catch((err) => console.error("Erro ao buscar inscrições:", err));
  }, []);

  // Buscar detalhes de uma inscrição
  const verDetalhes = async (id) => {
    setLoading(true);
    try {
      const res = await fetch(`/admin/inscricoes/${id}`);
      const data = await res.json();
      setDetalhes({ id, ...data });
    } catch (error) {
      console.error("Erro ao buscar detalhes:", error);
    }
    setLoading(false);
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Painel do Administrador</h1>

      {/* Lista de inscrições */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Inscrições Recebidas</h2>
        {inscricoes.length === 0 ? (
          <p>Nenhuma inscrição encontrada.</p>
        ) : (
          <ul className="list-disc ml-6">
            {inscricoes.map((id) => (
              <li key={id}>
                <button
                  onClick={() => verDetalhes(id)}
                  className="text-blue-600 hover:underline cursor-pointer"
                >
                  {id}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Detalhes de uma inscrição */}
      {detalhes && (
        <div className="p-4 border rounded bg-gray-50">
          <h2 className="text-xl font-bold mb-4">Detalhes da inscrição</h2>

          {loading ? (
            <p>Carregando...</p>
          ) : (
            <>
              <pre className="bg-white p-3 rounded border text-sm overflow-x-auto">
                {JSON.stringify(detalhes.dados, null, 2)}
              </pre>

              <h3 className="text-lg font-semibold mt-4 mb-2">Arquivos enviados:</h3>
              {detalhes.arquivos.length > 0 ? (
                <ul className="list-disc ml-6">
                  {detalhes.arquivos.map((arq, idx) => (
                    <li key={idx}>
                      <a
                        href={`http://localhost:3000${arq.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {arq.nome}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Nenhum arquivo enviado.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminPanel;