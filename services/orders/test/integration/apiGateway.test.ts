import * as fs from "fs";
import * as path from "path";

/**
 * Validacao estatica do API Gateway (Firebase Hosting rewrites) - RN20
 * (Modulo 11 - Epico 11.1, Modulo 12 - Task 12.4.1).
 *
 * Nao depende do Hosting Emulator (opcao explicitamente aceita pelo criterio
 * de aceite da Task 12.4.1: "Hosting Emulator, ou validacao estatica de
 * firebase.json") - le o `firebase.json` real na raiz do monorepo, sem
 * modifica-lo (o Modulo 11 - reestruturacao de producao - nao e escopo desta
 * rodada de testes).
 *
 * ESTADO ESPERADO ATUAL (TDD "vermelho"): `firebase.json` ainda nao declara
 * o bloco `hosting`/`rewrites` (Modulo 11 AINDA NAO IMPLEMENTADO) - as
 * asserções abaixo falharao ate a Task 11.1.1 ser concluida.
 */

interface HostingRewrite {
  source: string;
  function?: string | { functionId?: string };
}

function loadFirebaseJson(): { hosting?: { rewrites?: HostingRewrite[] } } {
  const firebaseJsonPath = path.join(__dirname, "..", "..", "..", "..", "firebase.json");
  const raw = fs.readFileSync(firebaseJsonPath, "utf-8");
  return JSON.parse(raw);
}

function functionIdOf(rewrite: HostingRewrite | undefined): string | undefined {
  if (!rewrite) return undefined;
  return typeof rewrite.function === "string" ? rewrite.function : rewrite.function?.functionId;
}

describe("API Gateway (Firebase Hosting rewrites) - RN20 (Modulo 11 / Task 12.4.1)", () => {
  it("RN20: /produtos/** e /pedidos/** roteiam para a function ordersApi", () => {
    const config = loadFirebaseJson();
    const rewrites = config.hosting?.rewrites ?? [];

    const produtosRewrite = rewrites.find((r) => r.source === "/produtos/**");
    const pedidosRewrite = rewrites.find((r) => r.source === "/pedidos/**");

    expect(produtosRewrite).toBeDefined();
    expect(pedidosRewrite).toBeDefined();
    expect(functionIdOf(produtosRewrite)).toBe("ordersApi");
    expect(functionIdOf(pedidosRewrite)).toBe("ordersApi");
  });

  it("RN20: /webhooks/stripe roteia para a function paymentsApi", () => {
    const config = loadFirebaseJson();
    const rewrites = config.hosting?.rewrites ?? [];

    const webhookRewrite = rewrites.find((r) => r.source === "/webhooks/stripe");

    expect(webhookRewrite).toBeDefined();
    expect(functionIdOf(webhookRewrite)).toBe("paymentsApi");
  });

  it("RN20: Notifications nao e referenciada em nenhum rewrite do gateway (sem rota publica)", () => {
    const config = loadFirebaseJson();
    const rewrites = config.hosting?.rewrites ?? [];

    const referenciasNotifications = rewrites.filter((r) =>
      `${functionIdOf(r)}`.includes("notifications"),
    );

    expect(referenciasNotifications).toHaveLength(0);
  });
});
