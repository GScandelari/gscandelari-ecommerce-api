import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listarPedidos } from "@/api/pedidos";
import { ApiError } from "@/api/apiClient";
import { ErrorMessage } from "@/components/ErrorMessage";
import type { Pedido } from "@/types/pedido";

/** RN25: lista todos os pedidos - o backend ja retorna todos para admin (RN08). */
export function AdminOrdersPage() {
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listarPedidos()
      .then(setPedidos)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Erro inesperado ao carregar pedidos.");
      });
  }, []);

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-semibold">Admin · Pedidos</h1>

      {error && <ErrorMessage message={error} />}
      {pedidos === null && !error && <p>Carregando pedidos...</p>}
      {pedidos && pedidos.length === 0 && <p>Nenhum pedido registrado ainda.</p>}

      {pedidos && pedidos.length > 0 && (
        <ul className="flex flex-col gap-2">
          {pedidos.map((pedido) => (
            <li key={pedido.id}>
              <Link
                to={`/admin/pedidos/${pedido.id}`}
                className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 hover:bg-gray-50"
              >
                <span>
                  Pedido #{pedido.id} · cliente {pedido.clienteId}
                </span>
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
