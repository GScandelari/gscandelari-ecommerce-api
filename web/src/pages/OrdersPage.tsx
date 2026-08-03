import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listarPedidos } from "@/api/pedidos";
import { ApiError } from "@/api/apiClient";
import { ErrorMessage } from "@/components/ErrorMessage";
import type { Pedido } from "@/types/pedido";

/** RN24: historico dos pedidos do cliente logado (filtro por cliente ja feito pelo backend, RN08). */
export function OrdersPage() {
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listarPedidos()
      .then((data) => {
        if (!cancelled) setPedidos(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Erro inesperado ao carregar pedidos.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-semibold">Meus pedidos</h1>

      {error && <ErrorMessage message={error} />}
      {!error && pedidos === null && <p>Carregando pedidos...</p>}
      {pedidos && pedidos.length === 0 && <p>Você ainda não fez nenhum pedido.</p>}

      {pedidos && pedidos.length > 0 && (
        <ul className="flex flex-col gap-2">
          {pedidos.map((pedido) => (
            <li key={pedido.id}>
              <Link
                to={`/pedidos/${pedido.id}`}
                className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 hover:bg-gray-50"
              >
                <span>Pedido #{pedido.id}</span>
                <span className="text-sm text-gray-600">
                  {pedido.status} · R$ {pedido.total.toFixed(2)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
