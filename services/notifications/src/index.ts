/**
 * Entry point do servico Notifications (codebase `notifications`, Fase 3).
 * Sem rotas HTTP publicas (RN20) - so exporta o Firestore Trigger.
 * `secrets` injeta RESEND_API_KEY do Firebase Secret Manager em producao.
 */
export { onPedidoStatusChange } from "./triggers/onPedidoStatusChange";
