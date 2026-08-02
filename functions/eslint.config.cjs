const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const prettierConfig = require("eslint-config-prettier");

module.exports = tseslint.config(
  {
    ignores: [
      "lib/**",
      "coverage/**",
      "node_modules/**",
      "eslint.config.cjs",
      "jest.config.js",
      "scripts/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Testes usam `any` pragmaticamente para mocks de req/res do Express;
    // o código de produção em src/** continua com a regra padrão (erro).
    files: ["test/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
