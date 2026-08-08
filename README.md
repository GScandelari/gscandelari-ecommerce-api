# gscandelari-ecommerce-api

API REST de e-commerce (Produtos, Pedidos, Clientes) — projeto de portfólio, **Fases 1-5 concluídas**.

Construída com **Firebase Cloud Functions (2ª geração) + Express + TypeScript + Firestore**, com autenticação via **Firebase Auth** (papéis `cliente`/`admin` via custom claims). Ver a especificação completa em [`SPEC.md`](./SPEC.md) e o backlog de tasks em [`BACKLOG.md`](./BACKLOG.md).

> Fase 2 (integração de pagamento real via Stripe, sempre em modo sandbox) já está implementada, testada e **deployada em produção**. Fase 3 (quebra em microsserviços) está **implementada, deployada em produção real e validada de ponta a ponta** (Épico 8.6) — o monólito (`functions/`, codebase `default`) foi **deliberadamente decomissionado** após a validação. Fase 4 (front-end de testes, `web/`) está implementada. Fase 5 (cancelamento pós-pagamento e reembolso, e a correção do bug do webhook) está **implementada, deployada e validada de ponta a ponta em produção real** (modo teste do Stripe), hoje rodando nos codebases `orders`/`payments` da Fase 3. Ver [Arquitetura da Fase 3 (Microsserviços)](#arquitetura-da-fase-3-microsserviços) abaixo.

## Estado atual do projeto

- **Módulo 1 (Setup & Infra)**: concluído. `firebase.json`, `.firebaserc`, `firestore.rules` (deny-all para client SDK), Firestore/Auth/Functions Emulator, TypeScript (com path alias `@/`), ESLint + Prettier e hook de pre-commit já configurados.
- **Módulo 2 (Core Business)**: concluído. Modelos de dados, middlewares de autenticação/autorização (Firebase Auth + custom claim `admin`), validação Zod, tratamento de erro centralizado e os endpoints REST de `/produtos` e `/pedidos` (RN01-RN09, RN07a) estão implementados, incluindo documentação OpenAPI/Swagger em `/docs` (Épico 2.7).
- **Módulo 3 (Testes)**: concluído. `functions/test/` cobre RN01-RN09/RN07a via Jest + Supertest contra o Firebase Emulator Suite — **49/49 testes passando**, cobertura 96%+ (acima da meta de 70% do `SPEC.md`).
- **Módulo 4 (este documento + CI/CD)**: concluído. Git, CI/CD, README e estratégia de deploy documentados.

**Fase 2 (integração de pagamento via Stripe): concluída e deployada em produção.** `POST /pedidos` cria automaticamente uma PaymentIntent no Stripe (modo teste); `POST /webhooks/stripe` confirma ou cancela pedidos automaticamente via evento assinado (RN10-RN15), com idempotência. 63/63 testes passando (49 Fase 1 + 14 Fase 2, zero regressão), CI verde no GitHub Actions. Os segredos `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` já estão configurados no Firebase Secret Manager do projeto real e o deploy foi validado de ponta a ponta via `workflow_dispatch`.

**Fase 4 (front-end de testes, `web/`): implementada e mesclada em `main`.** SPA React + Vite + TypeScript, em `web/` na raiz do monorepo, para exercitar visualmente a API do monólito da Fase 1+2 (`functions/`) rodando **exclusivamente contra o Firebase Emulator Suite local** — nunca um projeto Firebase real (RN27). Não é o produto final do portfólio (esse é a API): é uma ferramenta de teste/demonstração com dois perfis, Cliente e Administrador. Lint, build e testes (Vitest + React Testing Library) verdes localmente e no `ci-web.yml`. Documentação de como rodar `web/` junto com o emulador está na seção [Front-end de testes (Fase 4) — `web/`](#front-end-de-testes-fase-4--web) abaixo.

**Fase 3 (microsserviços): implementada, deployada em produção real e validada de ponta a ponta (Épico 8.6).** Reestrutura o monólito em 3 codebases independentes (`services/orders/`, `services/payments/`, `services/notifications/`) atrás de um API Gateway (Firebase Hosting, `https://gscandelari-ecommerce-api.web.app`). O corte de produção (Épico 8.6) foi executado e validado com uma compra real de ponta a ponta pelo novo domínio (criar pedido → PaymentIntent real via chamada interna Orders→Payments → pagamento confirmado → webhook do Stripe migrado para a nova URL → pedido confirmado via chamada interna Payments→Orders → e-mail real via Resend), e o monólito (codebase `default`, `functions/`) foi **deliberadamente decomissionado** (Task 8.6.3) — a URL antiga `.../api/health` não responde mais. Detalhes completos em [Arquitetura da Fase 3 (Microsserviços)](#arquitetura-da-fase-3-microsserviços).

**Fase 5 (cancelamento pós-pagamento e reembolso): implementada, deployada e validada de ponta a ponta em produção real.** Emenda RN05/RN06/RN07 (Fase 1) e o modelo de pagamento (Fase 2) para permitir que o Cliente cancele também um pedido `confirmado`, introduz o status intermediário `aguardando_devolucao` para cancelamento a partir de `enviado`, e adiciona uma ação dedicada de reembolso via Stripe para o Admin (RN28-RN33) — sempre manual e deliberada, nunca automática. Também corrige um bug real encontrado testando a Fase 4 de ponta a ponta: o webhook do Stripe (`POST /webhooks/stripe`) nunca validava a assinatura corretamente através do Functions Framework (`req.body` já vinha parseado, não cru) — corrigido usando `req.rawBody`. `functions/` (92 testes), `services/orders`+`services/payments` (93+33 testes, réplica sem deploy) e `web/` (37 testes) todos verdes. Validado com uma compra real em modo teste do Stripe: criar → pagar → confirmar automaticamente via webhook → cancelar → reembolsar, com o refund conferido diretamente na API do Stripe (ver [Deploy](#deploy) para os pré-requisitos de infraestrutura descobertos nessa validação). Documentação da máquina de estados estendida está na seção [Máquina de estados do Pedido — status e pagamento](#máquina-de-estados-do-pedido--status-e-pagamento) abaixo.

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
- [Integração de pagamento (Stripe) — Fase 2](#integração-de-pagamento-stripe--fase-2)
- [Máquina de estados do Pedido — status e pagamento](#máquina-de-estados-do-pedido--status-e-pagamento)
- [Arquitetura da Fase 3 (Microsserviços)](#arquitetura-da-fase-3-microsserviços)
- [Front-end de testes (Fase 4) — `web/`](#front-end-de-testes-fase-4--web)
- [Contribuindo](#contribuindo)

## Pré-requisitos

- [Node.js 20](https://nodejs.org/) (mesma versão declarada em `functions/package.json` > `engines.node` e usada pelo runtime das Cloud Functions)
- npm (instalado junto com o Node.js)
- Java 21+ (exigido pelo Firestore/Auth Emulator na versão atual do `firebase-tools` — verifique com `java -version`)
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
   # {"status":"ok","env":"local"}
   ```
4. Documentação interativa (Swagger UI, Épico 2.7): abra `http://localhost:5001/demo-gscandelari-ecommerce-api/us-central1/api/docs` no navegador.
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

Levantamento (Task 4.4.1 do `BACKLOG.md`): a Fase 1 **não integra nenhum gateway de pagamento real** nem serviço externo que exija chave de API (ver `SPEC.md` seção 1). A Fase 2 (ver "Estado atual do projeto" acima) introduz os dois primeiros segredos de aplicação do projeto, ambos do Stripe **em modo teste/sandbox** (nunca chaves de modo live/produção — este projeto de portfólio nunca processa dinheiro real):

| Variável | Descrição | Onde é usada |
|---|---|---|
| `STRIPE_SECRET_KEY` | Chave secreta de **teste** do Stripe (sempre no formato `sk_test_...`, nunca `sk_live_...`) | `functions/src/stripeClient.ts` (`getStripeClient()`) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret do endpoint de webhook (`whsec_...`), usado para validar a assinatura `stripe-signature` de cada evento recebido | `functions/src/routes/webhooks.routes.ts` |

Todo segredo de aplicação novo (incluindo os dois acima) é criado via Firebase Secret Manager, **nunca em `.env` commitado**:

```bash
firebase functions:secrets:set NOME_DO_SEGREDO
# valor é digitado interativamente, nunca fica em texto no shell/histórico
```

e referenciado no código via a opção `secrets` do `onRequest`/`onCall` (2ª geração), conforme a [documentação oficial do Firebase](https://firebase.google.com/docs/functions/config-env?gen=2#secret-manager). Ver a seção ["Integração de pagamento (Stripe) — Fase 2"](#integração-de-pagamento-stripe--fase-2) abaixo para o passo a passo completo de como obter as chaves de teste e configurá-las localmente e em produção.

### Front-end (`web/`) — variáveis de build (Vite)

O front-end de testes (Fase 4, ver [seção dedicada](#front-end-de-testes-fase-4--web) abaixo) usa suas próprias variáveis de ambiente, documentadas em `web/.env.example` — nenhuma delas é um segredo de runtime como as do Stripe acima (a chave publicável do Stripe é, por definição, feita para ser exposta em código de browser), mas seguem a mesma convenção de nunca serem commitadas com valor real (`web/.env` também cai nas entradas genéricas `.env*`/`!.env.example` do `.gitignore` da raiz).

| Variável | Descrição |
|---|---|
| `VITE_FIREBASE_PROJECT_ID` | Sempre `demo-gscandelari-ecommerce-api` — deve começar com `demo-` (RN27, Decisão técnica 6 do `BACKLOG.md`); `src/lib/firebase.ts` recusa inicializar e interrompe o boot se essa condição não for atendida |
| `VITE_FIREBASE_API_KEY` / `VITE_FIREBASE_AUTH_DOMAIN` / `VITE_FIREBASE_APP_ID` | Config do Firebase Web App exigida pelo SDK do client (`initializeApp`); como o app só fala com o Auth Emulator, valores placeholder funcionam sem necessidade de um Web App real cadastrado no Console |
| `VITE_AUTH_EMULATOR_URL` | URL do Auth Emulator (`http://localhost:9099`), usada por `connectAuthEmulator` |
| `VITE_API_BASE_URL` | URL base da function `api` do monólito Fase 1+2 servida pelo Functions Emulator (`http://localhost:5001/demo-gscandelari-ecommerce-api/us-central1/api`) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Chave publicável de **teste** do Stripe (`pk_test_...`), mesma conta usada para `STRIPE_SECRET_KEY` (ver acima) |

Copie `web/.env.example` para `web/.env` antes de rodar `npm run dev` em `web/` — detalhes na seção [Front-end de testes (Fase 4) — `web/`](#front-end-de-testes-fase-4--web).

### Credenciais de deploy (CI/CD)

Para o workflow de deploy (`.github/workflows/deploy.yml`) autenticar no Firebase, é necessário o GitHub Actions Secret abaixo — **já configurado** neste repositório:

| Secret | Descrição |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | JSON da Service Account `github-actions-deploy@gscandelari-ecommerce-api.iam.gserviceaccount.com`, com os papéis listados na seção "Deploy" > "Estado atual" abaixo. Gerado em Console do Google Cloud > IAM & Admin > Service Accounts > Keys. Configurado em GitHub > Settings > Secrets and variables > Actions. |

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

**Resultado esperado hoje:** `test:emulator` roda a suíte completa e passa (48/48), com cobertura acima da meta de 70% definida no `SPEC.md`.

## Lint e build

```bash
cd functions
npm run build         # compila TypeScript (tsconfig.build.json) + resolve o path alias @/ via tsc-alias
npm run lint           # ESLint (flat config, typescript-eslint)
npm run format:check   # Prettier (use `npm run format` para corrigir)
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
    │   ├── app.ts              # app Express (GET /health + /produtos + /pedidos + error handler)
    │   ├── index.ts             # entry point da Cloud Function HTTPS 2ª geração
    │   ├── routes/               # produtos.routes.ts, pedidos.routes.ts
    │   ├── services/              # pedidosService.ts (transações Firestore), pedidos.statusMachine.ts
    │   ├── repositories/           # produtosRepository.ts, pedidosRepository.ts
    │   ├── middlewares/             # authenticate, requireAdmin, validate, errorHandler
    │   ├── schemas/                  # schemas Zod de Produto/Pedido
    │   ├── models/                    # interfaces Produto, Pedido
    │   ├── errors/                     # AppError e subclasses (NotFound/Forbidden/Validation/Conflict)
    │   ├── types/                       # augmentation de Express.Request (req.user)
    │   └── firebaseAdmin.ts              # singleton do Admin SDK (emulator-aware)
    ├── scripts/setAdminClaim.js  # utilitario de dev: seta custom claim admin no Auth Emulator
    ├── test/
    │   ├── setup/                # sanity checks de infra de teste
    │   ├── unit/                  # testes unitários (middlewares, máquina de status)
    │   ├── integration/            # testes de integração via Supertest + Emulator Suite
    │   └── helpers/                 # utilitários de teste (usuários de teste, limpeza do Firestore)
    ├── package.json
    ├── tsconfig.json / tsconfig.build.json
    └── jest.config.js            # coverage threshold 70%

├── web/                        # Fase 4: front-end de testes (React + Vite + TS),
│                                 # só contra o Emulator Suite local (RN27). Ver
│                                 # "Front-end de testes (Fase 4)" para detalhes.
└── services/                  # Fase 3 (microsserviços) — implementada e deployada
                                # em produção real (Épico 8.6); monólito default
                                # decomissionado. Ver "Arquitetura da Fase 3".
    ├── orders/                 # produtos + pedidos (RN01-RN09, RN16-RN18)
    ├── payments/                # Stripe + webhook (RN10-RN15, RN16-RN18)
    └── notifications/            # e-mail via Resend, sem rota HTTP (RN19-RN20)
        # cada um com seu próprio package.json/tsconfig/jest.config.js,
        # src/ e test/ implementados, lint/build/test verdes
```

## CI/CD

Workflows em `.github/workflows/`:

- **`ci.yml`** — roda em todo Pull Request para `main` e em todo push em `main`. Etapas: `npm ci` (instala dependências), `npm run lint`, `npm run build`, `npm run test:coverage:emulator` (Jest + Supertest contra o Firebase Emulator Suite, com o mesmo `firebase-tools` travado no `package-lock.json`). Nenhuma etapa de CI toca um projeto Firebase real. Este workflow é o check obrigatório configurado na proteção da branch `main` (ver `CONTRIBUTING.md`). **Cuida de `functions/` — código histórico das Fases 1+2 original, preservado no repositório como referência, mas não deployado desde o decomissionamento do monólito (Épico 8.6, Task 8.6.3).**
- **`deploy.yml`** — **removido no Épico 8.6 (Task 8.6.3)**: deployava exclusivamente `functions:default` (o monólito), que foi decomissionado (`firebase functions:delete api`) — o workflow ficaria permanentemente quebrado tentando deployar um codebase que não existe mais em `firebase.json`. `functions/` continua no repositório e passa em `ci.yml`, só não tem mais deploy associado.
- **`ci-services.yml`** (Fase 3) — roda lint/build/test **de forma independente** para cada um dos 3 serviços (`services/orders/`, `services/payments/`, `services/notifications/`), via matrix job, disparado em push/PR para `main` que tocam `services/**`. Verde (código em produção real, ver [Arquitetura da Fase 3](#arquitetura-da-fase-3-microsserviços)).
- **`deploy-services.yml`** (Fase 3) — deploy manual (`workflow_dispatch` + confirmação digitada + `environment: production`, mesmo padrão de segurança que `deploy.yml` tinha) para os 3 codebases (`orders`/`payments`/`notifications`) + Hosting. O corte de produção inicial (bootstrap, Épico 8.6) foi feito manualmente via CLI local (exigia 2 passes de deploy para descobrir as URLs reais do Cloud Run antes de preenchê-las); este workflow cobre deploys subsequentes de código.
- **`ci-web.yml`** (novo, Fase 4) — mesmo padrão de `ci-services.yml`, aplicado a `web/`: `npm ci`, lint, `format:check` (Prettier), build (TypeScript + Vite) e testes (Vitest + React Testing Library, com `fetch`/Firebase Auth mockados — nunca depende do Emulator Suite rodando em CI). Disparado em push/PR para `main` que tocam `web/**`. **Sem step de deploy** — a aplicação `web/` não é publicada nesta fase (uso local/experimentação contra o Emulator Suite, decisão explícita do usuário, ver [Front-end de testes (Fase 4)](#front-end-de-testes-fase-4--web) abaixo). Não é (ainda) um check obrigatório de nenhuma branch protection, mesmo padrão de `ci-services.yml`.

## Deploy

### Estado atual: projeto real provisionado, arquitetura de microsserviços em produção (Épico 8.6)

- **Projeto Firebase (Blaze):** `gscandelari-ecommerce-api` ([console](https://console.firebase.google.com/project/gscandelari-ecommerce-api/overview)), alias `production` em `.firebaserc`.
- **API Gateway (Firebase Hosting):** `https://gscandelari-ecommerce-api.web.app` (`/produtos`, `/pedidos`, `/docs`, `/health`, `/webhooks/stripe`) — ver [Arquitetura da Fase 3](#arquitetura-da-fase-3-microsserviços) para o roteamento completo. O monólito (`.../api/*`) foi decomissionado (Task 8.6.3); a URL antiga não responde mais.
- **Política de limpeza do Artifact Registry** configurada (`firebase functions:artifacts:setpolicy`, imagens de container antigas removidas após 1 dia) — evita custo de armazenamento acumulado.
- **Deploy via GitHub Actions** (`deploy-services.yml`): `workflow_dispatch`, secret `FIREBASE_SERVICE_ACCOUNT_KEY` configurado, reexecuta lint/build/test dos 3 serviços antes de `firebase deploy --only functions:orders,functions:payments,functions:notifications,hosting`.
- **Branch protection** ativa em `main` (PR obrigatório + check de CI obrigatório).
- Segredos do Stripe (`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`, modo teste) e do Resend (`RESEND_API_KEY`, modo sandbox) configurados no Firebase Secret Manager, acessíveis apenas pelas service accounts de runtime que precisam deles (`payments-runtime@` para o Stripe; a function de Notifications para o Resend).
- **Épico 8.6 (corte de produção da Fase 3) validado de ponta a ponta em produção real** (modo teste do Stripe), pelo novo domínio: pedido criado → PaymentIntent real via chamada interna Orders→Payments (RN16) → pago via cartão de teste → webhook do Stripe (migrado para a nova URL) confirmou o pedido via chamada interna Payments→Orders (RN17) → e-mail real via Resend confirmado no destinatário. Dados de teste usados nessa validação foram removidos depois (produtos, pedidos, usuários).
- **Fase 5 (cancelamento/reembolso + correção do bug do webhook) validada de ponta a ponta em produção real** (modo teste do Stripe, ainda no monólito antes do corte): pedido criado → PaymentIntent real → pago via cartão de teste → webhook real confirmou o pedido automaticamente (`confirmado`/`pago`) → cancelado (`estorno_pendente`) → reembolsado via `PATCH /pedidos/:id/reembolsar`, refund `succeeded` conferido diretamente na API do Stripe. Essa mesma lógica hoje roda em `services/orders`+`services/payments`.

**Papéis da Service Account de deploy** (`github-actions-deploy@gscandelari-ecommerce-api.iam.gserviceaccount.com`), descobertos por tentativa/erro real contra o deploy (a lista abaixo é o mínimo que efetivamente funcionou, não uma lista teórica): Cloud Functions Admin, Cloud Run Admin, Artifact Registry Administrator, Cloud Build Editor, Service Account User, Firebase Admin, Service Usage Admin (necessário para o deploy habilitar `cloudbilling.googleapis.com` sozinho), Secret Manager Secret Accessor e Secret Manager Admin (necessário para o deploy conceder acesso ao secret para a service account de runtime das Functions).

### Pré-requisitos de provisionamento descobertos na validação da Fase 5 (passo único, manual, via Console)

O deploy de *código* (`deploy.yml`) sempre funcionou desde a Fase 1, mas até a validação de ponta a ponta da Fase 5 **nenhuma chamada de produção real que tocasse o Firestore havia sido testada** (os smoke tests anteriores só cobriam `/health`/`/docs`, que não tocam o banco). Isso escondeu quatro passos de provisionamento que o Console do Firebase nunca executa sozinho e que faltavam no projeto real:

1. **Firebase Authentication nunca tinha sido habilitado** — sem isso, todo endpoint autenticado (RN09) falha antes mesmo de chegar no Firestore. Habilitar em Console > Authentication > "Get started" > provedor **Email/senha**.
2. **Cloud Firestore API nunca tinha sido habilitada** no projeto GCP — retorna `PERMISSION_DENIED`/`SERVICE_DISABLED` até ser ativada em [console.developers.google.com/apis/api/firestore.googleapis.com](https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=gscandelari-ecommerce-api).
3. **O banco de dados Firestore em si nunca tinha sido criado** (habilitar a API e criar o banco são passos distintos) — em Console > Firestore Database > "Create database", modo **Native**, região **us-central1** (mesma região da Cloud Function). **Importante:** o ID do banco deve ficar literalmente `(default)` — o Admin SDK usado por `functions/src/firebaseAdmin.ts` só enxerga esse nome sem configuração adicional; um ID customizado (ex. `gscandelari-db`) causa `NOT_FOUND` silencioso (500 genérico na API, sem mensagem clara pro cliente).
4. **`firestore.rules`/`firestore.indexes.json` nunca tinham sido deployados** para produção (só existiam localmente/no emulador) — rodar `firebase deploy --only firestore --project production` uma vez resolve; o Admin SDK (usado por toda a API) ignora as rules de qualquer forma, mas deployá-las fecha o acesso via Client SDK, que é a postura de segurança pretendida (Task 1.1.3).

Nenhum destes é necessário para os Emulators locais (que já vêm com Auth/Firestore prontos por padrão) — só para uma instância real do zero.

### Bugs reais encontrados no corte de produção da Fase 3 (Épico 8.6)

Assim como a validação da Fase 5 acima, o corte de produção da Fase 3 só foi possível de verificar de verdade contra um deploy real — nenhum destes quatro bugs foi (ou poderia ter sido) pego pelo Emulator Suite nem pelos testes Jest/Supertest:

1. **Nome de export precisa ser um identificador JS válido.** Um export renomeado via string-literal (`export { ordersApi as "orders-api" }`) funciona no Emulator Suite (que introspecciona os exports diretamente), mas quebra a resolução de `entry_point` do Cloud Functions real (`Function 'orders.api' is not defined in the provided module`).
2. **Codebases não namespaceiam o ID da function automaticamente.** A suposição documentada originalmente na Task 8.5.2 ("Firebase prefixa automaticamente pelo nome do codebase") nunca tinha sido verificada contra um deploy real e estava errada: o ID final é literalmente o identificador exportado, único por **projeto+região**, não por codebase. Dois codebases exportando `api` colidem (`More than one codebase claims functions/api`). Fix: identificadores únicos por codebase (`ordersApi`, `paymentsApi`).
3. **Opções de build-time não podem ler `process.env.X` direto.** `serviceAccount: process.env.RUNTIME_SERVICE_ACCOUNT_EMAIL` sempre resolvia `undefined` num deploy real: o Firebase CLI faz o `require()` do codebase pra descobrir as functions (avaliando esse literal de opções) **antes** de carregar o `.env.<project-id>` em `process.env` — esse `.env` só é injetado numa fase posterior, exclusivamente pro runtime da function. Resultado silencioso: nenhum erro, mas a function rodava sob a service account default do Compute Engine em vez da SA dedicada de menor privilégio. Fix: API de Parameterized Configuration do `firebase-functions` v2 (`defineString`), que devolve uma `Expression<string>` resolvida numa fase posterior do deploy, já com o `.env` carregado.
4. **O SDK do Resend não lança exceção em erros de nível de API.** `emails.send()` devolve `{ data: null, error }` em vez de lançar — sem checar esse campo explicitamente, uma rejeição da API (ex.: sandbox recusando o destinatário) passava batido, sem nenhum log, indistinguível de um envio bem-sucedido. Só descoberto no smoke test real: o e-mail não chegou, mas não havia nenhum `console.error` nos logs. Fix: desestruturar `{ error }` do retorno e logar quando presente (continua best-effort, RN19 — nunca lança, nunca bloqueia a transição de status).

### Decisão registrada (Task 4.5.1 do `BACKLOG.md`): deploy MANUAL

O deploy a partir de `main` é **manual**, disparado via `workflow_dispatch` (botão "Run workflow" no GitHub Actions, com um campo de confirmação obrigatório) ou via CLI local, e **não** automático a cada merge em `main`. Um gatilho manual dá a um humano a chance de decidir *quando* colocar uma versão em produção, mantendo ainda assim `main` sempre *deployável* (princípio central do GitHub Flow). Essa decisão pode ser revisitada (trocando o gatilho para `push` em `main`) quando o time preferir deploy contínuo.

### Deploy manual via GitHub Actions

1. Garanta que `main` está com o CI verde (badge/check do workflow `ci.yml`/`ci-services.yml`).
2. Vá em GitHub > Actions > workflow **"Deploy Microsserviços (Fase 3)"** > "Run workflow", selecione a branch `main`, digite `deploy` no campo de confirmação e execute.
3. O workflow reexecuta lint + build + testes dos 3 serviços antes de deployar (defesa em profundidade) e então roda `firebase deploy --only functions:orders,functions:payments,functions:notifications,hosting` — nunca inclui o monólito (decomissionado, Task 8.6.3).

### Deploy manual via Firebase CLI (local)

```bash
cd services/orders && npm run build && npm run test:emulator && cd ../..
cd services/payments && npm run build && npm run test:emulator && cd ../..
cd services/notifications && npm run build && npm run test:emulator && cd ../..
npx firebase-tools deploy --only functions:orders,functions:payments,functions:notifications,hosting --project production
```

Nunca rode `firebase deploy` apontando para o alias `default`/demo — ele existe apenas para os emuladores.

## Integração de pagamento (Stripe) — Fase 2

> **Status: implementado e deployado em produção.** `functions/src/stripeClient.ts`, `stripeService.ts`, `webhooks.routes.ts` e a extensão do modelo `Pedido` existem e estão no ar; os testes que cobrem RN10-RN15 (`functions/test/integration/pedidosPagamento.test.ts`, `webhooksStripe.test.ts`) passam (SDK do Stripe mockado). Os segredos abaixo já estão configurados no Firebase Secret Manager do projeto real e o webhook já está cadastrado no Dashboard do Stripe. Este projeto **nunca processa dinheiro real**: todas as chaves e o Dashboard usados são sempre em **modo teste/sandbox** do Stripe.

### Como obter as chaves de teste do Stripe

1. Crie (ou acesse) uma conta em [dashboard.stripe.com](https://dashboard.stripe.com/register). Não é necessário completar a ativação da conta (dados bancários, etc.) para usar o modo teste.
2. No Dashboard, confirme que o toggle **"Test mode"** (canto superior direito) está **ativado** — todas as chaves e eventos gerados nesse modo são de sandbox, sem qualquer cobrança real.
3. Vá em **Developers > API keys**. Copie a **Secret key** de teste, que sempre começa com `sk_test_...` (nunca use a chave que começa com `sk_live_...` neste projeto).
4. O **Webhook signing secret** (`whsec_...`) só é gerado depois de cadastrar o endpoint de webhook — ver a subseção ["Configurar a URL do webhook no Dashboard do Stripe"](#configurar-a-url-do-webhook-no-dashboard-do-stripe-modo-teste) abaixo.

Nunca cole uma chave de teste (ou, com muito mais razão, uma chave live) diretamente em código, commit, PR, issue ou log. Ela deve ir **somente** para o `.env` local (ignorado pelo git) ou para o Firebase Secret Manager, conforme abaixo.

### Configuração local (Emulator Suite)

1. Copie o arquivo de exemplo, se ainda não tiver um `.env` local:
   ```bash
   cd functions
   cp .env.example .env
   ```
2. Edite `functions/.env` e preencha `STRIPE_SECRET_KEY` com a sua chave de teste (`sk_test_...`) obtida acima. Para `STRIPE_WEBHOOK_SECRET`, veja a subseção de webhook abaixo — durante desenvolvimento local sem receber webhooks reais, o valor placeholder do `.env.example` é suficiente (os testes Jest nunca usam esse valor: o SDK do Stripe é sempre mockado, ver `functions/test/helpers/mockStripe.ts`).
3. O Firebase Functions (2ª geração) carrega `functions/.env` automaticamente ao rodar via `emulators:start`/`emulators:exec` — nenhuma outra configuração é necessária.

### Configuração em produção (Firebase Secret Manager)

Mesmo padrão já usado para as demais credenciais de deploy da Fase 1 (`README.md` > "Variáveis de ambiente e segredos"), via `firebase functions:secrets:set`:

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
# cole a chave de teste (sk_test_...) quando solicitado — nunca fica em texto no shell/histórico

firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
# cole o signing secret (whsec_...) gerado ao cadastrar o webhook — ver subseção abaixo
```

Os dois segredos já estão referenciados na definição da Cloud Function (opção `secrets` do `onRequest`, 2ª geração, em `functions/src/index.ts`), disponíveis como variável de ambiente em produção — mesmo mecanismo documentado na [seção "Variáveis de ambiente e segredos"](#variáveis-de-ambiente-e-segredos) acima.

### Cartões de teste do Stripe

Para testar o fluxo de pagamento manualmente (via `client_secret` retornado por `POST /pedidos` e Stripe.js/Elements, ou via chamadas diretas de teste), use os [cartões de teste oficiais do Stripe](https://docs.stripe.com/testing#cards) — funcionam **somente** em modo teste, com qualquer data de validade futura, qualquer CVC de 3 dígitos e qualquer CEP:

| Número do cartão | Comportamento simulado |
|---|---|
| `4242 4242 4242 4242` | Pagamento aprovado com sucesso (dispara `payment_intent.succeeded`) |
| `4000 0000 0000 0002` | Cartão recusado (`card_declined`, dispara `payment_intent.payment_failed`) |
| `4000 0000 0000 9995` | Recusado por saldo insuficiente (`insufficient_funds`) |
| `4000 0025 0000 3155` | Exige autenticação 3D Secure adicional |

### Configurar a URL do webhook no Dashboard do Stripe (modo teste)

Passo **manual**, feito uma vez por ambiente (dev local com túnel/Stripe CLI, e produção) — **já feito em produção**, documentado abaixo para referência/reconfiguração:

1. No [Dashboard do Stripe](https://dashboard.stripe.com), com o toggle **"Test mode"** ativado, vá em **Developers > Webhooks > Add endpoint**.
2. Em **Endpoint URL**, informe a URL pública da function em produção: `https://us-central1-gscandelari-ecommerce-api.cloudfunctions.net/api/webhooks/stripe` (mesmo padrão de URL documentado em "Deploy" acima, path `/webhooks/stripe`).
3. Em **Events to listen to**, selecione `payment_intent.succeeded`, `payment_intent.payment_failed` e `payment_intent.canceled` (RN12/RN13 do `SPEC.md`); outros eventos podem ser adicionados sem quebrar nada (RN15/Task 6.4.5 trata tipos não mapeados como no-op).
4. Salve o endpoint. O Stripe exibe o **Signing secret** (`whsec_...`) na página de detalhes do endpoint criado — clique em "Reveal" para visualizá-lo.
5. Copie esse valor e configure-o em produção com `firebase functions:secrets:set STRIPE_WEBHOOK_SECRET` (comando acima). Se o endpoint for recriado ou o secret for "rolado" (rotate) no Dashboard, repita este passo com o novo valor.
6. Para testar localmente sem expor o emulador publicamente, use o [Stripe CLI](https://docs.stripe.com/stripe-cli) (`stripe listen --forward-to localhost:5001/demo-gscandelari-ecommerce-api/us-central1/api/webhooks/stripe`), que gera seu próprio signing secret de teste temporário para colocar no `.env` local.

## Máquina de estados do Pedido — status e pagamento

`status` (`PedidoStatus`) e `paymentStatus` (`PaymentStatus`) são dois campos independentes do mesmo documento `Pedido`. RN05/RN06/RN07/RN07a (Fase 1, em produção) definem a máquina de `status`; RN10-RN15 (Fase 2, em produção) definem `paymentStatus`. **RN28-RN33 (Fase 5) estendem as duas** — implementadas, deployadas e validadas de ponta a ponta em produção real (ver "Estado atual do projeto" acima).

### `status` do Pedido (`PedidoStatus`)

Fluxo principal, sempre nesta ordem (RN05):

```
pendente → confirmado → enviado → entregue
```

Cancelamento, hoje em produção (Fase 1, RN05/RN06/RN07/RN07a):
- `pendente → cancelado` — Cliente dono do pedido ou Admin; estoque restaurado (RN06/RN07a).
- `confirmado → cancelado` — somente Admin; estoque **não** é restaurado automaticamente (RN07a).
- `enviado → cancelado` — somente Admin; estoque **não** é restaurado automaticamente (RN07a).

**Fase 5 (implementada e em produção)** — RN28/RN29/RN30/RN33 alteram esse quadro:
- `confirmado → cancelado` passa a também poder ser disparada pelo **Cliente** dono do pedido (RN28; hoje só o Admin pode). Quando é o Cliente quem cancela um `confirmado`, o estoque **é** restaurado (RN28); quando é o **Admin** quem cancela um `confirmado`, o estoque continua **não** sendo restaurado (RN07a inalterado para o Admin — assimetria Cliente/Admin deliberada, ver Decisão técnica 3 do `BACKLOG.md`/Fase 5).
- `enviado → cancelado` deixa de existir como transição direta (tanto para o Cliente quanto para o Admin). Em seu lugar entra o novo status intermediário `aguardando_devolucao`, sinalizando que o produto ainda está fisicamente com o cliente:
  - `enviado → aguardando_devolucao` — Cliente dono ou Admin (RN29); nenhuma restauração de estoque nem mudança de `paymentStatus` nesta transição (o pedido ainda não está `cancelado`).
  - `aguardando_devolucao → cancelado` — **somente Admin**, confirmando que o produto retornou fisicamente (RN30); estoque restaurado (mesma lógica de RN07a).

Diagrama textual, já incluindo a extensão da Fase 5 (itens marcados `[Fase 5]` já implementados e em produção):

```
pendente
  ├─► confirmado
  │      ├─► enviado
  │      │      ├─► entregue
  │      │      └─► aguardando_devolucao [Fase 5, RN29] (Cliente ou Admin)
  │      │             └─► cancelado [Fase 5, RN30] (somente Admin; restaura estoque)
  │      └─► cancelado (Admin sempre; Cliente também a partir da Fase 5, RN28)
  └─► cancelado (Cliente dono ou Admin; restaura estoque)
```

### `paymentStatus` do Pedido (`PaymentStatus`)

Hoje em produção (Fase 2, RN10-RN15):
- `aguardando_pagamento` — valor inicial, atribuído na criação do pedido junto com a PaymentIntent (RN10).
- `pago` — setado quando o webhook `payment_intent.succeeded` confirma o pagamento (RN12).
- `falhou` — setado quando o webhook `payment_intent.payment_failed` (ou equivalente) é recebido (RN13); o pedido também é cancelado e o estoque restaurado nesse mesmo evento.

**Fase 5 (implementada e em produção)** — RN31/RN32/RN33 adicionam dois novos valores:
- `estorno_pendente` — quando um pedido com `paymentStatus: "pago"` é cancelado por qualquer uma das transições acima que levam a `cancelado` (`confirmado → cancelado` pelo Cliente ou pelo Admin, ou `aguardando_devolucao → cancelado` pelo Admin), `paymentStatus` muda **automaticamente** para `estorno_pendente` (RN31). Essa mudança de `paymentStatus` é o único efeito automático do cancelamento sobre o pagamento — **nenhuma chamada ao Stripe é feita nesse momento**. Um pedido cancelado a partir de `pendente` nunca chega a `estorno_pendente` (ainda não havia cobrança confirmada nesse caso).
- `reembolsado` — só é alcançado através de uma ação **dedicada, manual e exclusiva do Admin**: `PATCH /pedidos/:id/reembolsar` (admin-only, RN32), disponível apenas quando `paymentStatus === "estorno_pendente"`, chama `stripe.refunds.create` pelo valor total do pedido (`pedido.total`, sem reembolso parcial nesta fase). Sucesso → `paymentStatus: "reembolsado"` (o `status` do pedido, já `cancelado`, não muda). Falha na chamada ao Stripe → `paymentStatus` permanece `estorno_pendente` (permite nova tentativa), resposta HTTP 502 (`PaymentGatewayError`, mesmo padrão de RN10).

> **Reembolso nunca é automático.** Nenhuma transição de `status` — nem RN28, nem RN29+RN30, nem o cancelamento já existente do Admin a partir de `pendente` — dispara por si só uma chamada ao Stripe. O cancelamento apenas sinaliza que um reembolso é devido (`paymentStatus: "estorno_pendente"`); efetivá-lo é sempre uma decisão humana explícita e posterior do Admin, através do endpoint `PATCH /pedidos/:id/reembolsar` dedicado a essa ação.

## Arquitetura da Fase 3 (Microsserviços)

> **Status: implementada, deployada em produção real e validada de ponta a ponta (Épico 8.6 do `BACKLOG.md`).** Esta seção documenta a arquitetura da Fase 3 (`SPEC.md` seção "Fase 3", `BACKLOG.md` Módulos 8-12): os 3 serviços (`services/orders/`, `services/payments/`, `services/notifications/`) rodam em produção real (`gscandelari-ecommerce-api`) atrás do Firebase Hosting como API Gateway (`https://gscandelari-ecommerce-api.web.app`), cada um sob sua própria service account de runtime dedicada e menor privilégio (`orders-runtime@`/`payments-runtime@`, Task 9.1.3/9.1.4). O webhook do Stripe (Dashboard, modo teste) foi migrado para a nova URL pública de Payments. **O monólito da Fase 1+2 (`functions/`, codebase `default`, function `api`) foi deliberadamente decomissionado** (Task 8.6.3): removido de `firebase.json` e excluído via `firebase functions:delete api` — a URL antiga não responde mais. O código de `functions/` permanece no repositório como referência histórica (Fases 1, 2 e 5 originais), mas não é mais deployado nem tem workflow de deploy associado.
>
> **Bugs reais encontrados só no deploy real** (nunca pegos pelo Emulator Suite nem pelos testes Jest/Supertest — ver histórico de commits do Épico 8.6 para os detalhes completos de cada um): nome de export precisa ser um identificador JS válido, não um string-literal renomeado; o ID final da function é o identificador exportado, sem namespace automático por codebase (dois codebases exportando o mesmo nome colidem); opções de build-time como `serviceAccount` não podem ler `process.env.X` direto — precisam da API de Parameterized Configuration (`defineString`) porque o `.env.<project-id>` só é carregado numa fase posterior à avaliação dessas opções; e o SDK do Resend não lança exceção em erros de nível de API (retorna `{ data: null, error }`), exigindo checagem explícita do campo `error`.

### Diagrama (arquitetura em produção)

```
                              ┌───────────────────────────┐
        cliente final ─────▶ │  Firebase Hosting           │
                              │  (API Gateway / rewrites)   │
                              └──────────────┬──────────────┘
                                             │
                 ┌────────────────────────────┼────────────────────────────┐
                 │ /produtos/**, /pedidos/**   │ /webhooks/stripe
                 ▼                             ▼
         ┌───────────────┐   HTTP síncrono ┌───────────────┐
         │    Orders      │◀───────────────▶│   Payments     │
         │ (codebase      │  ID token Google │ (codebase      │
         │  "orders")     │  (RN18)          │  "payments")   │
         │                │                  │                │
         │ /produtos      │  RN16: cria      │ /webhooks/     │
         │ /pedidos       │  PaymentIntent    │  stripe        │
         │ /internal/...  │                  │ /internal/     │
         │                │  RN17: efetiva    │  payment-      │
         │                │  transição status  │  intents       │
         └───────┬────────┘                  └───────┬────────┘
                 │ única escrita em `pedidos`         │ nunca escreve em `pedidos`
                 ▼                                    │ (chama Orders via HTTP interno)
         ┌────────────────────────────────────────────┘
         │        Firestore: coleções `pedidos`, `produtos`, `stripeEvents`
         └───────────────────────┬────────────────────────────────────────
                                 │ onDocumentUpdated("pedidos/{id}")
                                 │ (assíncrono, fire-and-forget)
                                 ▼
                        ┌────────────────────┐
                        │   Notifications      │
                        │ (codebase             │
                        │  "notifications")      │
                        │ sem rota HTTP pública   │
                        │ (RN20)                  │
                        │ envia e-mail via Resend │
                        │ (confirmado/cancelado)  │
                        └────────────────────────┘
```

- **Orders** (`services/orders/`): dono exclusivo da coleção `pedidos`. Expõe `/produtos` e `/pedidos` (público, herdado da Fase 1) e `/internal/pedidos/:id/confirmar-pagamento` + `/internal/pedidos/:id/cancelar-por-falha-pagamento` (interno, só chamado por Payments, protegido por ID token Google — RN17/RN18).
- **Payments** (`services/payments/`): integração Stripe + webhook (herdado da Fase 2). Expõe `/webhooks/stripe` (público, Dashboard do Stripe) e `/internal/payment-intents` (interno, só chamado por Orders — RN16/RN18). Nunca escreve na coleção `pedidos`.
- **Notifications** (`services/notifications/`, novo): sem nenhuma rota HTTP pública ou interna (RN20). Reage a mudanças de `status` em `pedidos` via Firestore Trigger (`onDocumentUpdated`) e envia e-mail (Resend, sempre modo teste/sandbox) quando o pedido é confirmado ou cancelado — best-effort, nunca reverte a transição já efetivada por Orders (RN19).
- **API Gateway** (Firebase Hosting `rewrites`, Módulo 11): único domínio público, roteando `/produtos`/`/pedidos` → Orders e `/webhooks/stripe` → Payments (RN20).
- Comunicação **Orders ↔ Payments**: HTTP síncrona interna, autenticada via ID token assinado pelo Google (OIDC nativo do GCP, não Firebase Auth) — RN18. Comunicação para **Notifications**: assíncrona via Firestore Trigger, fire-and-forget — assimetria deliberada (ver `BACKLOG.md`, Decisões técnicas da Fase 3).

### Como rodar os 3 novos serviços localmente (Emulator Suite multi-codebase)

1. Instalar as dependências de cada serviço (independentes entre si, cada um com seu próprio `package.json`/`package-lock.json`):
   ```bash
   cd services/orders && npm install && cd ../..
   cd services/payments && npm install && cd ../..
   cd services/notifications && npm install && cd ../..
   ```
2. `firebase.json` declara um array `codebases` com `orders` (`services/orders`), `payments` (`services/payments`) e `notifications` (`services/notifications`) — o codebase `default` (`functions/`, monólito) foi removido daqui no Épico 8.6 (Task 8.6.3), embora o código continue no repositório. Suba os 3 codebases simultaneamente a partir da raiz do repositório:
   ```bash
   npx firebase-tools emulators:start
   ```
   Isso sobe Auth + Firestore + Functions (3 codebases) + Hosting (gateway, Módulo 11) no mesmo Emulator UI (`localhost:4000`), sempre contra o projeto demo `demo-gscandelari-ecommerce-api` — nunca um projeto real.
3. Convenção de nomes de export por codebase (Task 8.5.2 — **correção pós-Épico 8.6**: codebases diferentes NÃO namespaceiam/prefixam o ID da function automaticamente; o ID final é literalmente o nome do identificador exportado em `index.ts`, e precisa ser único entre *todos* os codebases do projeto, não só dentro do próprio. Um primeiro deploy real com `export const api` em `orders` e `payments` falhou com `More than one codebase claims functions/api`, algo que o Emulator Suite nunca detecta): `ordersApi`, `paymentsApi`, `onPedidoStatusChange` (Notifications).
4. Cada serviço tem sua própria suíte de testes, lint e build, todos verdes (mesmo padrão do `ci-services.yml`):
   ```bash
   cd services/orders && npm run lint && npm run build && npm run test:coverage:emulator
   cd services/payments && npm run lint && npm run build && npm run test:coverage:emulator
   cd services/notifications && npm run lint && npm run build && npm run test:coverage:emulator
   ```
5. Roteiro de validação local ponta a ponta: criar pedido (Orders) → chamada interna síncrona a Payments cria a PaymentIntent → simular evento de webhook do Stripe (CLI `stripe listen`/`stripe trigger` apontando para o Payments local) → chamada interna síncrona de Payments a Orders efetiva a transição de status → Firestore Trigger dispara Notifications → e-mail via Resend (modo sandbox) — tudo dentro do emulador, sem tocar rede/projeto real além dos SDKs mockados nos testes automatizados.

### Segredo novo: `RESEND_API_KEY` (Resend, modo teste/sandbox)

Fase 3 introduz o primeiro segredo do serviço Notifications: a chave de API do [Resend](https://resend.com), usada para enviar o e-mail de confirmação/cancelamento de pedido (RN19). Como os demais segredos do projeto (`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`, Fase 2), é sempre uma chave de **modo teste/sandbox** — este projeto de portfólio nunca envia e-mail para destinatários reais fora de teste.

**Como obter (gratuito, sem cartão de crédito, sem verificar domínio):**
1. Crie uma conta em [resend.com/signup](https://resend.com/signup).
2. No Dashboard, vá em **API Keys > Create API Key**, dê um nome (ex.: `gscandelari-ecommerce-api-dev`) e copie a chave gerada (formato `re_...`). Trate-a com o mesmo cuidado de qualquer outro segredo deste projeto — nunca cole em código, commit, PR, issue ou log.
3. **Sem verificar um domínio próprio**, o Resend só permite enviar e-mails para o endereço cadastrado na sua própria conta, usando o remetente de sandbox `onboarding@resend.dev` — suficiente para o propósito deste projeto e equivalente, em espírito, ao modo teste/sandbox já usado com o Stripe.

**Configuração local (Emulator Suite)** — mesmo padrão já usado para `STRIPE_SECRET_KEY` na Fase 2:
1. Copie o arquivo de exemplo:
   ```bash
   cd services/notifications
   cp .env.example .env
   ```
2. Edite `services/notifications/.env` e preencha `RESEND_API_KEY` com a chave de teste/sandbox obtida acima.
3. Os testes Jest de Notifications nunca usam esse valor real: o SDK do Resend é sempre mockado (`services/notifications/test/helpers/mockResend.ts`, mesmo padrão de `mockStripe.ts` da Fase 2) — o valor real só é necessário para o teste manual descrito na próxima seção.

**Configuração em produção (Firebase Secret Manager)** — mesmo mecanismo já usado para os segredos do Stripe:
```bash
firebase functions:secrets:set RESEND_API_KEY
# cole a chave de teste/sandbox (re_...) quando solicitado — nunca fica em texto no shell/histórico
```
Referenciado na definição da Cloud Function `onPedidoStatusChange` (opção `secrets`, 2ª geração) — mesmo mecanismo documentado em [Variáveis de ambiente e segredos](#variáveis-de-ambiente-e-segredos). Este segredo é configurado independentemente dos segredos já existentes de Payments (`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`) e nunca precisa ser acessível por Orders ou Payments (princípio de menor privilégio, Task 9.1.4). Já configurado em produção real desde o Épico 8.6 — os testes automatizados continuam usando exclusivamente o mock do SDK do Resend, nunca o valor real.

> **Nota (Épico 8.6):** o SDK do Resend não lança exceção em erros de nível de API (`emails.send()` devolve `{ data: null, error }`) — o código de `onPedidoStatusChange.ts` checa esse campo explicitamente e loga via `console.error` quando presente, sem propagar (best-effort, RN19). Sem essa checagem, uma rejeição da API (ex.: sandbox recusando o destinatário) passaria batido, sem nenhum log — foi exatamente o que aconteceu no smoke test real do corte de produção, só corrigido depois de inspecionar os logs de produção com atenção.

### Como testar o fluxo de notificação por e-mail manualmente

Pré-requisito: `RESEND_API_KEY` real (modo sandbox) configurada em `services/notifications/.env` (Orders + Notifications já rodam normalmente no emulador, ver seção acima).

1. Suba o Emulator Suite multi-codebase (seção acima).
2. Crie um usuário no Auth Emulator cujo e-mail seja o mesmo cadastrado na sua conta Resend (restrição do modo sandbox sem domínio verificado, ver acima) e crie um pedido autenticado via `POST /pedidos` (Orders).
3. Efetive a confirmação do pagamento — via admin (`PATCH /pedidos/:id/status` para `confirmado`) ou simulando o webhook do Stripe local apontando para o Payments do emulador.
4. `onPedidoStatusChange` (Notifications) dispara automaticamente ao detectar a mudança de `status` para `confirmado`; confira o e-mail recebido e/ou o log de envios em [resend.com/emails](https://resend.com/emails) no Dashboard (mostra todo envio, inclusive em modo sandbox).
5. Repita cancelando um pedido em `pendente` para validar o e-mail de cancelamento.
6. Confirme a cláusula best-effort de RN19: force uma falha (ex.: `RESEND_API_KEY` inválida) e confirme, pelo Firestore Emulator UI, que o pedido permanece `confirmado`/`cancelado` normalmente — a falha de e-mail nunca reverte ou bloqueia a transição de status já efetivada por Orders.

### Corte de produção — como foi executado (Épico 8.6, concluído)

A Fase 3 **nunca decomissionou o monólito como parte do trabalho normal de implementação** — só depois de todo o resto validado, com aprovação explícita do usuário a cada etapa sensível. Sequência real executada (detalhada no Épico 8.6 do `BACKLOG.md`):

1. Todo o trabalho aconteceu isolado em `feat/fase-3-microservicos`, validado 100% localmente (Emulator Suite multi-codebase + suíte de testes por serviço) antes de qualquer deploy real.
2. PR revisado e mesclado em `main` (PR #1) só depois da suíte completa verde (Módulo 12) — o merge em si **não** deployou nada. Deploy real ficou deliberadamente pendente por um bom tempo depois do merge, até decisão explícita do usuário de promover o projeto.
3. Deploy real dos 3 novos codebases + Hosting com `--only` explícito (`firebase deploy --only functions:orders,functions:payments,functions:notifications,hosting`) — nunca tocou o codebase `default` durante o deploy; a function `api` da Fase 1+2 continuou servindo tráfego real ininterruptamente até a etapa 5. Descobriu e corrigiu 3 bugs reais de deploy nunca pegos pelo Emulator Suite/testes (ver [Bugs reais encontrados no corte de produção da Fase 3](#deploy) acima).
4. Smoke test completo em produção real pelo **novo** caminho — pedido criado → PaymentIntent real via chamada interna Orders→Payments → pago com cartão de teste → migração manual da URL do webhook no Dashboard/API do Stripe (modo teste) para a nova URL pública de Payments → webhook confirmou o pedido via chamada interna Payments→Orders → e-mail via Resend confirmado no destinatário real (achou e corrigiu o 4º bug real, no SDK do Resend). Dados de teste removidos depois.
5. **Só depois** do smoke test validado e de uma confirmação explícita e fresca do usuário, o codebase `default` foi removido de `firebase.json` e a function `api` explicitamente deletada (`firebase functions:delete api`) — decomissionamento deliberado, nunca automático. `.../api/health` responde 404 desde então.

Nenhuma das etapas de produção real acima foi disparada automaticamente por CI — todas via CLI local ou `workflow_dispatch`, sempre com aprovação humana explícita antes de qualquer ação irreversível.

## Front-end de testes (Fase 4) — `web/`

> **Status:** implementada (Módulos 13-17 do `BACKLOG.md`, seção "Fase 4"). Lint, build e testes (Vitest + React Testing Library, 30/30 passando) verdes localmente e no `ci-web.yml`.

SPA em **React + Vite + TypeScript**, ferramenta de teste/demonstração da API já construída nas Fases 1-2 (`functions/`) — não é o produto final do portfólio. Roda **exclusivamente contra o Firebase Emulator Suite local** (RN27): nunca aponta para o projeto Firebase real (`gscandelari-ecommerce-api`, alias `production`). Dois perfis de uso na mesma aplicação: **Cliente** (catálogo, criação de pedido, pagamento via Stripe Elements, histórico/cancelamento — RN21-RN24) e **Administrador**, via custom claim `admin: true` (CRUD de Produtos e gestão de Pedidos — RN25).

### Como rodar `web/` junto com o Emulator Suite

São **dois processos**, em dois terminais separados:

1. **Terminal 1 — Emulator Suite**, a partir da **raiz do repositório** (onde está `firebase.json`):
   ```bash
   npx firebase-tools emulators:start
   ```
   Sobe Auth (`localhost:9099`), Firestore (`localhost:8080`) e Functions/`api` (`localhost:5001`) — mesmo comando já usado para desenvolver `functions/` (ver [Como rodar localmente](#como-rodar-localmente) acima). Confirme que a API responde antes de seguir:
   ```bash
   curl http://localhost:5001/demo-gscandelari-ecommerce-api/us-central1/api/health
   ```
2. **Terminal 2 — front-end**, a partir de `web/`:
   ```bash
   cd web
   npm install
   cp .env.example .env      # se ainda não existir; valores padrão já funcionam contra o emulador
   npm run dev
   ```
   Abra a URL impressa pelo Vite (padrão `http://localhost:5173`).

Se o Emulator Suite não estiver rodando, o cliente HTTP do front-end (`src/api/apiClient.ts`) detecta a falha de `fetch` e exibe a mensagem "Não foi possível conectar à API. Verifique se o Firebase Emulator Suite está rodando (`firebase emulators:start`)." em vez de travar silenciosamente — comportamento intencional (Decisão técnica 2 do `BACKLOG.md`, base de RN27).

### Criar um cliente de teste e promovê-lo a admin

A área de Administrador (RN25) exige a custom claim `admin: true` no Auth Emulator, exatamente como já é feito para testar `functions/` manualmente (`functions/scripts/setAdminClaim.js`, Task 2.2.3). Passo a passo:

1. Com os dois processos acima rodando, cadastre um usuário normalmente pela UI (`/cadastro` em `web/`, ou pela tela de login/cadastro) — ele nasce sem a claim, ou seja, `isAdmin === false`.
2. Em outro terminal, promova esse e-mail a admin no Auth Emulator usando o script já existente em `functions/`:
   ```bash
   cd functions
   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 npm run set-admin -- email@exemplo.com
   ```
   O script (`functions/scripts/setAdminClaim.js`) recusa-se a rodar sem `FIREBASE_AUTH_EMULATOR_HOST` definido, exatamente para nunca ser usado por engano contra um projeto real.
3. **A claim setada no passo 2 não aparece automaticamente na sessão já aberta no navegador** — o token em cache do SDK do Firebase Auth só se renova sozinho a cada ~1h. Para refletir a claim na UI, faça uma das duas opções:
   - Deslogue e logue novamente em `web/` (o `AuthContext` força `getIdTokenResult(forceRefresh: true)` logo após login, ver Decisão técnica 3 do `BACKLOG.md`); ou
   - Se a aplicação expuser um gatilho de `refreshClaims()` (ex. botão "Atualizar permissões" ou chamado automaticamente em algum ponto da UI), acione-o sem precisar deslogar.
4. Com `isAdmin === true`, os links/rotas de admin (`/admin/produtos`, `/admin/pedidos`) ficam visíveis e acessíveis.

Lembre-se: a claim de admin controla apenas a *exibição* das rotas no front-end (RN26, só UX) — o backend (`requireAdmin`) continua sendo a única fonte real de autorização, com ou sem o front-end.

### (Opcional) Stripe CLI — fechar o ciclo RN23 + RN12 (confirmação automática de pagamento)

Ao completar um pagamento de teste no `PaymentForm` (Stripe Elements, cartão `4242 4242 4242 4242`), o `confirmCardPayment` do Stripe.js confirma o pagamento **no Stripe** — isso já exercita RN23 de ponta a ponta isoladamente, sem nenhum passo extra. Porém, a **transição do status do pedido** para `confirmado` é uma regra separada (RN12, Fase 2) e só acontece quando o backend recebe o webhook `POST /webhooks/stripe`. Como o Emulator Suite roda em `localhost`, o Stripe (serviço externo) não consegue entregar esse webhook diretamente — é necessário o [Stripe CLI](https://docs.stripe.com/stripe-cli) fazendo o encaminhamento:

```bash
stripe listen --forward-to http://localhost:5001/demo-gscandelari-ecommerce-api/us-central1/api/webhooks/stripe
```

Rode esse comando em um terceiro terminal, autenticado (`stripe login`) na mesma conta Stripe cuja chave de teste está em `functions/.env` (`STRIPE_SECRET_KEY`) — o `stripe listen` imprime um signing secret temporário (`whsec_...`); copie-o para `STRIPE_WEBHOOK_SECRET` em `functions/.env` (reinicie o Emulator Suite após editar) para a assinatura do webhook ser validada corretamente.

- **Sem o Stripe CLI rodando:** o pagamento é confirmado no Stripe, mas o pedido permanece `pendente` até um Admin alterar o status manualmente pela área de admin (RN25) — comportamento esperado da ferramenta de teste, não um bug. A tela de confirmação de pagamento do front-end deixa esse comportamento explícito.
- **Com o Stripe CLI rodando:** o webhook é entregue, `POST /webhooks/stripe` confirma o pedido automaticamente e o status muda para `confirmado` sem nenhuma ação manual — fechando o ciclo RN23 (front-end) + RN12 (backend, Fase 2) de ponta a ponta.

Este passo é **opcional** para exercitar RN23 isoladamente; é **necessário** apenas para observar o fechamento automático do ciclo RN23+RN12.

## Contribuindo

Convenção de commits (Conventional Commits), estratégia de branching (GitHub Flow) e processo de Pull Request estão documentados em [`CONTRIBUTING.md`](./CONTRIBUTING.md).
