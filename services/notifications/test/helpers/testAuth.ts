import { getAdminApp } from "./adminApp";

export interface TestUser {
  uid: string;
  email: string;
  admin: boolean;
}

let counter = 0;

/**
 * Helper de teste: cria um usuario real no Auth Emulator (sem precisar de
 * ID token, ja que Notifications nao tem rotas HTTP) para que
 * `admin.auth().getUser(clienteId)` resolva um e-mail real dentro do teste
 * de `onPedidoStatusChange` - RN19 (Decisao tecnica 5 do BACKLOG).
 */
export async function createTestUser(opts: { admin?: boolean } = {}): Promise<TestUser> {
  const auth = getAdminApp().auth();
  counter += 1;
  const email = `test-user-notifications-${Date.now()}-${counter}@example.com`;

  const userRecord = await auth.createUser({ email, password: "Senha123!" });

  if (opts.admin) {
    await auth.setCustomUserClaims(userRecord.uid, { admin: true });
  }

  return { uid: userRecord.uid, email, admin: !!opts.admin };
}
