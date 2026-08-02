import { Router } from "express";
import { authenticate } from "@/middlewares/authenticate";
import { requireAdmin } from "@/middlewares/requireAdmin";
import { validate } from "@/middlewares/validate";
import { asyncHandler } from "@/utils/asyncHandler";
import { produtoSchema } from "@/schemas/produto.schema";
import { NotFoundError } from "@/errors";
import * as produtosRepository from "@/repositories/produtosRepository";

const router = Router();

router.use(authenticate);

// Task 2.5.1 - RN01, RN07, RN09
router.post(
  "/",
  requireAdmin,
  validate(produtoSchema),
  asyncHandler(async (req, res) => {
    const produto = await produtosRepository.createProduto(req.body);
    res.status(201).json(produto);
  }),
);

// Task 2.5.2 - RN09
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const produtos = await produtosRepository.listProdutos();
    res.status(200).json(produtos);
  }),
);

// Task 2.5.3 - RN09
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const produto = await produtosRepository.getProduto(req.params.id);
    if (!produto) throw new NotFoundError("Produto nao encontrado.");
    res.status(200).json(produto);
  }),
);

// Task 2.5.4 - RN01, RN07, RN09
router.put(
  "/:id",
  requireAdmin,
  validate(produtoSchema),
  asyncHandler(async (req, res) => {
    const produto = await produtosRepository.updateProduto(req.params.id, req.body);
    if (!produto) throw new NotFoundError("Produto nao encontrado.");
    res.status(200).json(produto);
  }),
);

// Task 2.5.5 - RN07, RN09
router.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const removed = await produtosRepository.deleteProduto(req.params.id);
    if (!removed) throw new NotFoundError("Produto nao encontrado.");
    res.status(204).send();
  }),
);

export default router;
