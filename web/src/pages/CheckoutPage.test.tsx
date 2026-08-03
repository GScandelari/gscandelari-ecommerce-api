import { useEffect, type ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { CheckoutPage } from "@/pages/CheckoutPage";
import { CartProvider, useCart } from "@/context/CartContext";
import { criarPedido } from "@/api/pedidos";
import type { Produto } from "@/types/produto";
import type { Pedido } from "@/types/pedido";

vi.mock("@/api/pedidos");
vi.mock("@/lib/stripe", () => ({ stripePromise: Promise.resolve(null) }));

const mockConfirmCardPayment = vi.fn();
const mockGetElement = vi.fn(() => ({}));

vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardElement: () => <div data-testid="card-element" />,
  useStripe: () => ({ confirmCardPayment: mockConfirmCardPayment }),
  useElements: () => ({ getElement: mockGetElement }),
}));

const PRODUTO: Produto = { id: "p1", nome: "Camiseta", preco: 49.9, estoque: 10 };

function Seed() {
  const { addItem } = useCart();
  // Roda so uma vez ao montar; `addItem` e uma nova closure a cada render
  // de CartProvider, entao incluir na dependencia causaria um loop
  // infinito de re-render.
  useEffect(() => {
    addItem(PRODUTO, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function renderCheckout() {
  return render(
    <MemoryRouter>
      <CartProvider>
        <Seed />
        <CheckoutPage />
      </CartProvider>
    </MemoryRouter>,
  );
}

// Task 17.2.4 (RN23): criarPedido mockado retornando paymentClientSecret;
// @stripe/react-stripe-js mockado confirmando que confirmCardPayment e
// chamado com o clientSecret correto.
describe("CheckoutPage - fluxo de criacao de pedido ate o pagamento", () => {
  beforeEach(() => {
    vi.mocked(criarPedido).mockReset();
    mockConfirmCardPayment.mockReset();
  });

  it("cria o pedido e chama confirmCardPayment com o clientSecret retornado", async () => {
    const pedido: Pedido = {
      id: "pedido-1",
      clienteId: "cliente-uid",
      itens: [{ produtoId: "p1", quantidade: 1, precoUnitario: 49.9 }],
      total: 49.9,
      status: "pendente",
      paymentIntentId: "pi_123",
      paymentClientSecret: "pi_123_secret_abc",
      paymentStatus: "aguardando_pagamento",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    vi.mocked(criarPedido).mockResolvedValueOnce(pedido);
    mockConfirmCardPayment.mockResolvedValueOnce({ paymentIntent: { status: "succeeded" } });

    const user = userEvent.setup();
    renderCheckout();

    await screen.findByText("Camiseta");
    await user.click(screen.getByRole("button", { name: /confirmar pedido/i }));

    await waitFor(() =>
      expect(criarPedido).toHaveBeenCalledWith({ itens: [{ produtoId: "p1", quantidade: 1 }] }),
    );

    await screen.findByTestId("card-element");
    await user.click(screen.getByRole("button", { name: /^pagar$/i }));

    await waitFor(() =>
      expect(mockConfirmCardPayment).toHaveBeenCalledWith(
        "pi_123_secret_abc",
        expect.objectContaining({ payment_method: expect.anything() }),
      ),
    );

    expect(await screen.findByText(/pagamento confirmado/i)).toBeInTheDocument();
  });

  it("exibe erro de estoque insuficiente sem limpar o carrinho", async () => {
    const { ApiError } = await import("@/api/apiClient");
    vi.mocked(criarPedido).mockRejectedValueOnce(
      new ApiError(400, "VALIDATION_ERROR", "Estoque insuficiente para o produto p1."),
    );

    const user = userEvent.setup();
    renderCheckout();

    await screen.findByText("Camiseta");
    await user.click(screen.getByRole("button", { name: /confirmar pedido/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/estoque insuficiente/i);
    expect(screen.getByText("Camiseta")).toBeInTheDocument();
  });
});
