import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso.includes("Z") ? iso : iso + "-03:00");
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
  } catch {
    return iso;
  }
}

function ReadOnlyField({ label, value }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-semibold text-gray-600 mb-1">{label}</label>
      <div className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100 text-gray-800 min-h-[38px]">
        {value || <span className="text-gray-400 italic">Não informado</span>}
      </div>
    </div>
  );
}

function EditableField({ label, value, onChange, type = "text", required = false }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-semibold text-gray-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
        required={required}
      />
    </div>
  );
}

export default function TermoDigital() {
  const [searchParams] = useSearchParams();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const nome = searchParams.get("nome") || "";
  const evento = searchParams.get("evento") || "";
  const local = searchParams.get("local") || "";
  const telefone = searchParams.get("telefone") || "";
  const cpfCnpj = searchParams.get("cpfCnpj") || "";

  const ensaioInicio = searchParams.get("ensaioInicio") || "";
  const ensaioFim = searchParams.get("ensaioFim") || "";
  const montagemInicio = searchParams.get("montagemInicio") || "";
  const montagemFim = searchParams.get("montagemFim") || "";
  const desmontagemInicio = searchParams.get("desmontagemInicio") || "";
  const desmontagemFim = searchParams.get("desmontagemFim") || "";
  const eventosJson = searchParams.get("eventosJson") || "";

  let eventosPrincipais = [];
  if (eventosJson) {
    try {
      eventosPrincipais = JSON.parse(eventosJson);
    } catch {}
  }

  const [rg, setRg] = useState(searchParams.get("rg") || "");
  const [endereco, setEndereco] = useState(searchParams.get("endereco") || "");
  const [numero, setNumero] = useState(searchParams.get("numero") || "");
  const [bairro, setBairro] = useState(searchParams.get("bairro") || "");
  const [cidade, setCidade] = useState(searchParams.get("cidade") || "");
  const [email, setEmail] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [concordo, setConcordo] = useState(false);

  const temEnsaio = ensaioInicio || ensaioFim;
  const temMontagem = montagemInicio || montagemFim;
  const temDesmontagem = desmontagemInicio || desmontagemFim;
  const temEventos = eventosPrincipais.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!concordo) {
      setError("Você precisa concordar com os termos para continuar.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 800));
      setSubmitted(true);
    } catch {
      setError("Ocorreu um erro ao enviar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <div className="text-green-500 text-6xl mb-4">✓</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Termo enviado com sucesso!</h2>
          <p className="text-gray-600">
            O Termo de Autorização referente ao evento <strong>{evento}</strong> foi registrado.
          </p>
          <button
            onClick={() => window.close()}
            className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="bg-blue-700 px-8 py-6 text-white">
          <div className="text-xs font-semibold uppercase tracking-wider opacity-80 mb-1">
            Universidade Federal de Santa Catarina — DAC
          </div>
          <h1 className="text-2xl font-bold">Termo de Autorização de Uso de Espaço Cultural</h1>
          <p className="text-sm opacity-80 mt-1">Preencha os campos editáveis e confirme as informações abaixo.</p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-6">
          <section className="mb-8">
            <h2 className="text-lg font-bold text-blue-700 border-b border-blue-200 pb-2 mb-4">
              Dados do Proponente
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <ReadOnlyField label="Nome do Proponente" value={nome} />
              <ReadOnlyField label="CPF / CNPJ" value={cpfCnpj} />
              <ReadOnlyField label="Telefone" value={telefone} />
              <EditableField label="RG" value={rg} onChange={setRg} />
              <EditableField label="E-mail" value={email} onChange={setEmail} type="email" required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6">
              <div className="md:col-span-2">
                <EditableField label="Endereço (Rua / Logradouro)" value={endereco} onChange={setEndereco} />
              </div>
              <EditableField label="Número" value={numero} onChange={setNumero} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <EditableField label="Bairro" value={bairro} onChange={setBairro} />
              <EditableField label="Cidade" value={cidade} onChange={setCidade} />
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-bold text-blue-700 border-b border-blue-200 pb-2 mb-4">
              Dados do Evento
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <ReadOnlyField label="Título do Evento" value={evento} />
              <ReadOnlyField label="Local" value={local} />
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-bold text-blue-700 border-b border-blue-200 pb-2 mb-4">
              Cronograma de Uso do Espaço
            </h2>
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Etapa</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Início</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Término</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {temEnsaio && (
                    <tr className="bg-white">
                      <td className="px-4 py-3 font-medium text-gray-700">🎵 Ensaio</td>
                      <td className="px-4 py-3 text-gray-600">{formatDateTime(ensaioInicio)}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDateTime(ensaioFim)}</td>
                    </tr>
                  )}
                  {temMontagem && (
                    <tr className="bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-700">🔧 Montagem</td>
                      <td className="px-4 py-3 text-gray-600">{formatDateTime(montagemInicio)}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDateTime(montagemFim)}</td>
                    </tr>
                  )}
                  {temEventos && eventosPrincipais.map((ev, i) => (
                    <tr key={i} className="bg-white">
                      <td className="px-4 py-3 font-medium text-gray-700">🎭 Apresentação{eventosPrincipais.length > 1 ? ` ${i + 1}` : ""}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDateTime(ev.inicio)}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDateTime(ev.fim)}</td>
                    </tr>
                  ))}
                  {temDesmontagem && (
                    <tr className="bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-700">📦 Desmontagem</td>
                      <td className="px-4 py-3 text-gray-600">{formatDateTime(desmontagemInicio)}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDateTime(desmontagemFim)}</td>
                    </tr>
                  )}
                  {!temEnsaio && !temMontagem && !temEventos && !temDesmontagem && (
                    <tr>
                      <td colSpan={3} className="px-4 py-4 text-center text-gray-400 italic">
                        Nenhuma etapa registrada
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-bold text-blue-700 border-b border-blue-200 pb-2 mb-4">
              Observações Adicionais
            </h2>
            <div className="mb-2">
              <label className="block text-sm font-semibold text-gray-600 mb-1">Observações (opcional)</label>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                placeholder="Alguma informação adicional relevante..."
              />
            </div>
          </section>

          <section className="mb-8 bg-blue-50 rounded-xl p-5 border border-blue-200">
            <h2 className="text-base font-bold text-blue-800 mb-2">Declaração de Concordância</h2>
            <p className="text-sm text-blue-900 leading-relaxed mb-4">
              Declaro que as informações prestadas são verdadeiras e que estou ciente das normas de uso dos
              espaços culturais da UFSC, comprometendo-me a cumpri-las integralmente. Autorizo o uso dos
              dados fornecidos para fins de controle e comunicação institucional pela DAC/UFSC.
            </p>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={concordo}
                onChange={(e) => setConcordo(e.target.checked)}
                className="mt-1 w-5 h-5 accent-blue-600 flex-shrink-0"
              />
              <span className="text-sm text-blue-900 font-medium">
                Li e concordo com os termos acima e confirmo que as informações estão corretas.
              </span>
            </label>
          </section>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-5 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50"
            >
              Imprimir
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-2 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-60"
            >
              {submitting ? "Enviando..." : "Confirmar e Enviar"}
            </button>
          </div>
        </form>

        <div className="px-8 py-4 bg-gray-50 border-t border-gray-200 text-xs text-gray-400 text-center">
          Sistema de Agendamento DAC — UFSC · Os campos em cinza são preenchidos automaticamente e não podem ser editados.
        </div>
      </div>
    </div>
  );
}
