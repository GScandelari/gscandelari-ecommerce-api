import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminProductsPage } from "@/pages/AdminProductsPage";
import { request as mockRequest } from "@/test/mocks/apiClient";

vi.mock("@/api/apiClient", () => import("@/test/mocks/apiClient"));

const PRODUTO = { id: "p1", nome: "Camiseta", preco: 49.9, estoque: 10 };

// Task 17.2.6 (RN25): CRUD mockado via apiClient.
describe("AdminProductsPage", () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  it("lista os produtos e remove um apos confirmacao explicita", async () => {
    mockRequest.mockResolvedValueOnce([PRODUTO]); // GET /produtos inicial
    mockRequest.mockResolvedValueOnce(undefined); // DELETE /produtos/:id
    mockRequest.mockResolvedValueOnce([]); // GET /produtos apos remover
    const user = userEvent.setup();

    render(<AdminProductsPage />);

    await screen.findByText("Camiseta");
    await user.click(screen.getByRole("button", { name: /remover/i }));

    // Confirmacao explicita (Task 16.1.3): remover so ocorre apos confirmar no dialog.
    expect(mockRequest).not.toHaveBeenCalledWith("/produtos/p1", { method: "DELETE" });
    await user.click(screen.getByRole("button", { name: /^confirmar$/i }));

    await waitFor(() =>
      expect(mockRequest).toHaveBeenCalledWith("/produtos/p1", { method: "DELETE" }),
    );
  });

  it("bloqueia submissao invalida (preco <= 0) sem chamar a API", async () => {
    mockRequest.mockResolvedValueOnce([]);
    const user = userEvent.setup();

    render(<AdminProductsPage />);

    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: /novo produto/i }));

    await user.type(screen.getByLabelText(/nome/i), "Produto invalido");
    await user.type(screen.getByLabelText(/preço/i), "0");
    await user.type(screen.getByLabelText(/estoque/i), "5");
    await user.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByText(/preço deve ser maior que zero/i)).toBeInTheDocument();
    expect(mockRequest).toHaveBeenCalledTimes(1); // so o GET inicial, nunca o POST
  });

  it("cria um produto valido chamando POST /produtos", async () => {
    mockRequest.mockResolvedValueOnce([]); // GET inicial
    mockRequest.mockResolvedValueOnce(PRODUTO); // POST /produtos
    mockRequest.mockResolvedValueOnce([PRODUTO]); // GET apos criar
    const user = userEvent.setup();

    render(<AdminProductsPage />);

    await user.click(screen.getByRole("button", { name: /novo produto/i }));
    await user.type(screen.getByLabelText(/nome/i), "Camiseta");
    await user.type(screen.getByLabelText(/preço/i), "49.9");
    await user.type(screen.getByLabelText(/estoque/i), "10");
    await user.click(screen.getByRole("button", { name: /salvar/i }));

    await waitFor(() =>
      expect(mockRequest).toHaveBeenCalledWith("/produtos", {
        method: "POST",
        body: { nome: "Camiseta", preco: 49.9, estoque: 10 },
      }),
    );
  });
});
