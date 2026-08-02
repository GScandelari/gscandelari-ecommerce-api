# gscandelari-ecommerce-api

API REST de e-commerce (Produtos, Pedidos, Clientes) — projeto de portfólio, **Fase 1 (Core API)**.

Construída com **Firebase Cloud Functions (2ª geração) + Express + TypeScript + Firestore**, com autenticação via **Firebase Auth** (papéis `cliente`/`admin` via custom claims). Ver a especificação completa em [`SPEC.md`](./SPEC.md) e o backlog de tasks em [`BACKLOG.md`](./BACKLOG.md).

> Fases futuras (2: gateway de pagamento real; 3: quebra em microsserviços) **não** fazem parte deste repositório/spec ainda — ver `SPEC.md` seção 1.

## Estado atual do projeto

Este repositório está em desenvolvimento incremental (TDD/BDD), e o estado abaixo é esperado — não é um bug:

- **Módulo 1 (Setup & Infra)**: parcialmente concluído. `firebase.json`, `.firebaserc`, `firestore.rules` (deny-all para client SDK), Firestore/Auth/Functions Emulator, TypeScript e um app Express mínimo (`GET /health`) já existem. **ESLint/Prettier (Task 1.3.1) ainda não foram configurados** — o script `npm run lint` (e o step de lint do CI) falharão até essa task ser concluída.
- **Módulo 2 (Core Business)**: **ainda não implementado.** Modelos de dados, middlewares de autenticação/autorização, endpoints de `/produtos` e `/pedidos`, validação Zod e tratamento de erro centralizado são a próxima etapa. Até lá, qualquer rota além de `/health` responde `404`.
- **Módulo 3 (Testes)**: a suíte Jest + Supertest já existe em `functions/test/` e roda contra o Firebase Emulator Suite, mas está **majoritariamente "vermelha" (falhando) por design** — TDD: os testes foram escritos antes da implementação do Módulo 2 e falham porque os módulos que eles importam (`src/middlewares/authenticate`, `src/services/pedidos.statusMachine`, etc.) ainda não existem. Isso é o estado esperado nesta fase, não uma regressão.
- **Módulo 4 (este documento + CI/CD)**: cobre a infraestrutura de entrega (Git, CI, README, deploy) e pode evoluir em paralelo aos demais módulos.

Consulte `BACKLOG.md` para o detalhamento task a task e o critério de aceite de cada item.

## Sumário

