import { NextFunction, Request, Response } from "express";
import { getAdminApp } from "@/firebaseAdmin";

const BEARER_PREFIX = "Bearer ";

/**
 * RN09: valida o Firebase ID Token do header Authorization e popula
 * req.user (uid/email/claims). Sem token ou token invalido/expirado -> 401.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;

  if (!header || !header.startsWith(BEARER_PREFIX)) {
    res
      .status(401)
      .json({ error: { code: "UNAUTHENTICATED", message: "Token de autenticacao ausente." } });
    return;
  }

  const token = header.slice(BEARER_PREFIX.length).trim();

  try {
    const decoded = await getAdminApp().auth().verifyIdToken(token);
    req.user = { uid: decoded.uid, email: decoded.email, claims: decoded };
    next();
  } catch {
    res
      .status(401)
      .json({ error: { code: "UNAUTHENTICATED", message: "Token invalido ou expirado." } });
  }
}
