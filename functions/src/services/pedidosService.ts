import { getAdminApp } from "@/firebaseAdmin";
import { ForbiddenError, NotFoundError, PaymentGatewayError, ValidationError } from "@/errors";
import { Pedido, PedidoInput, ItemPedido, PaymentStatus } from "@/models/pedido";
import { produtosCollection } from "@/repositories/produtosRepository";
import { getPedido, pedidosCollection } from "@/repositories/pedidosRepository";
import { isValidTransition, PedidoStatus } from "@/services/pedidos.statusMachine";
import { criarPaymentIntent, reembolsarPagamento } from "@/services/stripeService";

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
 * RN31 (Fase 5): unico ponto de decisao sobre o que acontece com
 * `paymentStatus` quando um pedido transiciona para `cancelado` -
 * reaproveitada em `cancelarPedidoCliente` e `alterarStatusAdmin` (os 2
 * pontos reais que escrevem `status: "cancelado"`; a transicao
 * `aguardando_devolucao -> cancelado`, RN30, passa pela mesma
 * `alterarStatusAdmin`, entao nao e um terceiro ponto de entrada). Um
 * reembolso so passa a ser devido se o pedido ja estava `pago` no momento
 * do cancelamento - nunca a partir de `aguardando_pagamento` (ainda nao ha
 * cobranca confirmada nesse caso).
 */
function determinarPaymentStatusAoCancelar(paymentStatusAtual: PaymentStatus): PaymentStatus {
  return paymentStatusAtual === "pago" ? "estorno_pendente" : paymentStatusAtual;
}

/**
 * RN05, RN07, RN07a, RN29, RN30, RN31: transicao de status disparada pelo
 * Admin.
 *
 * Restauracao de estoque ao cancelar: ocorre a partir de `pendente` (RN07a,
 * inalterado) ou de `aguardando_devolucao` (RN30, Fase 5 - o produto ja
 * retornou fisicamente). Cancelar a partir de `confirmado` continua **nao**
 * restaurando estoque quando e o Admin quem cancela (RN07a inalterado) -
 * essa extensao (RN28) e exclusiva do Cliente, ver `cancelarPedidoCliente`.
 *
 * `paymentStatus`: sempre recalculado via `determinarPaymentStatusAoCancelar`
 * quando a transicao efetivada e para `cancelado`, independente da origem
 * (RN31).
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

    const data: PedidoInput = { ...pedido, status: novoStatus, paymentStatus, updatedAt: new Date() };
    tx.set(pedidoRef, data);
    return { id: pedidoRef.id, ...data };
  });
}

/**
 * RN06, RN08, RN28, RN29: cancelamento pelo cliente dono.
 * - `pendente` ou `confirmado` -> cancela imediatamente, restaura estoque
 *   (RN06/RN28) e recalcula `paymentStatus` (RN31).
 * - `enviado` -> nao cancela direto: vai para `aguardando_devolucao`
 *   (RN29), sinalizando que o produto ainda esta fisicamente com o
 *   cliente - sem restaurar estoque nem alterar `paymentStatus` ainda.
 * - Qualquer outro status (`aguardando_devolucao`, `entregue`, `cancelado`)
 *   -> rejeitado.
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
      const data: PedidoInput = { ...pedido, status: "aguardando_devolucao", updatedAt: new Date() };
      tx.set(pedidoRef, data);
      return { id: pedidoRef.id, ...data };
    }

    throw new ValidationError(
      "So e possivel cancelar pedidos com status 'pendente', 'confirmado' ou 'enviado'.",
    );
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

/**
 * RN32 (Fase 5): solicita ao Stripe o estorno total de um pedido cancelado
 * cujo pagamento ja havia sido capturado (`paymentStatus: "estorno_pendente"`,
 * RN31) - acao dedicada, manual e exclusiva do Admin (`requireAdmin` na
 * rota), independente de qualquer transicao de `status` (o pedido ja esta
 * `cancelado`; so `paymentStatus` muda aqui).
 *
 * A chamada ao Stripe roda FORA de qualquer `db.runTransaction` (mesmo
 * principio de RN10/`criarPedidoComPagamento` - chamada de rede nao pode
 * estar dentro de uma transacao do Firestore). Em falha, `paymentStatus`
 * permanece `estorno_pendente` (nenhuma escrita), permitindo nova
 * tentativa; a resposta e um `PaymentGatewayError` (502).
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
    await reembolsarPagamento(pedido);
  } catch {
    throw new PaymentGatewayError("Nao foi possivel processar o reembolso junto ao Stripe.");
  }

  const updatedAt = new Date();
  await pedidosCollection().doc(pedidoId).update({ paymentStatus: "reembolsado", updatedAt });
  return { ...pedido, paymentStatus: "reembolsado", updatedAt };
}
