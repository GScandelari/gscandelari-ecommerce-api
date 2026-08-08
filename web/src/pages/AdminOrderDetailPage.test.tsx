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

  // Fase 5 (RN29/RN33): enviado nao vai mais direto para cancelado.
  it("para um pedido 'enviado', o seletor so oferece 'entregue'/'aguardando_devolucao'", async () => {
    mockRequest.mockResolvedValueOnce(pedido({ status: "enviado" }));

    renderDetail();

    const select = await screen.findByRole("combobox");
    const options = within(select)
      .getAllByRole("option")
      .map((option) => option.textContent);

    expect(options).toEqual(["Selecione o novo status", "entregue", "aguardando_devolucao"]);
  });

  // Fase 5 (RN30): so aguardando_devolucao->cancelado fica disponivel aqui.
  it("para um pedido 'aguardando_devolucao', o seletor so oferece 'cancelado'", async () => {
    mockRequest.mockResolvedValueOnce(pedido({ status: "aguardando_devolucao" }));

    renderDetail();

    const select = await screen.findByRole("combobox");
    const options = within(select)
      .getAllByRole("option")
      .map((option) => option.textContent);

    expect(options).toEqual(["Selecione o novo status", "cancelado"]);
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

  // Fase 5 (RN32): botao "Solicitar reembolso".
  describe("Solicitar reembolso (RN32)", () => {
    it("botao ausente quando paymentStatus nao e 'estorno_pendente'", async () => {
      mockRequest.mockResolvedValueOnce(pedido({ status: "cancelado", paymentStatus: "pago" }));

      renderDetail();

      await screen.findByText(/pedido #pedido-1/i);
      expect(
        screen.queryByRole("button", { name: /solicitar reembolso/i }),
      ).not.toBeInTheDocument();
    });

    it("botao presente e chama PATCH /pedidos/:id/reembolsar quando paymentStatus e 'estorno_pendente'", async () => {
      mockRequest.mockResolvedValueOnce(
        pedido({ status: "cancelado", paymentStatus: "estorno_pendente" }),
      );
      mockRequest.mockResolvedValueOnce(
        pedido({ status: "cancelado", paymentStatus: "reembolsado" }),
      );
      const user = userEvent.setup();

      renderDetail();

      const botao = await screen.findByRole("button", { name: /solicitar reembolso/i });
      await user.click(botao);

      await waitFor(() =>
        expect(mockRequest).toHaveBeenLastCalledWith("/pedidos/pedido-1/reembolsar", {
          method: "PATCH",
        }),
      );
      expect(await screen.findByText(/reembolsado/i)).toBeInTheDocument();
    });

    it("erro do backend (502) exibido via ErrorMessage, paymentStatus continua 'estorno_pendente'", async () => {
      const { ApiError } = await import("@/test/mocks/apiClient");
      mockRequest.mockResolvedValueOnce(
        pedido({ status: "cancelado", paymentStatus: "estorno_pendente" }),
      );
      mockRequest.mockRejectedValueOnce(
        new ApiError(502, "PAYMENT_GATEWAY_ERROR", "Falha simulada no Stripe."),
      );
      const user = userEvent.setup();

      renderDetail();

      const botao = await screen.findByRole("button", { name: /solicitar reembolso/i });
      await user.click(botao);

      expect(await screen.findByRole("alert")).toHaveTextContent(/falha simulada no stripe/i);
      expect(screen.getByRole("button", { name: /solicitar reembolso/i })).toBeInTheDocument();
    });
  });
});
