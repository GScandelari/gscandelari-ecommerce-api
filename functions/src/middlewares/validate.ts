import { NextFunction, Request, Response } from "express";
import { ZodTypeAny } from "zod";
import { ValidationError } from "@/errors";

/**
 * Task 2.3.3: aplica um schema Zod a req.body. Payload invalido -> 400 via
 * errorHandler (ValidationError), com os detalhes dos campos invalidos.
 * Payload valido -> req.body e substituido pelo dado parseado/tipado.
 */
export function validate(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new ValidationError("Payload invalido.", result.error.flatten()));
      return;
    }
    req.body = result.data;
    next();
  };
}