- [Pré-requisitos](#pré-requisitos)
- [Como rodar localmente](#como-rodar-localmente)
- [Variáveis de ambiente e segredos](#variáveis-de-ambiente-e-segredos)
- [Como rodar os testes](#como-rodar-os-testes)
- [Lint e build](#lint-e-build)
- [Estrutura do projeto](#estrutura-do-projeto)
- [CI/CD](#cicd)
- [Deploy](#deploy)
- [Contribuindo](#contribuindo)

## Pré-requisitos

- [Node.js 20](https://nodejs.org/) (mesma versão declarada em `functions/package.json` > `engines.node` e usada pelo runtime das Cloud Functions)
- npm (instalado junto com o Node.js)
- Java 11+ (exigido pelo Firestore/Auth Emulator — verifique com `java -version`)
- Não é necessário instalar o Firebase CLI globalmente: ele é uma devDependency do projeto (`firebase-tools`, em `functions/package.json`) e é usado via `npx firebase-tools` nos scripts do `npm` e no CI. Se preferir usar um CLI global (`npm install -g firebase-tools`), ele também funciona.

## Como rodar localmente

Todo o código da API vive em `functions/`. Os emuladores usam sempre o projeto Firebase de demonstração `demo-gscandelari-ecommerce-api` (alias `default` em `.firebaserc`), **nunca** um projeto real — isso é automático via `singleProjectMode` em `firebase.json` e o prefixo `demo-` (reconhecido pelo Firebase CLI como "não é um projeto real, não requer credenciais nem gera cobrança").

1. Instalar as dependências:
   ```bash
   cd functions
   npm install
   ```
2. Subir o Firebase Emulator Suite (Auth + Firestore + Functions) a partir da **raiz do repositório** (onde está `firebase.json`):
   ```bash
   npx firebase-tools emulators:start
   ```
   Isso sobe:
   - Auth Emulator: `localhost:9099`
   - Firestore Emulator: `localhost:8080`
   - Functions Emulator (a função HTTPS `api`, ver `functions/src/index.ts`): `localhost:5001`
   - Emulator UI: `localhost:4000`
3. Testar a API rodando:
   ```bash
   curl http://localhost:5001/demo-gscandelari-ecommerce-api/us-central1/api/health
   # {"status":"ok"}
   ```
   (a URL segue o padrão `http://localhost:<porta-functions>/<project-id>/<region>/<nome-da-function>/<rota>` do Functions Emulator 2ª geração)

Alternativa para desenvolvimento rápido do Express sem subir o emulador de Functions: como `functions/src/app.ts` exporta o app Express puro, ele pode ser exercitado diretamente via Supertest nos testes (ver seção seguinte) sem precisar do Functions Emulator — mas para testar o fluxo real de ponta a ponta (incluindo Auth/Firestore), use `emulators:start` como acima.

## Variáveis de ambiente e segredos

**Nenhum segredo é commitado neste repositório.** O `.gitignore` da raiz já exclui arquivos `.env*`, `*serviceAccount*.json` e afins.

### Local / desenvolvimento (Emulator Suite)

Ao rodar via `emulators:start` ou `emulators:exec`, o Firebase CLI injeta automaticamente as variáveis abaixo nos processos filhos — **nada precisa ser configurado manualmente**:

| Variável | Descrição | Onde é usada |
|---|---|---|
| `FIRESTORE_EMULATOR_HOST` | Host:porta do Firestore Emulator (`localhost:8080`) | `functions/test/helpers/firestoreTestUtils.ts`, Admin SDK |
| `FIREBASE_AUTH_EMULATOR_HOST` | Host:porta do Auth Emulator (`localhost:9099`) | `functions/test/helpers/testAuth.ts`, Admin SDK |
| `GCLOUD_PROJECT` | ID do projeto Firebase (demo) | `functions/test/helpers/adminApp.ts` |

### Segredos de aplicação (runtime, projeto real)

Levantamento (Task 4.4.1 do `BACKLOG.md`): a Fase 1 **não integra nenhum gateway de pagamento real** nem serviço externo que exija chave de API (ver `SPEC.md` seção 1 — isso é escopo da Fase 2). Portanto, **não há segredo de aplicação a configurar nesta fase** além das credenciais de deploy (abaixo). Se/quando a Fase 2 introduzir integrações externas, os segredos correspondentes devem ser criados via Firebase Secret Manager, nunca em `.env` commitado:

```bash
firebase functions:secrets:set NOME_DO_SEGREDO
# valor é digitado interativamente, nunca fica em texto no shell/histórico
```

e referenciados no código via a opção `secrets` do `onRequest`/`onCall` (2ª geração), conforme a [documentação oficial do Firebase](https://firebase.google.com/docs/functions/config-env?gen=2#secret-manager).

### Credenciais de deploy (CI/CD)

Para o workflow de deploy (`.github/workflows/deploy.yml`) autenticar no Firebase, é necessário configurar o GitHub Actions Secret:

| Secret | Descrição |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | JSON de uma Service Account do projeto Firebase real, com permissão de deploy de Cloud Functions (papel `Firebase Admin` ou equivalente mínimo). Gerado em Console do Google Cloud > IAM & Admin > Service Accounts > Keys. Configurado em GitHub > Settings > Secrets and variables > Actions. |

Esse secret **nunca** é impresso em log (o GitHub Actions mascara automaticamente valores de secret) e é escrito num arquivo temporário do runner, removido ao final do job de deploy — ver `.github/workflows/deploy.yml`.

## Como rodar os testes

Todos os comandos abaixo rodam dentro de `functions/`:

```bash
cd functions

# Suíte Jest + Supertest "crua" (sem subir o emulador — só faz sentido para
# testes que não dependem de Auth/Firestore reais, ex.: test/setup/sanity.test.ts)
npm test

# Mesma suíte, mas subindo automaticamente Auth + Firestore Emulator antes,
# rodando os testes contra eles, e derrubando os emuladores ao final
# (propaga falha via exit code) — este é o comando recomendado/"oficial"
npm run test:emulator

# Com relatório de cobertura (threshold mínimo de 70%, ver functions/jest.config.js)
npm run test:coverage
npm run test:coverage:emulator
```

**Resultado esperado hoje:** `test:emulator` roda a suíte completa, mas falha (ver seção "Estado atual do projeto" acima) porque o Módulo 2 ainda não foi implementado — isso é o estado "vermelho" esperado em TDD, não um problema deste scaffold de CI/CD. Conforme o Módulo 2 for implementado, os testes progressivamente ficam verdes.

## Lint e build

```bash
cd functions
npm run build   # compila TypeScript (tsconfig.build.json) para functions/lib
npm run lint     # ainda não configurado nesta fase — ver "Estado atual do projeto"
```

## Estrutura do projeto

```
.
├── firebase.json              # config do Firebase CLI (Functions, Firestore, Emulator Suite)
├── .firebaserc                # alias de projeto(s) Firebase (hoje: só o demo, ver "Deploy")
├── firestore.rules            # regras do Firestore (deny-all client SDK; acesso só via Admin SDK)
├── firestore.indexes.json     # índices compostos do Firestore (vazio nesta fase)
├── SPEC.md                    # especificação técnica aprovada (fonte da verdade de negócio)
├── BACKLOG.md                 # decomposição em épicos/tasks rastreáveis às RNs
├── CONTRIBUTING.md            # convenção de commits e estratégia de branching
├── .github/workflows/         # pipelines de CI (lint+testes) e CD (deploy manual)
└── functions/                 # todo o código da API (Cloud Functions)
    ├── src/
    │   ├── app.ts              # app Express (hoje: só GET /health)
    │   ├── index.ts             # entry point da Cloud Function HTTPS 2ª geração
    │   └── ...                  # routes/, models/, middlewares/, services/, repositories/ — Módulo 2
    ├── test/
    │   ├── setup/                # sanity checks de infra de teste
    │   ├── unit/                  # testes unitários (middlewares, máquina de status)
    │   ├── integration/            # testes de integração via Supertest + Emulator Suite
    │   └── helpers/                 # utilitários de teste (usuários de teste, limpeza do Firestore)
    ├── package.json
    ├── tsconfig.json / tsconfig.build.json
    └── jest.config.js            # coverage threshold 70%
```

## CI/CD

Workflows em `.github/workflows/`:

- **`ci.yml`** — roda em todo Pull Request para `main` e em todo push em `main`. Etapas: `npm ci` (instala dependências), `npm run lint`, `npm run build`, `npm run test:coverage:emulator` (Jest + Supertest contra o Firebase Emulator Suite, com o mesmo `firebase-tools` travado no `package-lock.json`). Nenhuma etapa de CI toca um projeto Firebase real. Este workflow é o check obrigatório configurado na proteção da branch `main` (ver `CONTRIBUTING.md`).
- **`deploy.yml`** — deploy para Firebase Functions. Ver decisão detalhada abaixo.

## Deploy

### Decisão registrada (Task 4.5.1 do `BACKLOG.md`): deploy MANUAL

O deploy para o projeto Firebase real a partir de `main` é **manual**, disparado via `workflow_dispatch` (botão "Run workflow" no GitHub Actions, com um campo de confirmação obrigatório), e **não** automático a cada merge em `main`.

**Motivo:** este é um projeto de portfólio rodando sobre um projeto Firebase real no plano Blaze (pré-requisito das Cloud Functions 2ª geração). Deploy automático a cada merge geraria risco/custo desnecessário enquanto o Módulo 2 (Core Business) ainda está em desenvolvimento incremental e a suíte de testes ainda não está 100% verde. Um gatilho manual dá a um humano a chance de decidir *quando* colocar uma versão em produção, mantendo ainda assim `main` sempre *deployável* (princípio central do GitHub Flow) e o pipeline de deploy 100% automatizado/reprodutível uma vez disparado. Essa decisão pode ser revisitada (trocando o gatilho para `push` em `main`) quando o projeto amadurecer.

### Deploy manual via GitHub Actions (recomendado)

1. Garanta que `main` está com o CI verde (badge/check do workflow `ci.yml`).
2. Configure os pré-requisitos (uma única vez): projeto Firebase real criado, alias `production` adicionado a `.firebaserc` apontando para o ID real do projeto, e o secret `FIREBASE_SERVICE_ACCOUNT_KEY` configurado no GitHub (ver seção "Variáveis de ambiente e segredos").
   > **Gap conhecido:** `.firebaserc` hoje só tem o alias `default` apontando para o projeto demo (`demo-gscandelari-ecommerce-api`), usado pelos emuladores. Antes do primeiro deploy real, é necessário provisionar o projeto Firebase de produção e adicionar seu alias/ID — isso está fora do escopo deste scaffold de CI/CD (nenhum recurso de nuvem real foi criado por este agente).
3. Vá em GitHub > Actions > workflow **"Deploy Firebase Functions"** > "Run workflow", selecione a branch `main`, digite `deploy` no campo de confirmação e execute.
4. O workflow reexecuta lint + build + testes antes de deployar (defesa em profundidade) e então roda `firebase deploy --only functions`.

### Deploy manual via Firebase CLI (local, alternativa)

Use apenas se você tiver credenciais próprias autorizadas no projeto Firebase real (via `firebase login`):

```bash
cd functions
npm run build
npm run test:emulator          # garanta que a suíte passa antes de deployar
cd ..
npx firebase-tools use production   # alias configurado em .firebaserc, ver acima
npx firebase-tools deploy --only functions
```

Nunca rode `firebase deploy` apontando para o alias `default`/demo — ele existe apenas para os emuladores.

## Contribuindo

Convenção de commits (Conventional Commits), estratégia de branching (GitHub Flow) e processo de Pull Request estão documentados em [`CONTRIBUTING.md`](./CONTRIBUTING.md).
