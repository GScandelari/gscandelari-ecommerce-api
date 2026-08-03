import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AdminOrderDetailPage } from "@/pages/AdminOrderDetailPage";
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
    <MemoryRouter initialEntries={["/admin/pedidos/pedido-1"]}>
      <Routes>
        <Route path="/admin/pedidos/:id" element={<AdminOrderDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

// Task 17.2.6 (RN25): seletor de status restrito as transicoes validas a
// partir do status atual - RN26: a validacao real permanece no backend.
describe("AdminOrderDetailPage", () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  it("para um pedido 'enviado', o seletor so oferece 'entregue'/'cancelado'", async () => {
    mockRequest.mockResolvedValueOnce(pedido({ status: "enviado" }));

    renderDetail();

    const select = await screen.findByRole("combobox");
    const options = within(select)
      .getAllByRole("option")
      .map((option) => option.textContent);

    expect(options).toEqual(["Selecione o novo status", "entregue", "cancelado"]);
  });

  it("nao mostra seletor quando o pedido esta em estado terminal (entregue)", async () => {
    mockRequest.mockResolvedValueOnce(pedido({ status: "entregue" }));

    renderDetail();

    await screen.findByText(/pedido #pedido-1/i);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("altera o status chamando PATCH /pedidos/:id/status", async () => {
    mockRequest.mockResolvedValueOnce(pedido({ status: "pendente" }));
    mockRequest.mockResolvedValueOnce(pedido({ status: "confirmado" }));
    const user = userEvent.setup();

    renderDetail();

    const select = await screen.findByRole("combobox");
    await user.selectOptions(select, "confirmado");
    await user.click(screen.getByRole("button", { name: /alterar status/i }));

    await waitFor(() =>
      expect(mockRequest).toHaveBeenLastCalledWith("/pedidos/pedido-1/status", {
        method: "PATCH",
        body: { status: "confirmado" },
      }),
    );
  });
});
