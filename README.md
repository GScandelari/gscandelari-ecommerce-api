# gscandelari-ecommerce-api

API REST de e-commerce (Produtos, Pedidos, Clientes). Projeto de portfólio, em produção real.

Arquitetura de **microsserviços em Firebase Cloud Functions (2ª geração) + Express + TypeScript + Firestore**, com três serviços independentes (Orders, Payments, Notifications) atrás de um API Gateway (Firebase Hosting), autenticação via **Firebase Auth** (papéis `cliente`/`admin` via custom claims) e integração de pagamento real via **Stripe** (sempre em modo teste/sandbox). A especificação completa está em [`SPEC.md`](./SPEC.md) e o backlog de tasks em [`BACKLOG.md`](./BACKLOG.md).

**No ar:** [`https://gscandelari-ecommerce-api.web.app`](https://gscandelari-ecommerce-api.web.app) · **Documentação interativa (Swagger UI):** [`/docs`](https://gscandelari-ecommerce-api.web.app/docs)

## Sumário

- [Visão geral](#visão-geral)
- [Arquitetura](#arquitetura)
- [Pré-requisitos](#pré-requisitos)
- [Como rodar localmente](#como-rodar-localmente)
- [Variáveis de ambiente e segredos](#variáveis-de-ambiente-e-segredos)
- [Como rodar os testes](#como-rodar-os-testes)
- [Lint e build](#lint-e-build)
- [Estrutura do projeto](#estrutura-do-projeto)
- [CI/CD](#cicd)
- [Deploy](#deploy)
- [Integração de pagamento (Stripe)](#integração-de-pagamento-stripe)
- [Notificações por e-mail (Resend)](#notificações-por-e-mail-resend)
- [Máquina de estados do Pedido — status e pagamento](#máquina-de-estados-do-pedido--status-e-pagamento)
- [Front-end de testes — `web/`](#front-end-de-testes--web)
- [Notas de engenharia](#notas-de-engenharia)
- [Contribuindo](#contribuindo)

## Visão geral

A API cobre o ciclo completo de um pedido de e-commerce:

- **Catálogo de produtos.** CRUD completo, admin-only para escrita.
- **Pedidos.** Criação com decremento transacional de estoque, máquina de estados (`pendente → confirmado → enviado → entregue`, com ramos de cancelamento e devolução).
- **Pagamento real (modo teste).** Cada pedido gera uma PaymentIntent no Stripe. Confirmação e falha de pagamento chegam via webhook assinado, com idempotência.
- **Cancelamento e reembolso.** Cancelamento pelo Cliente ou Admin conforme o estado do pedido. Reembolso via Stripe é sempre ação manual e deliberada do Admin, nunca automática.
- **Notificações.** E-mail (Resend) ao cliente quando o pedido é confirmado ou cancelado, best-effort: nunca bloqueia a transição de status.
- **Autenticação e autorização.** Firebase Auth, com custom claim `admin` controlando rotas administrativas no backend (fonte real de verdade) e na UI.
- **Documentação viva.** OpenAPI/Swagger em `/docs`, gerada a partir do código.

Todo o código é testado com Jest + Supertest contra o Firebase Emulator Suite (Auth e Firestore reais localmente, nunca mocks para essas duas peças), com CI verde em todo PR e push para `main`.

## Arquitetura

Três serviços independentes, cada um com seu próprio `package.json`, `tsconfig` e suíte de testes, atrás de um único domínio público:

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

- **Orders** (`services/orders/`): dono exclusivo da coleção `pedidos`. Expõe `/produtos` e `/pedidos` (público) e `/internal/pedidos/:id/confirmar-pagamento` + `/internal/pedidos/:id/cancelar-por-falha-pagamento` (interno, só chamado por Payments, protegido por ID token Google, RN17/RN18).
- **Payments** (`services/payments/`): toda a integração com o Stripe vive aqui. Expõe `/webhooks/stripe` (público, Dashboard do Stripe) e `/internal/payment-intents` + `/internal/refunds` (interno, só chamado por Orders, RN16/RN18). Nunca escreve na coleção `pedidos`.
- **Notifications** (`services/notifications/`): sem nenhuma rota HTTP pública ou interna (RN20). Reage a mudanças de `status` em `pedidos` via Firestore Trigger (`onDocumentUpdated`) e envia e-mail (Resend, sempre modo teste/sandbox) quando o pedido é confirmado ou cancelado. Best-effort: nunca reverte a transição já efetivada por Orders (RN19).
- **API Gateway** (Firebase Hosting `rewrites`): único domínio público, roteando `/produtos`/`/pedidos` para Orders e `/webhooks/stripe` para Payments (RN20).
- Comunicação **Orders ↔ Payments**: HTTP síncrona interna, autenticada via ID token assinado pelo Google (OIDC nativo do GCP, não Firebase Auth, RN18), verificado contra uma allow-list de e-mail de service account. Cada serviço roda sob sua própria service account de runtime, com o mínimo de permissão IAM necessária (`orders-runtime@`, `payments-runtime@`). Comunicação para **Notifications**: assíncrona via Firestore Trigger, fire-and-forget.

## Pré-requisitos

- [Node.js 20](https://nodejs.org/) (mesma versão declarada em `engines.node` de cada serviço e usada pelo runtime das Cloud Functions)
- npm (instalado junto com o Node.js)
- Java 21+, exigido pelo Firestore/Auth Emulator na versão atual do `firebase-tools` (verifique com `java -version`)
- Não é necessário instalar o Firebase CLI globalmente. Ele é uma devDependency de cada serviço (`firebase-tools`) e é usado via `npx firebase-tools` nos scripts do `npm` e no CI. Se preferir um CLI global (`npm install -g firebase-tools`), também funciona.

## Como rodar localmente

Os emuladores usam sempre o projeto Firebase de demonstração `demo-gscandelari-ecommerce-api`, **nunca** um projeto real. Isso é automático via `singleProjectMode` em `firebase.json` e o prefixo `demo-` (reconhecido pelo Firebase CLI como "não é um projeto real, não requer credenciais nem gera cobrança").

1. Instalar as dependências de cada serviço (independentes entre si, cada um com seu próprio `package.json`/`package-lock.json`):
   ```bash
   cd services/orders && npm install && cd ../..
   cd services/payments && npm install && cd ../..
   cd services/notifications && npm install && cd ../..
   ```
2. Subir o Firebase Emulator Suite (Auth + Firestore + Functions dos 3 codebases + Hosting) a partir da **raiz do repositório** (onde está `firebase.json`):
   ```bash
   npx firebase-tools emulators:start
   ```
   Isso sobe:
   - Auth Emulator: `localhost:9099`
   - Firestore Emulator: `localhost:8080`
   - Functions Emulator (`ordersApi`, `paymentsApi`, `onPedidoStatusChange`): `localhost:5001`
   - Hosting Emulator (API Gateway): `localhost:5000`
   - Emulator UI: `localhost:4000`
3. Testar a API rodando, via Hosting (mesma URL que a produção usa) ou direto na function do Emulator:
   ```bash
   curl http://localhost:5000/health
   # ou, direto na function:
   curl http://localhost:5001/demo-gscandelari-ecommerce-api/us-central1/ordersApi/health
   ```
4. Documentação interativa (Swagger UI): abra `http://localhost:5000/docs` no navegador.

Cada serviço exporta seu app Express puro (`src/app.ts`), então também dá pra exercitá-lo direto via Supertest nos testes (ver seção seguinte), sem precisar do Functions Emulator. Mas para o fluxo real de ponta a ponta — Auth, Firestore, comunicação interna entre serviços — use `emulators:start` como acima.

### Roteiro de validação local ponta a ponta

Criar pedido no Orders. A chamada interna síncrona a Payments cria a PaymentIntent (RN16). Simular um evento de webhook do Stripe ([Stripe CLI](https://docs.stripe.com/stripe-cli) `stripe listen`/`stripe trigger` apontando para Payments local). A chamada interna síncrona de Payments a Orders efetiva a transição de status (RN17). O Firestore Trigger dispara Notifications, que manda e-mail via Resend (modo sandbox). Tudo dentro do emulador, sem tocar rede ou projeto real além dos SDKs mockados nos testes automatizados.

## Variáveis de ambiente e segredos

**Nenhum segredo é commitado neste repositório.** O `.gitignore` da raiz já exclui arquivos `.env*`, `*serviceAccount*.json` e afins.

### Local / desenvolvimento (Emulator Suite)

Ao rodar via `emulators:start` ou `emulators:exec`, o Firebase CLI injeta automaticamente as variáveis abaixo nos processos filhos. **Nada precisa ser configurado manualmente:**

| Variável | Descrição |
|---|---|
| `FIRESTORE_EMULATOR_HOST` | Host:porta do Firestore Emulator (`localhost:8080`) |
| `FIREBASE_AUTH_EMULATOR_HOST` | Host:porta do Auth Emulator (`localhost:9099`) |
| `GCLOUD_PROJECT` | ID do projeto Firebase (demo) |

Cada serviço também tem seu próprio `.env.example` (`services/<serviço>/.env.example`), documentando as variáveis específicas: comunicação interna (URLs/e-mails de service account), flags de conveniência para o emulador, e assim por diante.

### Segredos de aplicação (runtime, projeto real)

Todos sempre em **modo teste/sandbox**, nunca chaves de modo live/produção. Este projeto de portfólio não processa dinheiro real nem envia e-mail para destinatários fora de teste:

| Variável | Descrição | Onde é usada |
|---|---|---|
| `STRIPE_SECRET_KEY` | Chave secreta de **teste** do Stripe (sempre `sk_test_...`) | `services/payments/src/stripeService.ts` |
| `STRIPE_WEBHOOK_SECRET` | Signing secret do endpoint de webhook (`whsec_...`), valida a assinatura `stripe-signature` | `services/payments/src/routes/webhooks.routes.ts` |
| `RESEND_API_KEY` | Chave de API de **teste/sandbox** do [Resend](https://resend.com) | `services/notifications/src/triggers/onPedidoStatusChange.ts` |

Todo segredo de aplicação é criado via Firebase Secret Manager, **nunca em `.env` commitado**:

```bash
firebase functions:secrets:set NOME_DO_SEGREDO
# valor é digitado interativamente, nunca fica em texto no shell/histórico
```

Fica referenciado no código via a opção `secrets` do `onRequest`/`onDocumentUpdated` (2ª geração), conforme a [documentação oficial do Firebase](https://firebase.google.com/docs/functions/config-env?gen=2#secret-manager). O passo a passo completo está em [Integração de pagamento (Stripe)](#integração-de-pagamento-stripe) e [Notificações por e-mail (Resend)](#notificações-por-e-mail-resend), mais abaixo.

### Config não-secreta por projeto (`.env.<project-id>`)

`services/orders/.env.gscandelari-ecommerce-api` e `services/payments/.env.gscandelari-ecommerce-api` são **commitados** (convenção nativa do Firebase Functions 2ª geração: só é carregado quando o deploy ou runtime alvo é esse projeto real específico, nunca no emulador). Contêm URLs de comunicação interna e e-mails de service account. Não é segredo, por isso está versionado, ao contrário dos demais `.env*`.

### Front-end (`web/`) — variáveis de build (Vite)

O front-end de testes (ver [seção dedicada](#front-end-de-testes--web) mais abaixo) usa suas próprias variáveis, documentadas em `web/.env.example`. Nenhuma delas é um segredo de runtime como as do Stripe acima (a chave publicável do Stripe é, por definição, feita para ser exposta em código de browser), mas seguem a mesma convenção de nunca serem commitadas com valor real.

| Variável | Descrição |
|---|---|
| `VITE_FIREBASE_PROJECT_ID` | Sempre `demo-gscandelari-ecommerce-api`, deve começar com `demo-` (RN27). `src/lib/firebase.ts` recusa inicializar e interrompe o boot se essa condição não for atendida |
| `VITE_FIREBASE_API_KEY` / `VITE_FIREBASE_AUTH_DOMAIN` / `VITE_FIREBASE_APP_ID` | Config do Firebase Web App exigida pelo SDK do client (`initializeApp`). Como o app só fala com o Auth Emulator, valores placeholder funcionam sem precisar de um Web App real cadastrado no Console |
| `VITE_AUTH_EMULATOR_URL` | URL do Auth Emulator (`http://localhost:9099`), usada por `connectAuthEmulator` |
| `VITE_API_BASE_URL` | URL base da function `ordersApi` (única que expõe `/produtos`/`/pedidos`) servida pelo Functions Emulator |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Chave publicável de **teste** do Stripe (`pk_test_...`), mesma conta usada para `STRIPE_SECRET_KEY` (ver acima) |

Copie `web/.env.example` para `web/.env` antes de rodar `npm run dev` em `web/`.

### Credenciais de deploy (CI/CD)

Para o workflow de deploy (`.github/workflows/deploy-services.yml`) autenticar no Firebase, é necessário o GitHub Actions Secret abaixo, **já configurado** neste repositório:

| Secret | Descrição |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | JSON da Service Account `github-actions-deploy@gscandelari-ecommerce-api.iam.gserviceaccount.com`, com os papéis listados na seção [Deploy](#deploy) abaixo. Gerado em Console do Google Cloud > IAM & Admin > Service Accounts > Keys. Configurado em GitHub > Settings > Secrets and variables > Actions. |

Esse secret **nunca** é impresso em log (o GitHub Actions mascara automaticamente valores de secret) e é escrito num arquivo temporário do runner, removido ao final do job de deploy.

## Como rodar os testes

Cada serviço tem sua própria suíte, independente dos demais:

```bash
cd services/orders   # ou payments / notifications

# Suíte Jest + Supertest "crua" (sem subir o emulador — só faz sentido para
# testes que não dependem de Auth/Firestore reais)
npm test

# Mesma suíte, mas subindo automaticamente Auth + Firestore Emulator antes,
# rodando os testes contra eles, e derrubando os emuladores ao final
# (propaga falha via exit code) — este é o comando recomendado/"oficial"
npm run test:emulator

# Com relatório de cobertura (threshold mínimo de 70%)
npm run test:coverage
npm run test:coverage:emulator
```

**Estado atual:** todas as suítes passam, com cobertura acima da meta de 70% definida no `SPEC.md`.

## Lint e build

```bash
cd services/orders   # ou payments / notifications
npm run build          # compila TypeScript (tsconfig.build.json) + resolve o path alias @/ via tsc-alias
npm run lint            # ESLint (flat config, typescript-eslint)
npm run format:check    # Prettier (use `npm run format` para corrigir)
```

## Estrutura do projeto

```
.
├── firebase.json              # config do Firebase CLI (Functions dos 3 codebases, Hosting, Firestore, Emulator Suite)
├── .firebaserc                # alias de projeto(s) Firebase
├── firestore.rules            # regras do Firestore (deny-all client SDK; acesso só via Admin SDK)
├── firestore.indexes.json     # índices compostos do Firestore
├── SPEC.md                    # especificação técnica aprovada (fonte da verdade de negócio)
├── BACKLOG.md                 # decomposição em épicos/tasks rastreáveis às RNs
├── CONTRIBUTING.md            # convenção de commits e estratégia de branching
├── public/                    # Firebase Hosting: página institucional do projeto
├── .github/workflows/         # pipelines de CI (lint+testes) e CD (deploy manual)
├── web/                        # front-end de testes (React + Vite + TS),
│                                 # só contra o Emulator Suite local (RN27). Ver
│                                 # "Front-end de testes" para detalhes.
└── services/
    ├── orders/                 # produtos + pedidos (RN01-RN09, RN16-RN18)
    ├── payments/                # Stripe + webhook (RN10-RN15, RN16-RN18)
    └── notifications/            # e-mail via Resend, sem rota HTTP (RN19-RN20)
        # cada um com seu próprio:
        ├── src/
        │   ├── app.ts             # app Express (rotas + error handler) — orders/payments
        │   ├── index.ts            # entry point da Cloud Function HTTPS/Firestore Trigger 2ª geração
        │   ├── routes/               # rotas públicas + internas (verifyInternalToken)
        │   ├── services/               # regras de negócio, máquina de status, clientes HTTP internos
        │   ├── repositories/            # acesso ao Firestore
        │   ├── middlewares/              # authenticate, requireAdmin, validate, errorHandler
        │   ├── schemas/                   # schemas Zod
        │   ├── models/                     # interfaces de domínio
        │   ├── errors/                      # AppError e subclasses
        │   └── firebaseAdmin.ts              # singleton do Admin SDK (emulator-aware)
        ├── test/                    # unit/, integration/, helpers/ (Jest + Supertest)
        ├── package.json / tsconfig.json / tsconfig.build.json
        └── jest.config.js            # coverage threshold 70%
```

## CI/CD

Workflows em `.github/workflows/`:

- **`ci-services.yml`**: roda lint/build/test **de forma independente** para cada um dos 3 serviços (`services/orders/`, `services/payments/`, `services/notifications/`), via matrix job, em todo Pull Request e todo push para `main`. Nenhuma etapa toca um projeto Firebase real. **Check obrigatório** configurado na proteção da branch `main` (ver `CONTRIBUTING.md`).
- **`deploy-services.yml`**: deploy manual (`workflow_dispatch`, campo de confirmação obrigatório, `environment: production`) para os 3 codebases + Hosting. Reexecuta lint/build/test antes de `firebase deploy --only functions:orders,functions:payments,functions:notifications,hosting`.
- **`ci-web.yml`**: mesmo padrão de `ci-services.yml`, aplicado a `web/`. `npm ci`, lint, `format:check` (Prettier), build (TypeScript + Vite) e testes (Vitest + React Testing Library, com `fetch`/Firebase Auth mockados, nunca depende do Emulator Suite rodando em CI). **Sem step de deploy**: `web/` não é publicada, é uso local/experimentação contra o Emulator Suite. Não é um check obrigatório de branch protection.

## Deploy

### Estado atual

- **Projeto Firebase (Blaze):** `gscandelari-ecommerce-api` ([console](https://console.firebase.google.com/project/gscandelari-ecommerce-api/overview)), alias `production` em `.firebaserc`.
- **API Gateway (Firebase Hosting):** `https://gscandelari-ecommerce-api.web.app` (`/produtos`, `/pedidos`, `/docs`, `/health`, `/webhooks/stripe`).
- **Política de limpeza do Artifact Registry** configurada (`firebase functions:artifacts:setpolicy`, imagens de container antigas removidas após 1 dia), pra evitar custo de armazenamento acumulado.
- **Deploy via GitHub Actions** (`deploy-services.yml`): `workflow_dispatch`, secret `FIREBASE_SERVICE_ACCOUNT_KEY` configurado, reexecuta lint/build/test dos 3 serviços antes de `firebase deploy --only functions:orders,functions:payments,functions:notifications,hosting`.
- **Branch protection** ativa em `main` (PR obrigatório + check de CI obrigatório).
- Segredos do Stripe (`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`, modo teste) e do Resend (`RESEND_API_KEY`, modo sandbox) configurados no Firebase Secret Manager, acessíveis apenas pelas service accounts de runtime que precisam deles: `payments-runtime@` para o Stripe, a function de Notifications para o Resend.
- Cada função HTTPS/trigger roda sob sua própria service account de runtime, com o mínimo de permissão IAM necessária (`orders-runtime@`, `payments-runtime@`). Nunca a service account default do Compute Engine.
- **Validado de ponta a ponta em produção real** (modo teste do Stripe): pedido criado, PaymentIntent real via chamada interna Orders→Payments (RN16), pago via cartão de teste, webhook do Stripe confirmou o pedido via chamada interna Payments→Orders (RN17), e-mail real via Resend confirmado no destinatário, cancelamento, reembolso via `PATCH /pedidos/:id/reembolsar` com refund `succeeded` conferido diretamente na API do Stripe. Os dados de teste usados nessa validação foram removidos depois.

**Papéis da Service Account de deploy** (`github-actions-deploy@gscandelari-ecommerce-api.iam.gserviceaccount.com`): Cloud Functions Admin, Cloud Run Admin, Artifact Registry Administrator, Cloud Build Editor, Service Account User, Firebase Admin, Service Usage Admin, Secret Manager Secret Accessor, Secret Manager Admin.

### Pré-requisitos de provisionamento de um projeto Firebase real do zero

Passo único, manual, via Console. Nenhum deles é necessário para os Emulators locais, que já vêm com Auth/Firestore prontos por padrão:

1. **Firebase Authentication.** Habilitar em Console > Authentication > "Get started" > provedor **Email/senha**.
2. **Cloud Firestore API.** Habilitar em [console.developers.google.com/apis/api/firestore.googleapis.com](https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=gscandelari-ecommerce-api).
3. **Banco de dados Firestore.** Console > Firestore Database > "Create database", modo **Native**, mesma região das Cloud Functions (`us-central1`). O ID do banco precisa ficar literalmente `(default)`. O Admin SDK só enxerga esse nome sem configuração adicional; um ID customizado causa `NOT_FOUND` silencioso.
4. **`firestore.rules`/`firestore.indexes.json`.** `firebase deploy --only firestore --project production`. O Admin SDK (usado por toda a API) ignora as rules de qualquer forma, mas deployá-las fecha o acesso via Client SDK, que é a postura de segurança pretendida.

### Decisão registrada: deploy MANUAL

O deploy a partir de `main` é **manual**, disparado via `workflow_dispatch` (botão "Run workflow" no GitHub Actions, com um campo de confirmação obrigatório) ou via CLI local. Nunca automático a cada merge em `main`. Um gatilho manual dá a um humano a chance de decidir *quando* colocar uma versão em produção, mantendo `main` sempre *deployável* — princípio central do GitHub Flow.

### Deploy manual via GitHub Actions

1. Garanta que `main` está com o CI verde (badge/check do workflow `ci-services.yml`).
2. Vá em GitHub > Actions > workflow **"Deploy Microsserviços"** > "Run workflow", selecione a branch `main`, digite `deploy` no campo de confirmação e execute.
3. O workflow reexecuta lint, build e testes dos 3 serviços antes de deployar, e então roda `firebase deploy --only functions:orders,functions:payments,functions:notifications,hosting`.

### Deploy manual via Firebase CLI (local)

```bash
cd services/orders && npm run build && npm run test:emulator && cd ../..
cd services/payments && npm run build && npm run test:emulator && cd ../..
cd services/notifications && npm run build && npm run test:emulator && cd ../..
npx firebase-tools deploy --only functions:orders,functions:payments,functions:notifications,hosting --project production
```

Nunca rode `firebase deploy` apontando para o alias `default`/demo. Ele existe só para os emuladores.

## Integração de pagamento (Stripe)

`services/payments/src/stripeService.ts`, `webhooks.routes.ts` e `services/orders/src/services/pedidosService.ts` (via chamada interna) implementam RN10-RN18. Este projeto **nunca processa dinheiro real**: todas as chaves e o Dashboard usados são sempre em **modo teste/sandbox** do Stripe.

### Como obter as chaves de teste do Stripe

1. Crie (ou acesse) uma conta em [dashboard.stripe.com](https://dashboard.stripe.com/register). Não precisa completar a ativação da conta (dados bancários etc.) para usar o modo teste.
2. No Dashboard, confirme que o toggle **"Test mode"** (canto superior direito) está **ativado**. Todas as chaves e eventos gerados nesse modo são de sandbox, sem qualquer cobrança real.
3. Vá em **Developers > API keys**. Copie a **Secret key** de teste, que sempre começa com `sk_test_...` (nunca use a chave que começa com `sk_live_...` neste projeto).
4. O **Webhook signing secret** (`whsec_...`) só é gerado depois de cadastrar o endpoint de webhook. Ver a subseção ["Configurar a URL do webhook no Dashboard do Stripe"](#configurar-a-url-do-webhook-no-dashboard-do-stripe-modo-teste) abaixo.

Nunca cole uma chave de teste, ou com muito mais razão uma chave live, diretamente em código, commit, PR, issue ou log. Ela vai **somente** para o `.env` local (ignorado pelo git) ou para o Firebase Secret Manager.

### Configuração local (Emulator Suite)

1. Copie o arquivo de exemplo, se ainda não tiver um `.env` local:
   ```bash
   cd services/payments
   cp .env.example .env
   ```
2. Edite `services/payments/.env` e preencha `STRIPE_SECRET_KEY` com a sua chave de teste (`sk_test_...`) obtida acima. Para `STRIPE_WEBHOOK_SECRET`, veja a subseção de webhook abaixo. Durante desenvolvimento local sem receber webhooks reais, o valor placeholder do `.env.example` já é suficiente (os testes Jest nunca usam esse valor: o SDK do Stripe é sempre mockado).
3. O Firebase Functions (2ª geração) carrega `services/payments/.env` automaticamente ao rodar via `emulators:start`/`emulators:exec`. Nenhuma outra configuração é necessária.

### Configuração em produção (Firebase Secret Manager)

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
# cole a chave de teste (sk_test_...) quando solicitado — nunca fica em texto no shell/histórico

firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
# cole o signing secret (whsec_...) gerado ao cadastrar o webhook — ver subseção abaixo
```

Os dois segredos já estão referenciados na definição da Cloud Function (opção `secrets` do `onRequest`, 2ª geração, em `services/payments/src/index.ts`).

### Cartões de teste do Stripe

Para testar o fluxo de pagamento manualmente (via `client_secret` retornado por `POST /pedidos` e Stripe.js/Elements, ou via chamadas diretas de teste), use os [cartões de teste oficiais do Stripe](https://docs.stripe.com/testing#cards). Funcionam **somente** em modo teste, com qualquer data de validade futura, qualquer CVC de 3 dígitos e qualquer CEP:

| Número do cartão | Comportamento simulado |
|---|---|
| `4242 4242 4242 4242` | Pagamento aprovado com sucesso (dispara `payment_intent.succeeded`) |
| `4000 0000 0000 0002` | Cartão recusado (`card_declined`, dispara `payment_intent.payment_failed`) |
| `4000 0000 0000 9995` | Recusado por saldo insuficiente (`insufficient_funds`) |
| `4000 0025 0000 3155` | Exige autenticação 3D Secure adicional |

### Configurar a URL do webhook no Dashboard do Stripe (modo teste)

1. No [Dashboard do Stripe](https://dashboard.stripe.com), com o toggle **"Test mode"** ativado, vá em **Developers > Webhooks > Add endpoint**.
2. Em **Endpoint URL**, informe a URL pública do gateway: `https://gscandelari-ecommerce-api.web.app/webhooks/stripe`.
3. Em **Events to listen to**, selecione `payment_intent.succeeded`, `payment_intent.payment_failed` e `payment_intent.canceled` (RN12/RN13 do `SPEC.md`). Outros eventos podem ser adicionados sem quebrar nada, tipos não mapeados são tratados como no-op.
4. Salve o endpoint. O Stripe exibe o **Signing secret** (`whsec_...`) na página de detalhes do endpoint criado. Clique em "Reveal" para visualizá-lo.
5. Copie esse valor e configure-o em produção com `firebase functions:secrets:set STRIPE_WEBHOOK_SECRET`. Se o endpoint for recriado ou o secret for "rolado" (rotate) no Dashboard, repita este passo com o novo valor.
6. Para testar localmente sem expor o emulador publicamente, use o [Stripe CLI](https://docs.stripe.com/stripe-cli) (`stripe listen --forward-to localhost:5001/demo-gscandelari-ecommerce-api/us-central1/paymentsApi/webhooks/stripe`), que gera seu próprio signing secret de teste temporário para colocar no `.env` local.

## Notificações por e-mail (Resend)

`services/notifications/` envia e-mail de confirmação/cancelamento de pedido (RN19) via [Resend](https://resend.com), sempre em modo teste/sandbox. Este projeto de portfólio não envia e-mail para destinatários reais fora de teste.

**Como obter (gratuito, sem cartão de crédito, sem verificar domínio):**
1. Crie uma conta em [resend.com/signup](https://resend.com/signup).
2. No Dashboard, vá em **API Keys > Create API Key**, dê um nome e copie a chave gerada (formato `re_...`). Trate-a com o mesmo cuidado de qualquer outro segredo deste projeto.
3. **Sem verificar um domínio próprio**, o Resend só permite enviar e-mails para o endereço cadastrado na sua própria conta, usando o remetente de sandbox `onboarding@resend.dev`.

**Configuração local (Emulator Suite):**
```bash
cd services/notifications
cp .env.example .env
# preencha RESEND_API_KEY com a chave de teste/sandbox obtida acima
```
Os testes Jest de Notifications nunca usam esse valor real: o SDK do Resend é sempre mockado (`services/notifications/test/helpers/mockResend.ts`).

**Configuração em produção (Firebase Secret Manager):**
```bash
firebase functions:secrets:set RESEND_API_KEY
```

> **Nota de implementação:** o SDK do Resend não lança exceção em erros de nível de API. `emails.send()` devolve `{ data: null, error }` em vez de lançar. O trigger `onPedidoStatusChange.ts` checa esse campo explicitamente e loga via `console.error` quando presente, sem propagar (best-effort, RN19: nunca bloqueia a transição de status, que já foi efetivada por Orders).

### Como testar o fluxo de notificação por e-mail manualmente

1. Suba o Emulator Suite (seção acima), com `RESEND_API_KEY` real configurada em `services/notifications/.env`.
2. Crie um usuário no Auth Emulator cujo e-mail seja o mesmo cadastrado na sua conta Resend (restrição do modo sandbox) e crie um pedido autenticado via `POST /pedidos`.
3. Efetive a confirmação do pagamento, via admin (`PATCH /pedidos/:id/status` para `confirmado`) ou simulando o webhook do Stripe local apontando para o Payments do emulador.
4. `onPedidoStatusChange` dispara automaticamente ao detectar a mudança de `status`. Confira o e-mail recebido e/ou o log de envios em [resend.com/emails](https://resend.com/emails) no Dashboard.
5. Repita cancelando um pedido em `pendente` para validar o e-mail de cancelamento.
6. Confirme a cláusula best-effort: force uma falha (ex.: `RESEND_API_KEY` inválida) e confirme, pelo Firestore Emulator UI, que o pedido permanece `confirmado`/`cancelado` normalmente.

## Máquina de estados do Pedido — status e pagamento

`status` (`PedidoStatus`) e `paymentStatus` (`PaymentStatus`) são dois campos independentes do mesmo documento `Pedido`.

### `status` do Pedido (`PedidoStatus`)

Fluxo principal, sempre nesta ordem (RN05):

```
pendente → confirmado → enviado → entregue
```

Diagrama textual completo, incluindo cancelamento e devolução:

```
pendente
  ├─► confirmado
  │      ├─► enviado
  │      │      ├─► entregue
  │      │      └─► aguardando_devolucao (RN29, Cliente ou Admin)
  │      │             └─► cancelado (RN30, somente Admin; restaura estoque)
  │      └─► cancelado (RN07a/RN28: Admin sempre; Cliente também)
  └─► cancelado (Cliente dono ou Admin; restaura estoque)
```

- `pendente → cancelado`: Cliente dono do pedido ou Admin; estoque restaurado (RN06/RN07a).
- `confirmado → cancelado`: Cliente dono do pedido (RN28) ou Admin (RN07a). Quando é o Cliente quem cancela, o estoque **é** restaurado (RN28). Quando é o Admin, o estoque **não** é restaurado automaticamente (RN07a) — assimetria deliberada.
- `enviado → aguardando_devolucao`: Cliente dono ou Admin (RN29). Nenhuma restauração de estoque nem mudança de `paymentStatus` nesta transição, o pedido ainda não está `cancelado`.
- `aguardando_devolucao → cancelado`: **somente Admin**, confirmando que o produto retornou fisicamente (RN30). Estoque restaurado.

### `paymentStatus` do Pedido (`PaymentStatus`)

- `aguardando_pagamento`: valor inicial, atribuído na criação do pedido junto com a PaymentIntent (RN10).
- `pago`: setado quando o webhook `payment_intent.succeeded` confirma o pagamento (RN12).
- `falhou`: setado quando o webhook `payment_intent.payment_failed` (ou equivalente) é recebido (RN13). O pedido também é cancelado e o estoque restaurado nesse mesmo evento.
- `estorno_pendente`: quando um pedido com `paymentStatus: "pago"` é cancelado por qualquer transição que leve a `cancelado` (RN31), `paymentStatus` muda **automaticamente** para `estorno_pendente`. Essa mudança é o único efeito automático do cancelamento sobre o pagamento. **Nenhuma chamada ao Stripe é feita nesse momento.**
- `reembolsado`: só é alcançado através de uma ação **dedicada, manual e exclusiva do Admin**, `PATCH /pedidos/:id/reembolsar` (RN32), disponível apenas quando `paymentStatus === "estorno_pendente"`. Chama `stripe.refunds.create` pelo valor total do pedido. Sucesso vira `paymentStatus: "reembolsado"`. Falha na chamada ao Stripe mantém `paymentStatus` como `estorno_pendente` (permite nova tentativa), resposta HTTP 502.

> **Reembolso nunca é automático.** Nenhuma transição de `status` dispara por si só uma chamada ao Stripe. O cancelamento só sinaliza que um reembolso é devido (`paymentStatus: "estorno_pendente"`). Efetivá-lo é sempre uma decisão humana explícita e posterior do Admin.

## Front-end de testes — `web/`

SPA em **React + Vite + TypeScript**, ferramenta de teste/demonstração da API. Não é o produto final do portfólio, esse é a API. Roda **exclusivamente contra o Firebase Emulator Suite local** (RN27): nunca aponta para o projeto Firebase real. Dois perfis de uso na mesma aplicação: **Cliente** (catálogo, criação de pedido, pagamento via Stripe Elements, histórico/cancelamento, RN21-RN24) e **Administrador**, via custom claim `admin: true` (CRUD de Produtos e gestão de Pedidos, RN25).

### Como rodar `web/` junto com o Emulator Suite

São **dois processos**, em dois terminais separados:

1. **Terminal 1, Emulator Suite**, a partir da **raiz do repositório**:
   ```bash
   npx firebase-tools emulators:start
   ```
   Confirme que a API responde antes de seguir:
   ```bash
   curl http://localhost:5001/demo-gscandelari-ecommerce-api/us-central1/ordersApi/health
   ```
2. **Terminal 2, front-end**, a partir de `web/`:
   ```bash
   cd web
   npm install
   cp .env.example .env      # se ainda não existir; valores padrão já funcionam contra o emulador
   npm run dev
   ```
   Abra a URL impressa pelo Vite (padrão `http://localhost:5173`).

Se o Emulator Suite não estiver rodando, o cliente HTTP do front-end (`src/api/apiClient.ts`) detecta a falha de `fetch` e mostra a mensagem "Não foi possível conectar à API. Verifique se o Firebase Emulator Suite está rodando (`firebase emulators:start`)." em vez de travar silenciosamente.

### Criar um cliente de teste e promovê-lo a admin

A área de Administrador (RN25) exige a custom claim `admin: true` no Auth Emulator. Passo a passo:

1. Com os dois processos acima rodando, cadastre um usuário normalmente pela UI (`/cadastro` em `web/`). Ele nasce sem a claim.
2. Em outro terminal, promova esse e-mail a admin no Auth Emulator:
   ```bash
   cd services/orders
   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 npm run set-admin -- email@exemplo.com
   ```
   O script recusa-se a rodar sem `FIREBASE_AUTH_EMULATOR_HOST` definido, justamente para nunca ser usado por engano contra um projeto real.
3. A claim setada no passo 2 **não** aparece automaticamente na sessão já aberta no navegador. O token em cache do SDK do Firebase Auth só se renova sozinho a cada ~1h. Deslogue e logue novamente em `web/` para forçar a atualização (`AuthContext` força `getIdTokenResult(forceRefresh: true)` logo após login).
4. Com `isAdmin === true`, os links/rotas de admin (`/admin/produtos`, `/admin/pedidos`) ficam visíveis e acessíveis.

Vale lembrar: a claim de admin controla só a *exibição* das rotas no front-end (RN26, puro UX). O backend (`requireAdmin`) continua sendo a única fonte real de autorização, com ou sem o front-end.

### (Opcional) Stripe CLI — fechar o ciclo RN23 + RN12 (confirmação automática de pagamento)

Ao completar um pagamento de teste no `PaymentForm` (Stripe Elements, cartão `4242 4242 4242 4242`), o `confirmCardPayment` do Stripe.js confirma o pagamento **no Stripe**. Isso já exercita RN23 de ponta a ponta isoladamente. Mas a **transição do status do pedido** para `confirmado` é uma regra separada (RN12) e só acontece quando o backend recebe o webhook `POST /webhooks/stripe`. Como o Emulator Suite roda em `localhost`, o Stripe (serviço externo) não consegue entregar esse webhook diretamente. É preciso o [Stripe CLI](https://docs.stripe.com/stripe-cli) fazendo o encaminhamento:

```bash
stripe listen --forward-to http://localhost:5001/demo-gscandelari-ecommerce-api/us-central1/paymentsApi/webhooks/stripe
```

Rode esse comando em um terceiro terminal, autenticado (`stripe login`) na mesma conta Stripe cuja chave de teste está em `services/payments/.env` (`STRIPE_SECRET_KEY`). O `stripe listen` imprime um signing secret temporário (`whsec_...`); copie-o para `STRIPE_WEBHOOK_SECRET` em `services/payments/.env` (reinicie o Emulator Suite depois de editar).

- **Sem o Stripe CLI rodando:** o pagamento é confirmado no Stripe, mas o pedido permanece `pendente` até um Admin alterar o status manualmente pela área de admin. Comportamento esperado da ferramenta de teste, não um bug.
- **Com o Stripe CLI rodando:** o webhook é entregue, o pedido é confirmado automaticamente, fechando o ciclo RN23 (front-end) + RN12 (backend) de ponta a ponta.

## Notas de engenharia

Uma seleção de problemas reais encontrados só contra infraestrutura real. Nenhum deles é reproduzível no Emulator Suite nem nos testes Jest/Supertest — é o tipo de coisa que só aparece num deploy de verdade:

- **Nome de export precisa ser um identificador JS válido.** Um export renomeado via string-literal (`export { x as "orders-api" }`) funciona no Emulator Suite (que introspecciona os exports diretamente), mas quebra a resolução de `entry_point` do Cloud Functions real.
- **Codebases não namespaceiam o ID da function automaticamente.** O ID final é literalmente o identificador exportado, único por **projeto+região**, não por codebase. Dois codebases exportando o mesmo nome colidem (`More than one codebase claims functions/api`).
- **Opções de build-time não podem ler `process.env.X` direto.** `serviceAccount: process.env.X` sempre resolve `undefined` num deploy real: o Firebase CLI faz o `require()` do codebase para descobrir as functions, avaliando esse literal de opções, antes de carregar o `.env.<project-id>` em `process.env`. O fix é a API de Parameterized Configuration do `firebase-functions` v2 (`defineString`), resolvida numa fase posterior do deploy, já com o `.env` carregado.
- **O SDK do Resend não lança exceção em erros de nível de API.** `emails.send()` devolve `{ data: null, error }`. Sem checar esse campo explicitamente, uma rejeição da API passa batido, sem nenhum log, indistinguível de um envio bem-sucedido.
- **Provisionamento de um projeto Firebase real do zero tem passos manuais não óbvios**, entre eles Auth, Firestore API, criação do banco com ID literal `(default)` e deploy das rules. Ver [Pré-requisitos de provisionamento](#deploy) na seção Deploy.

## Contribuindo

Convenção de commits (Conventional Commits), estratégia de branching (GitHub Flow) e processo de Pull Request estão documentados em [`CONTRIBUTING.md`](./CONTRIBUTING.md).
