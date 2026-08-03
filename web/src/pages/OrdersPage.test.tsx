import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { OrdersPage } from "@/pages/OrdersPage";
import { request as mockRequest } from "@/test/mocks/apiClient";
import type { Pedido } from "@/types/pedido";

vi.mock("@/api/apiClient", () => import("@/test/mocks/apiClient"));

function pedido(overrides: Partial<Pedido>): Pedido {
  return {
    id: "pedido-1",
    clienteId: "cliente-uid",
    itens: [{ produtoId: "p1", quantidade: 1, precoUnitario: 10 }],
    total: 10,
    status: "pendente",
    paymentIntentId: null,
    paymentClientSecret: null,
    paymentStatus: "aguardando_pagamento",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Task 17.2.5 (RN24): lista renderizada; botao "Cancelar" ausente fora de
// `pendente`; cancelarPedido disparado ao clicar (coberto em OrderDetailPage).
describe("OrdersPage", () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  it("renderiza a lista de pedidos retornada pela API", async () => {
    mockRequest.mockResolvedValueOnce([
      pedido({ id: "pedido-1", status: "pendente" }),
      pedido({ id: "pedido-2", status: "entregue" }),
    ]);

    render(
      <MemoryRouter>
        <OrdersPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/pedido #pedido-1/i)).toBeInTheDocument();
    expect(screen.getByText(/pedido #pedido-2/i)).toBeInTheDocument();
  });

  it("mostra mensagem quando nao ha pedidos", async () => {
    mockRequest.mockResolvedValueOnce([]);

    render(
      <MemoryRouter>
        <OrdersPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/ainda não fez nenhum pedido/i)).toBeInTheDocument();
  });
});
