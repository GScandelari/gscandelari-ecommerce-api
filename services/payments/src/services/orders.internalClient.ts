import { mintInternalToken } from "@/internalAuth";

/**
 * RN17 (Decisao tecnica 3, Fase 3): cliente HTTP interno para o servico
 * Orders, chamado pelo webhook do Stripe quando um pagamento e
 * confirmado/falha. Payments nunca escreve diretamente na colecao
 * `pedidos` do Firestore - essas duas funcoes sao a UNICA forma de
 * Payments afetar o estado de um pedido.
 */

async function chamarRotaInterna(caminho: string): Promise<void> {
  const ordersBaseUrl = process.env.ORDERS_BASE_URL;
  if (!ordersBaseUrl) {
    throw new Error("ORDERS_BASE_URL nao configurada.");
  }

  const token = await mintInternalToken(ordersBaseUrl);

  const response = await fetch(`${ordersBaseUrl}${caminho}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Chamada interna a Orders falhou (HTTP ${response.status}): ${body}`);
  }
}

export async function confirmarPagamentoPedido(pedidoId: string): Promise<void> {
  await chamarRotaInterna(`/internal/pedidos/${pedidoId}/confirmar-pagamento`);
}

export async function cancelarPedidoPorFalhaPagamento(pedidoId: string): Promise<void> {
  await chamarRotaInterna(`/internal/pedidos/${pedidoId}/cancelar-por-falha-pagamento`);
}
