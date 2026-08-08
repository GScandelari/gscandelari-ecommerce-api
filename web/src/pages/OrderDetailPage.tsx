import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { cancelarPedido, obterPedido } from "@/api/pedidos";
import { ApiError } from "@/api/apiClient";
import { ErrorMessage } from "@/components/ErrorMessage";
import type { Pedido } from "@/types/pedido";

/**
 * RN24: detalhe de um pedido do cliente logado, com cancelamento.
 * Fase 5 (RN28/RN29): o botão de cancelar passa a aparecer também em
 * `confirmado` (cancela direto) e `enviado` (aguarda confirmação de
 * devolução antes de virar `cancelado` de verdade) - a decisão de qual dos
 * dois destinos é usada é sempre do backend, nunca replicada aqui.
 */
export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState(false);

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

  async function handleCancelar(): Promise<void> {
    if (!id) return;
    setCancelando(true);
    setError(null);
    try {
      const atualizado = await cancelarPedido(id);
      setPedido(atualizado);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro inesperado ao cancelar o pedido.");
    } finally {
      setCancelando(false);
    }
  }

  if (error && !pedido) {
    return (
      <div className="p-4">
        <ErrorMessage message={error} />
        <button
          type="button"
          onClick={() => navigate("/pedidos")}
          className="mt-3 text-sm underline"
        >
          Voltar para meus pedidos
        </button>
      </div>
    );
  }

  if (!pedido) {
    return <p className="p-4">Carregando pedido...</p>;
  }

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="mb-2 text-xl font-semibold">Pedido #{pedido.id}</h1>
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

      {["pendente", "confirmado", "enviado"].includes(pedido.status) && (
        <div className="mt-4">
          {pedido.status === "enviado" && (
            <p className="mb-2 text-sm text-gray-600">
              Como o pedido já foi enviado, cancelar aqui só marca que você quer devolvê-lo — o
              status vai para <strong>aguardando_devolucao</strong> até o Admin confirmar o
              recebimento do produto.
            </p>
          )}
          <button
            type="button"
            disabled={cancelando}
            onClick={handleCancelar}
            className="rounded border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {cancelando ? "Cancelando..." : "Cancelar pedido"}
          </button>
        </div>
      )}
    </div>
  );
}
