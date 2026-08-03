import express, { Express } from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import produtosRouter from "@/routes/produtos.routes";
import pedidosRouter from "@/routes/pedidos.routes";
import internalRouter from "@/routes/internal.routes";
import { errorHandler } from "@/middlewares/errorHandler";
import openapiDocument from "@/openapi.json";

export function createApp(): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", env: process.env.APP_ENV ?? "unknown" });
  });

  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiDocument));

  app.use("/produtos", produtosRouter);
  app.use("/pedidos", pedidosRouter);

  // RN17/RN18: rotas internas chamadas por Payments, protegidas por
  // verifyInternalToken (nao por Firebase Auth).
  app.use("/internal", internalRouter);

  app.use(errorHandler);

  return app;
}

const app = createApp();
export default app;
