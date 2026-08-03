import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { alterarStatusPedido, obterPedido } from "@/api/pedidos";
import { ApiError } from "@/api/apiClient";
import { ErrorMessage } from "@/components/ErrorMessage";
import { TRANSICOES_VALIDAS, type Pedido, type PedidoStatus } from "@/types/pedido";

/**
 * RN25: seletor de novo status restrito, por UX, as transicoes
 * estruturalmente validas a partir do status atual (RN05, replicado em
 * TRANSICOES_VALIDAS so para a UI) - a validacao real permanece no backend
 * (RN26): uma chamada contornando a UI ainda seria rejeitada com 400.
 */
export function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [novoStatus, setNovoStatus] = useState<PedidoStatus | "">("");
  const [error, setError] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    obterPedido(id)
      .then((data) => {
        if (!cancelled) setPedido(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? "Não foi possível carregar este pedido."
            : "Erro inesperado ao carregar o pedido.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleAlterarStatus(): Promise<void> {
    if (!id || !novoStatus) return;
    setSalvando(true);
    setError(null);
    try {
      const atualizado = await alterarStatusPedido(id, { status: novoStatus });
      setPedido(atualizado);
      setNovoStatus("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro inesperado ao alterar o status.");
    } finally {
      setSalvando(false);
    }
  }

  if (error && !pedido) {
    return (
      <div className="p-4">
        <ErrorMessage message={error} />
        <button
          type="button"
          onClick={() => navigate("/admin/pedidos")}
          className="mt-3 text-sm underline"
        >
          Voltar para pedidos
        </button>
      </div>
    );
  }

  if (!pedido) {
    return <p className="p-4">Carregando pedido...</p>;
  }

  const opcoesValidas = TRANSICOES_VALIDAS[pedido.status];

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="mb-2 text-xl font-semibold">Pedido #{pedido.id}</h1>
      <p className="text-sm text-gray-600">Cliente: {pedido.clienteId}</p>
      <p className="text-sm text-gray-600">
        Status: <strong>{pedido.status}</strong> · Pagamento: {pedido.paymentStatus}
      </p>

      <ul className="mt-4 flex flex-col gap-1">
        {pedido.itens.map((item) => (
          <li key={item.produtoId} className="flex justify-between text-sm">
            <span>
              {item.produtoId} × {item.quantidade}
            </span>
            <span>R$ {(item.precoUnitario * item.quantidade).toFixed(2)}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-right font-semibold">Total: R$ {pedido.total.toFixed(2)}</p>

      {error && (
        <div className="mt-3">
          <ErrorMessage message={error} />
        </div>
      )}

      {opcoesValidas.length > 0 && (
        <div className="mt-4 flex items-center gap-2">
          <select
            value={novoStatus}
            onChange={(event) => setNovoStatus(event.target.value as PedidoStatus)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">Selecione o novo status</option>
            {opcoesValidas.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!novoStatus || salvando}
            onClick={handleAlterarStatus}
            className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Alterar status"}
          </button>
        </div>
      )}
    </div>
  );
}
