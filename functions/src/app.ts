import express, { Express } from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import produtosRouter from "@/routes/produtos.routes";
import pedidosRouter from "@/routes/pedidos.routes";
import { errorHandler } from "@/middlewares/errorHandler";
import openapiDocument from "@/openapi.json";

export function createApp(): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Sanity check de infraestrutura (Task 1.2.2 / 3.1.2 / 1.2.3). APP_ENV
  // demonstra leitura de variavel de ambiente local (ver .env.example).
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", env: process.env.APP_ENV ?? "unknown" });
  });

  // Task 2.7.2: Swagger UI de dev/emulator, sem autenticacao (sao so docs).
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiDocument));

  app.use("/produtos", produtosRouter);
  app.use("/pedidos", pedidosRouter);

  // Error handler sempre por ultimo (Task 2.4.1).
  app.use(errorHandler);

  return app;
}

const app = createApp();
export default app;
