import { describe, expect, it } from "vitest";

// Task 17.1.1: sanidade minima - roda sem emulador e sem rede.
describe("setup do Vitest", () => {
  it("roda um teste trivial sem depender de rede/emulador", () => {
    expect(1 + 1).toBe(2);
  });
});
