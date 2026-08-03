import { NextFunction, Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";

const BEARER_PREFIX = "Bearer ";

/**
 * RN18 (Decisao tecnica 2, Fase 3): valida o ID token do Google enviado por
 * outro servico interno (aqui, Payments chamando Orders). Nao usa IAM
 * Invoker como fronteira de seguranca (este mesmo Express app tambem serve
 * rotas publicas) - a validacao real e em nivel de aplicacao: assinatura,
 * `aud` = URL do proprio servico, e `email` do chamador numa allow-list.
 * Duplicado identico em Orders e Payments.
 */
export async function verifyInternalToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;

  if (!header || !header.startsWith(BEARER_PREFIX)) {
    res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Token interno ausente." } });
    return;
  }

  const token = header.slice(BEARER_PREFIX.length).trim();
  const selfUrl = process.env.SELF_BASE_URL ?? "";
  const allowedEmail = process.env.ALLOWED_CALLER_SERVICE_ACCOUNT_EMAIL ?? "";

  try {
    const client = new OAuth2Client();
    const ticket = await client.verifyIdToken({ idToken: token, audience: selfUrl });
    const payload = ticket.getPayload();

    if (!payload || payload.aud !== selfUrl || payload.email !== allowedEmail) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Token interno invalido." } });
      return;
    }

    next();
  } catch {
    res
      .status(401)
      .json({ error: { code: "UNAUTHENTICATED", message: "Token interno invalido ou expirado." } });
  }
}
