import { Router } from "express";
import { authenticate } from "@/middlewares/authenticate";
import { requireAdmin } from "@/middlewares/requireAdmin";
import { validate } from "@/middlewares/validate";
import { asyncHandler } from "@/utils/asyncHandler";
import { alterarStatusSchema, criarPedidoSchema } from "@/schemas/pedido.schema";
import { ForbiddenError, NotFoundError } from "@/errors";
import { getPedido, listPedidos } from "@/repositories/pedidosRepository";
import { alterarStatusAdmin, cancelarPedidoCliente, criarPedido } from "@/services/pedidosService";

const router = Router();

router.use(authenticate);

// Task 2.6.2 - RN02, RN03, RN04, RN09
router.post(
  "/",
  validate(criarPedidoSchema),
  asyncHandler(async (req, res) => {
    const pedido = await criarPedido(req.user!.uid, req.body.itens);
    res.status(201).json(pedido);
  }),
);

// Task 2.6.3 - RN08, RN09
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const isAdmin = Boolean(req.user!.claims?.admin);
    const pedidos = await listPedidos(isAdmin ? undefined : req.user!.uid);
    res.status(200).json(pedidos);
  }),
);

// Task 2.6.4 - RN08, RN09
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const pedido = await getPedido(req.params.id);
    if (!pedido) throw new NotFoundError("Pedido nao encontrado.");

    const isAdmin = Boolean(req.user!.claims?.admin);
    if (!isAdmin && pedido.clienteId !== req.user!.uid) {
      throw new ForbiddenError("Voce nao tem acesso a este pedido.");
    }
    res.status(200).json(pedido);
  }),
);

// Task 2.6.5 - RN05, RN07, RN07a, RN09
router.patch(
  "/:id/status",
  requireAdmin,
  validate(alterarStatusSchema),
  asyncHandler(async (req, res) => {
    const pedido = await alterarStatusAdmin(req.params.id, req.body.status);
    res.status(200).json(pedido);
  }),
);

// Task 2.6.6 - RN06, RN08, RN09
router.patch(
  "/:id/cancelar",
  asyncHandler(async (req, res) => {
    const pedido = await cancelarPedidoCliente(req.params.id, req.user!.uid);
    res.status(200).json(pedido);
  }),
);

export default router;
