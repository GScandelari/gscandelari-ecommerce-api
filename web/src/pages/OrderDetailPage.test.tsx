import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { OrderDetailPage } from "@/pages/OrderDetailPage";
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

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={["/pedidos/pedido-1"]}>
      <Routes>
        <Route path="/pedidos/:id" element={<OrderDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

// Task 17.2.5 (RN24): botao "Cancelar" so aparece com status `pendente`;
// cancelarPedido e disparado ao clicar e atualiza a UI sem reload manual.
describe("OrderDetailPage", () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  it("mostra o botao Cancelar quando o pedido esta pendente", async () => {
    mockRequest.mockResolvedValueOnce(pedido({ status: "pendente" }));

    renderDetail();

    expect(await screen.findByRole("button", { name: /cancelar pedido/i })).toBeInTheDocument();
  });

  it("nao mostra o botao Cancelar fora de pendente", async () => {
    mockRequest.mockResolvedValueOnce(pedido({ status: "entregue" }));

    renderDetail();

    await screen.findByText(/pedido #pedido-1/i);
    expect(screen.queryByRole("button", { name: /cancelar pedido/i })).not.toBeInTheDocument();
  });

  it("cancela o pedido e atualiza a UI sem reload", async () => {
    mockRequest.mockResolvedValueOnce(pedido({ status: "pendente" }));
    mockRequest.mockResolvedValueOnce(pedido({ status: "cancelado" }));
    const user = userEvent.setup();

    renderDetail();

    const cancelarButton = await screen.findByRole("button", { name: /cancelar pedido/i });
    await user.click(cancelarButton);

    await waitFor(() => expect(screen.getByText(/status:/i)).toHaveTextContent("cancelado"));
    expect(mockRequest).toHaveBeenLastCalledWith("/pedidos/pedido-1/cancelar", { method: "PATCH" });
  });
});
