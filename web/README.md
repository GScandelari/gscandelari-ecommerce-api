# web/ — Front-end de testes (Fase 4)

SPA em **React + Vite + TypeScript**, ferramenta de teste/demonstração da API construída nas Fases 1-2 deste monorepo (`functions/`). Roda **exclusivamente contra o Firebase Emulator Suite local** — nunca contra um projeto Firebase real (RN27, ver `SPEC.md` seção "Fase 4").

A documentação completa (como rodar os dois processos, variáveis de ambiente, criação de admin de teste, Stripe CLI, CI) vive no README da raiz do monorepo, para não duplicar/desalinhar conteúdo entre os dois arquivos:

- [`../README.md` — seção "Front-end de testes (Fase 4) — `web/`"](../README.md#front-end-de-testes-fase-4--web)
- [`../README.md` — seção "Variáveis de ambiente e segredos" > "Front-end (`web/`)"](../README.md#front-end-web--variáveis-de-build-vite)
- [`../SPEC.md`](../SPEC.md) — seção "Fase 4" (regras de negócio RN21-RN27)
- [`../BACKLOG.md`](../BACKLOG.md) — seção "Backlog: gscandelari-ecommerce-api — Fase 4 (Front-end de testes)"

## Resumo rápido

```bash
# Terminal 1, a partir da raiz do repositório
npx firebase-tools emulators:start

# Terminal 2, a partir de web/
cd web
npm install
cp .env.example .env
npm run dev
```

Comandos de qualidade (mesmos rodados pelo CI, `.github/workflows/ci-web.yml`):

```bash
npm run lint
npm run format:check
npm run build
npm test
```
