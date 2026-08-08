import * as admin from "firebase-admin";

/**
 * Singleton do Admin SDK. Mesma logica usada nos testes (test/helpers/adminApp.ts
 * delega para aqui) para garantir que src/ e a suite de testes falem com o
 * mesmo app/projeto, tanto contra o emulator quanto em producao.
 */
export function getAdminApp(): admin.app.App {
  if (admin.apps.length > 0 && admin.apps[0]) {
    return admin.apps[0] as admin.app.App;
  }

  const resolvedProjectId = process.env.GCLOUD_PROJECT || "demo-gscandelari-ecommerce-api";
  console.log(
    "[DEBUG] GCLOUD_PROJECT:",
    process.env.GCLOUD_PROJECT,
    "GOOGLE_CLOUD_PROJECT:",
    process.env.GOOGLE_CLOUD_PROJECT,
    "resolvedProjectId:",
    resolvedProjectId,
  );

  return admin.initializeApp({
    projectId: resolvedProjectId,
  });
}
