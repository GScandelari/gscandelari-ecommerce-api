import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CatalogPage } from "@/pages/CatalogPage";
import { CartProvider } from "@/context/CartContext";
import { request as mockRequest } from "@/test/mocks/apiClient";

vi.mock("@/api/apiClient", () => import("@/test/mocks/apiClient"));

function renderCatalog() {
  return render(
    <MemoryRouter>
      <CartProvider>
        <CatalogPage />
      </CartProvider>
    </MemoryRouter>,
  );
}

// Task 17.2.3 (RN22): lista renderizada a partir do mockApiClient, incluindo
// o caso de produto sem estoque.
describe("CatalogPage", () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  it("renderiza os produtos retornados pela API", async () => {
    mockRequest.mockResolvedValueOnce([
      { id: "p1", nome: "Camiseta", preco: 49.9, estoque: 10 },
      { id: "p2", nome: "Boné", preco: 29.9, estoque: 0 },
    ]);

    renderCatalog();

    expect(await screen.findByText("Camiseta")).toBeInTheDocument();
    expect(screen.getByText("Boné")).toBeInTheDocument();
  });

  it("produto sem estoque e sinalizado e o botao de adicionar fica desabilitado", async () => {
    mockRequest.mockResolvedValueOnce([{ id: "p2", nome: "Boné", preco: 29.9, estoque: 0 }]);

    renderCatalog();

    await screen.findByText("Boné");
    expect(screen.getByText(/sem estoque/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /adicionar/i })).toBeDisabled();
  });

  it("exibe ApiError sem tela em branco quando a chamada falha", async () => {
    const { ApiError } = await import("@/test/mocks/apiClient");
    mockRequest.mockRejectedValueOnce(new ApiError(500, "INTERNAL", "Falha simulada."));

    renderCatalog();

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Falha simulada."));
  });
});
