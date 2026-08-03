import { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Express 4 nao propaga rejeicoes de Promise para o error handler
 * automaticamente - este wrapper faz o `.catch(next)` para todo handler
 * async, para que AppError (ou qualquer excecao) chegue ao errorHandler.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
