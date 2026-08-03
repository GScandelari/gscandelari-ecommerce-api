/**
 * Reexporta o singleton do Admin SDK definido em src/ (Modulo 8 - Epico 8.3,
 * AINDA NAO IMPLEMENTADO neste codebase). Payments usa o Admin SDK apenas
 * para a colecao `stripeEvents` (idempotencia, RN14) - NUNCA para a colecao
 * `pedidos` (Decisao tecnica 3 do BACKLOG: "Payments nunca escreve
 * diretamente no Firestore na colecao pedidos"). Duplicado por servico
 * conforme a Decisao tecnica 4.
 */
export { getAdminApp } from "../../src/firebaseAdmin";
