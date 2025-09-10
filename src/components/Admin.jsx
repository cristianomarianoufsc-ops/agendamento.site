import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import "./modal.css";

const Admin = () => {
  const [formLink, setFormLink] = useState("");
  const [sheetLink, setSheetLink] = useState(""); 
  const [inscricoes, setInscricoes] = useState([]);
  const [formsRespostas, setFormsRespostas] = useState([]);
  const [unificados, setUnificados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // 🔹 Carregar configs no início
  useEffect(() => {
    fetch("http://localhost:4000/api/forms-link")
      .then((res) => res.json())
      .then((data) => {
        if (data.formsLink) setFormLink(data.formsLink);
        if (data.sheetLink) setSheetLink(data.sheetLink);
      })
      .catch((err) => console.error("Erro ao carregar config:", err));
  }, []);

  // 🔹 Salvar os links no backend
  const handleSaveConfig = async () => {
    try {
      const response = await fetch("http://localhost:4000/api/forms-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formsLink: formLink, sheetLink }),
      });

      const result = await response.json();
      if (result.success) {
        alert("✅ Configuração salva com sucesso!");
      } else {
        alert("⚠️ Erro ao salvar configuração.");
      }
    } catch (error) {
      console.error("Erro ao salvar configuração:", error);
      alert("❌ Erro na comunicação com o servidor.");
    }
  };

  // 🔹 Carregar inscrições (etapa 1) e respostas (etapa 2)
  useEffect(() => {
    Promise.all([
      fetch("http://localhost:4000/api/inscricoes").then((r) => r.json()),
      fetch("http://localhost:4000/api/forms-respostas").then((r) => r.json()),
    ])
      .then(([insc, forms]) => {
        setInscricoes(insc);
        setFormsRespostas(forms.respostas);

        const unificados = insc.map((i) => {
          const matches = forms.respostas.filter((f) => {
            const emailKey = Object.keys(f).find((k) =>
              k.toLowerCase().includes("mail")
            );
            const emailForms = emailKey ? f[emailKey]?.trim().toLowerCase() : null;

            const telKey = Object.keys(f).find((k) =>
              k.toLowerCase().includes("fone")
            );
            const telefoneForms = telKey ? f[telKey]?.replace(/\D/g, "") : null;

            const emailEtapa1 = i.email?.trim().toLowerCase();
            const telefoneEtapa1 = i.telefone?.replace(/\D/g, "");

            return (
              (emailForms && emailForms === emailEtapa1) ||
              (telefoneForms && telefoneForms === telefoneEtapa1)
            );
          });

          const ultimoMatch = matches[matches.length - 1];

          const anexos = ultimoMatch
            ? Object.values(ultimoMatch).filter(
                (val) =>
                  val &&
                  typeof val === "object" &&
                  (val.fileId || val.url)
              )
            : [];

          return {
            ...i,
            anexos,
            validado: !!ultimoMatch,
            formsData: ultimoMatch,
          };
        });

        setUnificados(unificados);
      })
      .catch((err) => console.error("Erro ao carregar dados:", err))
      .finally(() => setLoading(false));
  }, []);

  const handleOpenModal = (user) => {
    setSelectedUser(user);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedUser(null);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Deseja realmente excluir esta inscrição?")) {
      try {
        await fetch(`http://localhost:4000/api/inscricoes/${id}`, {
          method: "DELETE",
        });
        setUnificados((prev) => prev.filter((x) => x.id !== id));
        alert("✅ Inscrição excluída com sucesso!");
      } catch (err) {
        alert("❌ Erro ao excluir inscrição.");
        console.error(err);
      }
    }
  };

  // 🔹 Função para baixar todos os PDFs em ZIP
  const handleDownloadAllZip = async () => {
    try {
      const response = await fetch("http://localhost:4000/api/download-all-zips");
      if (!response.ok) throw new Error("Erro no download do ZIP");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "inscricoes-completas.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error("Erro ao baixar o ZIP:", err);
      alert("❌ Falha ao baixar o ZIP. Verifique o console do servidor.");
    }
  };

  const findFormsEmail = (formData) => {
    if (!formData) return null;
    const emailKey = Object.keys(formData).find((k) =>
      k.toLowerCase().includes("mail")
    );
    return emailKey ? formData[emailKey] : null;
  };

  const findFormsPhone = (formData) => {
    if (!formData) return null;
    const telKey = Object.keys(formData).find((k) =>
      k.toLowerCase().includes("fone")
    );
    return telKey ? formData[telKey] : null;
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Painel Administrativo</h1>

      {/* 🔹 Configuração de Links */}
      <div className="mb-6">
        <label className="block font-medium">Link do Google Forms:</label>
        <input
          type="text"
          value={formLink}
          onChange={(e) => setFormLink(e.target.value)}
          className="border p-2 w-full rounded"
        />

        <label className="block font-medium mt-4">
          Link da Planilha de Respostas (Sheets):
        </label>
        <input
          type="text"
          value={sheetLink}
          onChange={(e) => setSheetLink(e.target.value)}
          className="border p-2 w-full rounded"
        />

        <button
          onClick={handleSaveConfig}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Salvar Configurações
        </button>
      </div>

      {loading ? (
        <p>Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <div className="border rounded p-4">
            <div className="mb-4">
              <button
                onClick={handleDownloadAllZip}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                ⬇️ Baixar todos os PDFs em ZIP
              </button>
              <button
                onClick={async () => {
                  if (window.confirm("⚠️ Tem certeza que deseja FORÇAR a limpeza agora? Isso apagará TODOS os anexos do Drive!")) {
                    try {
                      const res = await fetch("http://localhost:4000/api/cleanup/force", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                      });
                      const data = await res.json();

                      // 🔹 Zera a tabela na tela
                      setUnificados([]);
                      setInscricoes([]);

                      alert(`✅ Limpeza forçada concluída!\nArquivos processados: ${data.encontrados}`);
                      console.log("Resultado da limpeza forçada:", data);
                    } catch (err) {
                      alert("❌ Erro ao rodar a limpeza forçada. Veja o console.");
                      console.error("Erro na limpeza forçada:", err);
                    }
                  }
                }}
                className="ml-2 px-4 py-2 bg-red-700 text-white rounded hover:bg-red-800"
              >
                🧨 Limpar dados
              </button>
            </div>

            <h2 className="text-lg font-semibold mb-3">📋 Inscrições</h2>
            <table className="border-collapse border w-full text-sm">
              <thead className="bg-gray-200">
                <tr>
                  <th className="border px-2 py-1">#</th> {/* 🔹 Nova coluna */}
                  <th className="border px-2 py-1">Título</th>
                  <th className="border px-2 py-1">Etapas</th>
                  <th className="border px-2 py-1">Status</th>
                  <th className="border px-2 py-1">Anexos</th>
                  <th className="border px-2 py-1">Contatos</th>
                  <th className="border px-2 py-1">Ações</th>
                </tr>
              </thead>
              <tbody>
                {unificados.map((u, idx) => (
                  <tr key={idx}>
                    {/* 🔹 Numeração automática */}
                    <td className="border px-2 py-1 text-center">{idx + 1}</td>

                    <td className="border px-2 py-1">{u.evento_nome}</td>
                    <td className="border px-2 py-1">
                      <div className="text-sm leading-5">
                        {u.ensaio_inicio && (
                          <div>
                            <strong>ensaio:</strong>{" "}
                            {new Date(u.ensaio_inicio).toLocaleDateString("pt-BR")}{" "}
                            {new Date(u.ensaio_inicio).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            })}
                            -
                            {new Date(u.ensaio_fim).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            })}
                          </div>
                        )}
                        {u.montagem_inicio && (
                          <div>
                            <strong>montagem:</strong>{" "}
                            {new Date(u.montagem_inicio).toLocaleDateString("pt-BR")}{" "}
                            {new Date(u.montagem_inicio).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            })}
                            -
                            {new Date(u.montagem_fim).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            })}
                          </div>
                        )}
                        {u.eventos_json &&
                          JSON.parse(u.eventos_json).map((ev, i) => (
                            <div key={i}>
                              <strong>evento {i + 1}:</strong>{" "}
                              {new Date(ev.inicio).toLocaleDateString("pt-BR")}{" "}
                              {new Date(ev.inicio).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false,
                              })}
                              -
                              {new Date(ev.fim).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false,
                              })}
                            </div>
                          ))}
                        {u.desmontagem_inicio && (
                          <div>
                            <strong>desmontagem:</strong>{" "}
                            {new Date(u.desmontagem_inicio).toLocaleDateString("pt-BR")}{" "}
                            {new Date(u.desmontagem_inicio).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            })}
                            -
                            {new Date(u.desmontagem_fim).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            })}
                          </div>
                        )}
                      </div>
                    </td>
                    <td
                      className={`border px-2 py-1 ${
                        u.validado ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {u.validado ? "✅" : "❌"}
                    </td>
                    <td className="border px-2 py-1">
                      <ul className="list-disc ml-4 text-sm">
                        <li className="flex items-center gap-2">
                          <a
  href={`http://localhost:4000/api/gerar-pdf/${u.id}`}
  target="_blank"
  rel="noopener noreferrer"
  className="text-purple-600 hover:underline"
>
  📄 Formulário de Inscrição
</a>

                          <a
                            href={`http://localhost:4000/api/download-pdf/${u.id}`}
                            className="text-gray-500 hover:underline"
                          >
                            ⬇️ Baixar
                          </a>
                        </li>
                      </ul>

                      <button
  onClick={() =>
    window.open(`http://localhost:4000/api/download-zip/${u.id}`, "_blank")
  }
  className="mt-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
>
  ⬇️ Baixar arquivos
</button>

                    </td>
                    <td className="border px-2 py-1 text-center">
                      <button
                        onClick={() => handleOpenModal(u)}
                        className="px-4 py-1 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 text-sm"
                      >
                        Contatos
                      </button>
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <button
                        onClick={() => handleDelete(u.id)}
                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal &&
        ReactDOM.createPortal(
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="flex justify-between items-center border-b pb-2 mb-4">
                <h3 className="text-xl font-bold">
                  Contatos de {selectedUser?.nome || "Usuário"}
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-500 hover:text-gray-800 text-2xl"
                >
                  &times;
                </button>
              </div>
              <div>
                <p className="mb-2"><strong>Nome:</strong> {selectedUser?.nome}</p>
                <div className="mb-2">
                  <p><strong>Telefone(s):</strong></p>
                  <ul className="list-disc ml-6">
                    {findFormsPhone(selectedUser?.formsData) ? (
                      <li>{findFormsPhone(selectedUser.formsData)}</li>
                    ) : (
                      <li>{selectedUser?.telefone || "N/A"}</li>
                    )}
                  </ul>
                </div>
                <div>
                  <p><strong>E-mail(s):</strong></p>
                  <ul className="list-disc ml-6">
                    <li>{selectedUser?.email || "N/A (Etapa 1)"}</li>
                    {selectedUser?.formsData &&
                      findFormsEmail(selectedUser.formsData) &&
                      findFormsEmail(selectedUser.formsData).toLowerCase() !==
                        selectedUser?.email?.toLowerCase() && (
                          <li>{findFormsEmail(selectedUser.formsData) || "N/A (Forms)"}</li>
                        )}
                  </ul>
                </div>
              </div>
            </div>
          </div>,
          document.getElementById("modal-root")
        )}
    </div>
  );
};

export default Admin;
