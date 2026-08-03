import { NextFunction, Request, Response } from "express";

/**
 * Mocka a FRONTEIRA `@/middlewares/verifyInternalToken` diretamente, em vez
 * de mockar o pacote `google-auth-library` inteiro (como faz
 * `mockGoogleAuthLibrary.ts`, usado pelos testes unitarios de
 * verifyInternalToken/mintInternalToken).
 *
 * Motivo: mockar `google-auth-library` no nivel do pacote afeta TODO o
 * modulo dentro do mesmo arquivo de teste - inclusive o uso interno que o
 * Admin SDK do Firestore faz dele (via google-gax) para autenticar contra o
 * emulator. Testes de integracao como `internalRoutes.test.ts`, que
 * exercitam Firestore real (via `pedidosService`) E as rotas internas no
 * mesmo arquivo, quebram com erros como
 * "this.auth.getUniverseDomain is not a function" se usarem o mock global.
 * A logica de verificacao do token do Google em si ja e coberta
 * isoladamente por `test/unit/verifyInternalToken.test.ts` (sem Firestore
 * no mesmo arquivo, onde mockar o pacote inteiro e seguro).
 */

let tokenValido = false;

export function setInternalTokenValido(valor: boolean): void {
  tokenValido = valor;
}

export function resetMockVerifyInternalToken(): void {
  tokenValido = false;
}

jest.mock(
  "@/middlewares/verifyInternalToken",
  () => ({
    verifyInternalToken: (req: Request, res: Response, next: NextFunction) => {
      const header = req.headers.authorization;
      if (!header || !header.startsWith("Bearer ")) {
        res
          .status(401)
          .json({ error: { code: "UNAUTHENTICATED", message: "Token interno ausente." } });
        return;
      }
      if (!tokenValido) {
        res
          .status(401)
          .json({ error: { code: "UNAUTHENTICATED", message: "Token interno invalido." } });
        return;
      }
      next();
    },
  }),
  { virtual: true },
);
