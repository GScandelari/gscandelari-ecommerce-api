import { Router } from "express";
import { verifyInternalToken } from "@/middlewares/verifyInternalToken";
import { asyncHandler } from "@/utils/asyncHandler";
import {
  cancelarPedidoPorFalhaPagamento,
  confirmarPagamentoPedido,
} from "@/services/pedidosService";

const router = Router();

// RN18: toda rota interna exige ID token do Google (nao Firebase Auth).
router.use(verifyInternalToken);

// RN17: chamado por Payments quando o webhook confirma pagamento.
router.post(
  "/pedidos/:id/confirmar-pagamento",
  asyncHandler(async (req, res) => {
    await confirmarPagamentoPedido(req.params.id);
    res.status(200).json({ ok: true });
  }),
);

// RN17: chamado por Payments quando o webhook reporta falha de pagamento.
router.post(
  "/pedidos/:id/cancelar-por-falha-pagamento",
  asyncHandler(async (req, res) => {
    await cancelarPedidoPorFalhaPagamento(req.params.id);
    res.status(200).json({ ok: true });
  }),
);

export default router;
