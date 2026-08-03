import { GoogleAuth } from "google-auth-library";

/**
 * RN18 (Decisao tecnica 2, Fase 3): emite um ID token do Google para o
 * `audience` informado, usando a identidade da service account de runtime
 * da propria Cloud Function (via metadata server do GCP - nada de chaves
 * gerenciadas manualmente). Duplicado identico em Orders e Payments (os
 * unicos 2 servicos que se chamam mutuamente).
 */
export async function mintInternalToken(audience: string): Promise<string> {
  const auth = new GoogleAuth();
  const client = await auth.getIdTokenClient(audience);
  return client.idTokenProvider.fetchIdToken(audience);
}
