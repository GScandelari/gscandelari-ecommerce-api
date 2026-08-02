/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  roots: ["<rootDir>/test"],
  testMatch: ["**/*.test.ts"],
  // Resolve o path alias @/ (Task 1.3.3) tambem no ts-jest, sem precisar de
  // outDir (ts-jest roda direto sobre src/**/*.ts via require hook).
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // Timeout maior: testes de integração falam com o Auth/Firestore Emulator.
  testTimeout: 20000,
  collectCoverage: false,
  collectCoverageFrom: ["src/**/*.ts", "!src/index.ts"],
  coverageDirectory: "coverage",
  // Meta de cobertura da spec (SPEC.md secao 2 / BACKLOG Task 3.5.1).
  // So se aplica quando rodado com --coverage (npm run test:coverage).
  // Enquanto o Modulo 2 (implementacao) nao existir, este threshold
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
