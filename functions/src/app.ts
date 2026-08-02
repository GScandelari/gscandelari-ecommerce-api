import express, { Express } from "express";
import cors from "cors";

/**
 * App Express minimo, exportado para uso via Supertest (Task 3.1.2) e via
 * Cloud Function HTTPS 2a geracao (src/index.ts).
 *
 * IMPORTANTE: este arquivo e infraestrutura de teste (bootstrap minimo),
 * criado pelo agente qa-negocio apenas para permitir que os testes de
 * integracao (Supertest) tenham um app importavel. As rotas de negocio
 * (/produtos, /pedidos, middlewares de auth, tratamento de erro, etc.)
 * pertencem ao Modulo 2 (Core Business) do BACKLOG.md e AINDA NAO EXISTEM.
 *
 * Por isso, qualquer requisicao a /produtos ou /pedidos hoje retorna 404
 * (comportamento padrao do Express para rota nao registrada) - esse e o
 * estado "vermelho" esperado em TDD ate a implementacao do Modulo 2.
 */
export function createApp(): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Sanity check de infraestrutura (Task 1.2.2 / 3.1.2 / 1.2.3) - unica rota
  // implementada neste estagio de bootstrap. APP_ENV demonstra leitura de
  // variavel de ambiente local (ver functions/.env.example).
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", env: process.env.APP_ENV ?? "unknown" });
  });

  // NAO adicionar rotas de negocio aqui. Ver Modulo 2 do BACKLOG.md:
  //   app.use("/produtos", produtosRouter);
  //   app.use("/pedidos", pedidosRouter);
  //   app.use(errorHandler);

  return app;
}

const app = createApp();
export default app;
