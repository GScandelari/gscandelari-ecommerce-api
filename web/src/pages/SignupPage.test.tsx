import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SignupPage } from "@/pages/SignupPage";
import { mockSignup } from "@/test/mocks/authContext";

vi.mock("@/context/AuthContext", () => import("@/test/mocks/authContext"));

// Task 17.2.1 (RN21): cadastro de cliente, sucesso e erro (email ja em uso).
describe("SignupPage", () => {
  beforeEach(() => {
    mockSignup.mockReset();
  });

  it("chama signup com email/senha ao submeter", async () => {
    mockSignup.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/email/i), "novo@example.com");
    await user.type(screen.getByLabelText(/senha/i), "senha123");
    await user.click(screen.getByRole("button", { name: /criar conta/i }));

    await waitFor(() => expect(mockSignup).toHaveBeenCalledWith("novo@example.com", "senha123"));
  });

  it("exibe mensagem de erro quando o cadastro falha", async () => {
    mockSignup.mockRejectedValueOnce(new Error("auth/email-already-in-use"));
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/email/i), "novo@example.com");
    await user.type(screen.getByLabelText(/senha/i), "senha123");
    await user.click(screen.getByRole("button", { name: /criar conta/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
