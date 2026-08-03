// Este import DEVE vir antes de `../../src/stripeService` para que o mock
// virtual sobre "@/stripeClient" seja registrado antes do primeiro require.
import { mockPaymentIntentsCreate, resetStripeMocks } from "../helpers/mockStripe";
// Task 8.3.2 (Modulo 8 - AINDA NAO IMPLEMENTADO): assinatura adaptada de
// `criarPaymentIntent`, eliminando a dependencia do tipo `Pedido` completo em
// Payments (Decisao tecnica 3 do BACKLOG).
import { criarPaymentIntent } from "../../src/stripeService";

describe("stripeService.criarPaymentIntent(pedidoId, total) - contrato simplificado (Decisao tecnica 3 / Task 8.3.2)", () => {
  beforeEach(() => {
    resetStripeMocks();
  });

  it("chama stripe.paymentIntents.create com amount em centavos e metadata.pedidoId, recebendo apenas pedidoId+total (sem um Pedido completo)", async () => {
    mockPaymentIntentsCreate.mockResolvedValue({ id: "pi_abc", client_secret: "pi_abc_secret" });

    const resultado = await criarPaymentIntent("pedido-123", 60);

    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 6000,
        currency: "brl",
        metadata: { pedidoId: "pedido-123" },
      }),
    );
    expect(resultado).toEqual({ paymentIntentId: "pi_abc", clientSecret: "pi_abc_secret" });
  });

  it("arredonda o total para centavos da mesma forma que a Fase 2 (Math.round(total*100))", async () => {
    mockPaymentIntentsCreate.mockResolvedValue({ id: "pi_xyz", client_secret: "pi_xyz_secret" });

    await criarPaymentIntent("pedido-999", 19.995);

    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 2000 }),
    );
  });

  it("propaga o erro do Stripe para o chamador (traduzido em PaymentGatewayError pela rota interna, RN16)", async () => {
    mockPaymentIntentsCreate.mockRejectedValue(new Error("stripe indisponivel (simulado)"));

    await expect(criarPaymentIntent("pedido-456", 10)).rejects.toThrow(
      "stripe indisponivel (simulado)",
    );
  });
});
