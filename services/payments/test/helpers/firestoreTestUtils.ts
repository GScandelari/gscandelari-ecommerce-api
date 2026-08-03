/**
 * Helper de teste (mesmo padrao da Task 3.1.5 / Fase 1, duplicado aqui):
 * limpa todas as colecoes do Firestore Emulator entre casos de teste. Em
 * Payments, usado apenas para a colecao `stripeEvents` (idempotencia,
 * RN14) - Payments nunca escreve em `pedidos` (ver adminApp.ts).
 */
export async function clearFirestoreEmulator(): Promise<void> {
  const projectId = process.env.GCLOUD_PROJECT || "demo-gscandelari-ecommerce-api";
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || "localhost:8080";
  const url = `http://${firestoreHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`;

  const response = await fetch(url, { method: "DELETE" });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Falha ao limpar o Firestore Emulator (${response.status}): ${body}. ` +
        "Verifique se o Firestore Emulator esta rodando (npm run test:emulator).",
    );
  }
}
