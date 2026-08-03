import { getAdminApp } from "@/firebaseAdmin";
import { ForbiddenError, NotFoundError, PaymentGatewayError, ValidationError } from "@/errors";
import { Pedido, PedidoInput, ItemPedido } from "@/models/pedido";
import { produtosCollection } from "@/repositories/produtosRepository";
import { pedidosCollection } from "@/repositories/pedidosRepository";
import { isValidTransition, PedidoStatus } from "@/services/pedidos.statusMachine";
import { criarPaymentIntent } from "@/services/stripeService";

export interface CriarPedidoItemInput {
  produtoId: string;
  quantidade: number;
}

interface ProdutoDoc {
  nome: string;
  preco: number;
  estoque: number;
}

/**
 * RN02-RN04: cria o pedido e decrementa o estoque dos produtos numa unica
 * transacao do Firestore - se qualquer item tiver estoque insuficiente (ou
 * o produto nao existir), nada e persistido (nem pedido, nem baixa de
 * estoque).
 */
export async function criarPedido(
  clienteId: string,
  itens: CriarPedidoItemInput[],
): Promise<Pedido> {
  const db = getAdminApp().firestore();
  const pedidoRef = pedidosCollection().doc();
  const produtosCol = produtosCollection();

  return db.runTransaction(async (tx) => {
    const produtoRefs = itens.map((item) => produtosCol.doc(item.produtoId));
    const produtoSnaps = await Promise.all(produtoRefs.map((ref) => tx.get(ref)));

    const itensPedido: ItemPedido[] = [];
    let total = 0;

    itens.forEach((item, i) => {
      const snap = produtoSnaps[i];
      if (!snap.exists) {
        throw new ValidationError(`Produto ${item.produtoId} nao encontrado.`);
      }
      const produto = snap.data() as ProdutoDoc;
      if (produto.estoque < item.quantidade) {
        throw new ValidationError(`Estoque insuficiente para o produto ${item.produtoId}.`);
      }
      itensPedido.push({
        produtoId: item.produtoId,
        quantidade: item.quantidade,
        precoUnitario: produto.preco,
      });
      total += produto.preco * item.quantidade;
    });

    itens.forEach((item, i) => {
      const produto = produtoSnaps[i].data() as ProdutoDoc;
      tx.update(produtoRefs[i], { estoque: produto.estoque - item.quantidade });
    });

    const now = new Date();
    const data: PedidoInput = {
      clienteId,
      itens: itensPedido,
      total,
      status: "pendente",
      // Fase 2 (Task 5.2.1): campos de pagamento nascem "vazios" na mesma
      // transacao - a PaymentIntent e criada DEPOIS, fora dela (ver
      // criarPedidoComPagamento), porque chamada de rede nao pode estar
      // dentro de db.runTransaction (pode ser reexecutada em conflito).
      paymentIntentId: null,
      paymentClientSecret: null,
      paymentStatus: "aguardando_pagamento",
      createdAt: now,
      updatedAt: now,
    };
    tx.set(pedidoRef, data);
    return { id: pedidoRef.id, ...data };
  });
}

/**
 * RN10: orquestra a criacao do pedido (transacao Firestore existente,
 * inalterada) com a criacao da PaymentIntent no Stripe (fora da
 * transacao). Em falha do Stripe, compensa cancelando o pedido ja criado
 * e restaurando o estoque, respondendo como PaymentGatewayError (502).
 */
export async function criarPedidoComPagamento(
  clienteId: string,
  itens: CriarPedidoItemInput[],
): Promise<Pedido> {
  const pedido = await criarPedido(clienteId, itens);

  try {
    const { paymentIntentId, clientSecret } = await criarPaymentIntent(pedido);
    await pedidosCollection().doc(pedido.id).update({
      paymentIntentId,
      paymentClientSecret: clientSecret,
    });
    return { ...pedido, paymentIntentId, paymentClientSecret: clientSecret };
  } catch {
    await cancelarPedidoPorFalhaPagamento(pedido.id);
    throw new PaymentGatewayError("Nao foi possivel iniciar o pagamento do pedido.");
  }
}

async function restaurarEstoque(
  tx: FirebaseFirestore.Transaction,
  itens: ItemPedido[],
): Promise<void> {
  const produtosCol = produtosCollection();
  const produtoRefs = itens.map((item) => produtosCol.doc(item.produtoId));
  const produtoSnaps = await Promise.all(produtoRefs.map((ref) => tx.get(ref)));

  produtoSnaps.forEach((snap, i) => {
    if (!snap.exists) return;
    const produto = snap.data() as ProdutoDoc;
    tx.update(produtoRefs[i], { estoque: produto.estoque + itens[i].quantidade });
  });
}

