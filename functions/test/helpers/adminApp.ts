/**
 * Reexporta o singleton do Admin SDK definido em src/ (Modulo 2), garantindo
 * que testes e codigo de producao falem sempre com o mesmo app/projeto.
 */
export { getAdminApp } from "../../src/firebaseAdmin";
