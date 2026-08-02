/**
 * Helper de teste (Task 3.1.5): limpa todas as colecoes do Firestore Emulator
 * entre casos de teste, evitando vazamento de estado (ex.: produtos/pedidos
 * criados em um teste vazando para o proximo).
 *
 * Usa o endpoint REST proprio do Firestore Emulator para apagar todos os
 * documentos do projeto de uma vez (mais rapido e simples que percorrer
 * colecao a colecao via Admin SDK).
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
