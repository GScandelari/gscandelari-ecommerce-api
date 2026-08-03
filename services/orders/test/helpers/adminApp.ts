/**
 * Reexporta o singleton do Admin SDK definido em src/ (Modulo 8 - Epico 8.2,
 * AINDA NAO IMPLEMENTADO neste codebase), garantindo que testes e codigo de
 * producao falem sempre com o mesmo app/projeto. Mesmo padrao ja usado em
 * functions/test/helpers/adminApp.ts (Fase 1/2), duplicado aqui conforme a
 * Decisao tecnica 4 do BACKLOG (Fase 3).
 */
export { getAdminApp } from "../../src/firebaseAdmin";
