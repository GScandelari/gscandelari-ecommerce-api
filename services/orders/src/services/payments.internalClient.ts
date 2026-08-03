import { mintInternalToken } from "@/internalAuth";

export interface CriarPaymentIntentResult {
  paymentIntentId: string;
  clientSecret: string;
}

/**
 * RN16 (Decisao tecnica 3, Fase 3): cliente HTTP interno para o servico
 * Payments. Contrato deliberadamente reduzido a (pedidoId, total) - Orders
 * continua sendo o unico dono do tipo `Pedido` completo, Payments nunca
 * precisa conhece-lo.
 */
export async function criarPaymentIntent(pedidoId: string, total: number): Promise<CriarPaymentIntentResult> {
  const paymentsBaseUrl = process.env.PAYMENTS_BASE_URL;
  if (!paymentsBaseUrl) {
    throw new Error("PAYMENTS_BASE_URL nao configurada.");
  }

  const token = await mintInternalToken(paymentsBaseUrl);

  const response = await fetch(`${paymentsBaseUrl}/internal/payment-intents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ pedidoId, total }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Chamada interna a Payments falhou (HTTP ${response.status}): ${body}`);
  }

  return (await response.json()) as CriarPaymentIntentResult;
}
