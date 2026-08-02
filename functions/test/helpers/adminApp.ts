import * as admin from "firebase-admin";

/**
 * Inicializa (uma unica vez) o Admin SDK apontando para os emuladores.
 * Depende das variaveis de ambiente FIRESTORE_EMULATOR_HOST e
 * FIREBASE_AUTH_EMULATOR_HOST, que sao injetadas automaticamente pelo
 * `firebase emulators:exec` (Task 3.1.3 / script `test:emulator`).
 */
export function getAdminApp(): admin.app.App {
  if (admin.apps.length > 0 && admin.apps[0]) {
    return admin.apps[0] as admin.app.App;
  }

  return admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || "demo-gscandelari-ecommerce-api",
  });
}
