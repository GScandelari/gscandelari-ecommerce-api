import express, { Express } from "express";
import cors from "cors";
import webhooksRouter from "@/routes/webhooks.routes";
import internalRouter from "@/routes/internal.routes";
import { errorHandler } from "@/middlewares/errorHandler";

export function createApp(): Express {
  const app = express();
  app.use(cors());

  // Precisa do corpo cru para validar a assinatura do Stripe - montada
  // ANTES do express.json() global (Task 6.1.1, herdada da Fase 2).
  app.use("/webhooks", webhooksRouter);

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", env: process.env.APP_ENV ?? "unknown" });
  });

  // RN16/RN18: rota interna chamada por Orders, protegida por verifyInternalToken.
  app.use("/internal", internalRouter);

  app.use(errorHandler);

  return app;
}

const app = createApp();
export default app;
