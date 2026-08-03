import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { LoginPage } from "@/pages/LoginPage";
import { mockLogin } from "@/test/mocks/authContext";

vi.mock("@/context/AuthContext", () => import("@/test/mocks/authContext"));

// Task 17.2.1 (RN21): sucesso e erro de credenciais, firebase/auth mockado
// na fronteira do AuthContext (mesmo padrao de mock de fronteira usado em
// services/orders/payments na Fase 3).
describe("LoginPage", () => {
  beforeEach(() => {
    mockLogin.mockReset();
  });

  it("chama login com email/senha e navega ao suceder", async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/email/i), "cliente@example.com");
    await user.type(screen.getByLabelText(/senha/i), "senha123");
    await user.click(screen.getByRole("button", { name: /entrar/i }));

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith("cliente@example.com", "senha123"));
  });

  it("exibe mensagem de erro quando as credenciais sao invalidas", async () => {
    mockLogin.mockRejectedValueOnce(new Error("auth/invalid-credential"));
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/email/i), "cliente@example.com");
    await user.type(screen.getByLabelText(/senha/i), "senha-errada");
    await user.click(screen.getByRole("button", { name: /entrar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /nao foi possivel entrar|não foi possível entrar/i,
    );
  });
});
