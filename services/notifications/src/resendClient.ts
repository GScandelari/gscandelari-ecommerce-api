import { Resend } from "resend";

let client: Resend | undefined;

/**
 * Singleton do SDK do Resend (mesmo padrao de stripeClient.ts/firebaseAdmin.ts).
 * Sempre usado em modo sandbox/teste neste projeto.
 */
export function getResendClient(): Resend {
  if (!client) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY nao configurada.");
    }
    client = new Resend(apiKey);
  }
  return client;
}
