/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  roots: ["<rootDir>/test"],
  testMatch: ["**/*.test.ts"],
  // Resolve o path alias @/ (mesma convencao de functions/), tambem no
  // ts-jest, sem precisar de outDir (ts-jest roda direto sobre src/**/*.ts
  // via require hook).
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // Timeout maior: testes de integracao falam com o Auth/Firestore Emulator.
  testTimeout: 20000,
  collectCoverage: false,
  collectCoverageFrom: ["src/**/*.ts", "!src/index.ts"],
  coverageDirectory: "coverage",
  // Meta de cobertura da spec (SPEC.md Fase 3 / BACKLOG Task 12.5.1).
  // So se aplica quando rodado com --coverage (npm run test:coverage).
  // Enquanto os Modulos 8/9 (implementacao) nao existirem, este threshold
  // FALHARA propositalmente - e o estado esperado de TDD "vermelho".
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
