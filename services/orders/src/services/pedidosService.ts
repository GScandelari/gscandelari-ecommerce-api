import { getAdminApp } from "@/firebaseAdmin";
import { ForbiddenError, NotFoundError, PaymentGatewayError, ValidationError } from "@/errors";
import { Pedido, PedidoInput, ItemPedido, PaymentStatus } from "@/models/pedido";
import { produtosCollection } from "@/repositories/produtosRepository";
import { getPedido, pedidosCollection } from "@/repositories/pedidosRepository";
import { isValidTransition, PedidoStatus } from "@/services/pedidos.statusMachine";
import { criarPaymentIntent, reembolsarPagamento } from "@/services/payments.internalClient";

export interface CriarPedidoItemInput {
  produtoId: string;
  quantidade: number;
}

interface ProdutoDoc {
  nome: string;
  preco: number;
  estoque: number;
}

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
 * RN31 (Fase 5): unico ponto de decisao sobre o que acontece com
 * `paymentStatus` quando um pedido transiciona para `cancelado` - mesma
 * replicacao 1:1 de `functions/src/services/pedidosService.ts` (Decisao
 * tecnica 4 da Fase 3).
 */
function determinarPaymentStatusAoCancelar(paymentStatusAtual: PaymentStatus): PaymentStatus {
  return paymentStatusAtual === "pago" ? "estorno_pendente" : paymentStatusAtual;
}

/**
 * RN05, RN07, RN07a, RN29, RN30, RN31: transicao de status disparada pelo
 * Admin. Ver `functions/src/services/pedidosService.ts` para o raciocinio
 * completo (identico aqui).
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

    let paymentStatus = pedido.paymentStatus;
    if (novoStatus === "cancelado") {
      if (pedido.status === "pendente" || pedido.status === "aguardando_devolucao") {
        await restaurarEstoque(tx, pedido.itens);
      }
      paymentStatus = determinarPaymentStatusAoCancelar(pedido.paymentStatus);
    }

    const data: PedidoInput = {
      ...pedido,
      status: novoStatus,
      paymentStatus,
      updatedAt: new Date(),
    };
    tx.set(pedidoRef, data);
    return { id: pedidoRef.id, ...data };
  });
}

/**
 * RN06, RN08, RN28, RN29: cancelamento pelo cliente dono. Ver
 * `functions/src/services/pedidosService.ts` para o raciocinio completo
 * (identico aqui).
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

    if (pedido.status === "pendente" || pedido.status === "confirmado") {
      await restaurarEstoque(tx, pedido.itens);
      const data: PedidoInput = {
        ...pedido,
        status: "cancelado",
        paymentStatus: determinarPaymentStatusAoCancelar(pedido.paymentStatus),
        updatedAt: new Date(),
      };
      tx.set(pedidoRef, data);
      return { id: pedidoRef.id, ...data };
    }

    if (pedido.status === "enviado") {
      const data: PedidoInput = {
        ...pedido,
        status: "aguardando_devolucao",
        updatedAt: new Date(),
      };
      tx.set(pedidoRef, data);
      return { id: pedidoRef.id, ...data };
    }

    throw new ValidationError(
      "So e possivel cancelar pedidos com status 'pendente', 'confirmado' ou 'enviado'.",
    );
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

/**
 * RN32 (Fase 5, Decisao tecnica 6): solicita o estorno via Payments (chamada
 * HTTP interna, `payments.internalClient.ts`) - Orders nunca fala com o
 * Stripe diretamente. Mesmo raciocinio de `functions/src/services/pedidosService.ts`:
 * chamada de rede sempre fora de `db.runTransaction`; falha mantem
 * `paymentStatus: "estorno_pendente"` (permite nova tentativa).
 */
export async function reembolsarPedido(pedidoId: string): Promise<Pedido> {
  const pedido = await getPedido(pedidoId);
  if (!pedido) {
    throw new NotFoundError("Pedido nao encontrado.");
  }
  if (pedido.paymentStatus !== "estorno_pendente") {
    throw new ValidationError(
      "So e possivel solicitar reembolso para pedidos com paymentStatus 'estorno_pendente'.",
    );
  }

  try {
    await reembolsarPagamento(pedido.paymentIntentId as string, Math.round(pedido.total * 100));
  } catch {
    throw new PaymentGatewayError("Nao foi possivel processar o reembolso junto ao Stripe.");
  }

  const updatedAt = new Date();
  await pedidosCollection().doc(pedidoId).update({ paymentStatus: "reembolsado", updatedAt });
  return { ...pedido, paymentStatus: "reembolsado", updatedAt };
}
