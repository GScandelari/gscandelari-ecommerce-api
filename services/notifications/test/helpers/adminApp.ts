/**
 * Reexporta o singleton do Admin SDK definido em src/ (Modulo 8 - Epico 8.4,
 * AINDA NAO IMPLEMENTADO neste codebase). Notifications usa o Admin SDK para
 * `admin.auth().getUser(clienteId)` (resolucao de e-mail, RN19, Decisao
 * tecnica 5) - Notifications nao tem rotas HTTP nem escreve em `pedidos`.
 */
export { getAdminApp } from "../../src/firebaseAdmin";
