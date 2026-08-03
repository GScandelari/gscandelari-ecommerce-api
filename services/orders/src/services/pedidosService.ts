import { getAdminApp } from "@/firebaseAdmin";
import { ForbiddenError, NotFoundError, PaymentGatewayError, ValidationError } from "@/errors";
import { Pedido, PedidoInput, ItemPedido } from "@/models/pedido";
import { produtosCollection } from "@/repositories/produtosRepository";
import { pedidosCollection } from "@/repositories/pedidosRepository";
import { isValidTransition, PedidoStatus } from "@/services/pedidos.statusMachine";
import { criarPaymentIntent } from "@/services/payments.internalClient";

export interface CriarPedidoItemInput {
  produtoId: string;
  quantidade: number;
}

interface ProdutoDoc {
  nome: string;
  preco: number;
  estoque: number;
}

export async function criarPedido(clienteId: string, itens: CriarPedidoItemInput[]): Promise<Pedido> {
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
 * RN16: orquestra a criacao do pedido (transacao Firestore existente,
 * inalterada) com a criacao da PaymentIntent via chamada HTTP interna ao
 * servico Payments (RN18). Em falha, compensa cancelando o pedido ja criado
 * e restaurando o estoque, respondendo como PaymentGatewayError (502) - o
 * contrato observavel pro cliente final e identico ao da Fase 2.
 */
export async function criarPedidoComPagamento(
  clienteId: string,
  itens: CriarPedidoItemInput[],
): Promise<Pedido> {
  const pedido = await criarPedido(clienteId, itens);

  try {
    const { paymentIntentId, clientSecret } = await criarPaymentIntent(pedido.id, pedido.total);
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

async function restaurarEstoque(tx: FirebaseFirestore.Transaction, itens: ItemPedido[]): Promise<void> {
  const produtosCol = produtosCollection();
  const produtoRefs = itens.map((item) => produtosCol.doc(item.produtoId));
  const produtoSnaps = await Promise.all(produtoRefs.map((ref) => tx.get(ref)));

  produtoSnaps.forEach((snap, i) => {
    if (!snap.exists) return;
    const produto = snap.data() as ProdutoDoc;
    tx.update(produtoRefs[i], { estoque: produto.estoque + itens[i].quantidade });
  });
}

export async function alterarStatusAdmin(pedidoId: string, novoStatus: PedidoStatus): Promise<Pedido> {
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
 * RN17 (chamada pela rota interna, disparada por Payments): confirma
 * pagamento. Noop (RN15) se o pedido nao existir ou nao estiver `pendente`.
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
 * RN17 (chamada pela rota interna, disparada por Payments, ou pela
 * compensacao de criarPedidoComPagamento): cancela por falha de pagamento e
 * restaura estoque. Noop (RN15) se o pedido nao existir ou nao estiver
 * `pendente`.
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
