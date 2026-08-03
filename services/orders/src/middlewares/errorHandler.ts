import { NextFunction, Request, Response } from "express";
import { AppError } from "@/errors";

/**
 * Task 2.4.1: middleware de erro global do Express. Precisa manter os 4
 * parametros (mesmo sem usar todos) para o Express reconhece-lo como error
 * handler. Nunca vaza stack trace na resposta.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  console.error(err);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor." } });
}