/**
 * RN05, RN07, RN07a: transicao de status disparada pelo Admin. Estoque so
 * e restaurado se o pedido estava `pendente` no momento do cancelamento.
 */
export async function alterarStatusAdmin(
  pedidoId: string,
  novoStatus: PedidoStatus,
): Promise<Pedido> {
  const db = getAdminApp().firestore();
  const pedidoRef = pedidosCollection().doc(pedidoId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(pedidoRef);
    if (!snap.exists) {
      throw new NotFoundError("Pedido nao encontrado.");
    }
    const pedido = snap.data() as PedidoInput;

    if (!isValidTransition(pedido.status, novoStatus)) {
      throw new ValidationError(`Transicao de status invalida: ${pedido.status} -> ${novoStatus}.`);
    }

    if (novoStatus === "cancelado" && pedido.status === "pendente") {
      await restaurarEstoque(tx, pedido.itens);
    }

    const data: PedidoInput = { ...pedido, status: novoStatus, updatedAt: new Date() };
    tx.set(pedidoRef, data);
    return { id: pedidoRef.id, ...data };
  });
}

/**
 * RN06, RN08: cancelamento pelo cliente dono, permitido somente enquanto o
 * pedido estiver `pendente`. Sempre restaura estoque (unica transicao de
 * cancelamento disponivel para o cliente).
 */
export async function cancelarPedidoCliente(pedidoId: string, clienteId: string): Promise<Pedido> {
  const db = getAdminApp().firestore();
  const pedidoRef = pedidosCollection().doc(pedidoId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(pedidoRef);
    if (!snap.exists) {
      throw new NotFoundError("Pedido nao encontrado.");
    }
    const pedido = snap.data() as PedidoInput;

    if (pedido.clienteId !== clienteId) {
      throw new ForbiddenError("Voce so pode cancelar os proprios pedidos.");
    }
    if (pedido.status !== "pendente") {
      throw new ValidationError("So e possivel cancelar pedidos com status 'pendente'.");
    }

    await restaurarEstoque(tx, pedido.itens);

    const data: PedidoInput = { ...pedido, status: "cancelado", updatedAt: new Date() };
    tx.set(pedidoRef, data);
    return { id: pedidoRef.id, ...data };
  });
}

/**
 * RN12: chamada pelo webhook (payment_intent.succeeded) ou pela propria
 * criacao do pedido em caso de sucesso imediato. Noop (RN15) se o pedido
 * nao existir ou nao estiver mais `pendente` - idempotente por construcao,
 * sem checagem de papel (a autorizacao do webhook e a assinatura Stripe,
 * validada na camada de rota, nao Firebase Auth).
 */
export async function confirmarPagamentoPedido(pedidoId: string): Promise<void> {
  const db = getAdminApp().firestore();
  const pedidoRef = pedidosCollection().doc(pedidoId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(pedidoRef);
    if (!snap.exists) return;
    const pedido = snap.data() as PedidoInput;
    if (pedido.status !== "pendente") return;

    const data: PedidoInput = {
      ...pedido,
      status: "confirmado",
      paymentStatus: "pago",
      updatedAt: new Date(),
    };
    tx.set(pedidoRef, data);
  });
}

/**
 * RN13: cancela por falha de pagamento e restaura estoque - reaproveitada
 * tanto pelo webhook (payment_intent.payment_failed/canceled) quanto pela
 * compensacao de criarPedidoComPagamento quando o Stripe falha na criacao.
 * Noop (RN15) se o pedido nao existir ou nao estiver mais `pendente`.
 */
export async function cancelarPedidoPorFalhaPagamento(pedidoId: string): Promise<void> {
  const db = getAdminApp().firestore();
  const pedidoRef = pedidosCollection().doc(pedidoId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(pedidoRef);
    if (!snap.exists) return;
    const pedido = snap.data() as PedidoInput;
    if (pedido.status !== "pendente") return;

    await restaurarEstoque(tx, pedido.itens);

    const data: PedidoInput = {
      ...pedido,
      status: "cancelado",
      paymentStatus: "falhou",
      updatedAt: new Date(),
    };
    tx.set(pedidoRef, data);
  });
}
