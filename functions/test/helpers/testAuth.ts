import { getAdminApp } from "./adminApp";

export interface TestUser {
  uid: string;
  email: string;
  idToken: string;
  admin: boolean;
}

let counter = 0;

/**
 * Helper de teste (Task 3.1.4): cria um usuario no Auth Emulator, opcionalmente
 * com a custom claim `admin: true`, e retorna um ID token valido pronto para
 * uso no header `Authorization: Bearer` dos testes de integracao.
 */
export async function createTestUser(opts: { admin?: boolean } = {}): Promise<TestUser> {
  const auth = getAdminApp().auth();
  counter += 1;
  const email = `test-user-${Date.now()}-${counter}@example.com`;
  const password = "Senha123!";

  const userRecord = await auth.createUser({ email, password });

  if (opts.admin) {
    await auth.setCustomUserClaims(userRecord.uid, { admin: true });
  }

  const idToken = await signInAndGetIdToken(email, password);

  return { uid: userRecord.uid, email, idToken, admin: !!opts.admin };
}

async function signInAndGetIdToken(email: string, password: string): Promise<string> {
  const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || "localhost:9099";
  const apiKey = "fake-api-key"; // Auth Emulator nao valida a API key.
  const url = `http://${authEmulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Falha ao autenticar usuario de teste no Auth Emulator (${response.status}): ${body}. ` +
        "Verifique se o Auth Emulator esta rodando (npm run test:emulator)."
    );
  }

  const data = (await response.json()) as { idToken: string };
  return data.idToken;
}
