import { NextFunction, Request, Response } from "express";

/**
 * RN07/RN09: exige a custom claim `admin: true`. Deve rodar depois de
 * `authenticate` (depende de req.user ja estar populado).
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.claims?.admin) {
    res
      .status(403)
      .json({ error: { code: "FORBIDDEN", message: "Requer privilegios de administrador." } });
    return;
  }
  next();
}
