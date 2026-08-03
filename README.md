# gscandelari-ecommerce-api

API REST de e-commerce (Produtos, Pedidos, Clientes) — projeto de portfólio, **Fase 1 (Core API)**.

Construída com **Firebase Cloud Functions (2ª geração) + Express + TypeScript + Firestore**, com autenticação via **Firebase Auth** (papéis `cliente`/`admin` via custom claims). Ver a especificação completa em [`SPEC.md`](./SPEC.md) e o backlog de tasks em [`BACKLOG.md`](./BACKLOG.md).

> Fase 2 (integração de pagamento real via Stripe, sempre em modo sandbox) já está implementada, testada e **deployada em produção**. Fase 3 (quebra em microsserviços) está **em desenvolvimento na branch `feat/fase-3-microservicos`** — scaffold e suíte de testes TDD dos 3 novos serviços já commitados, implementação em andamento. A **produção real não foi alterada**: o monólito desta Fase 1+2 (`functions/`, codebase `default`) continua deployado e servindo 100% do tráfego real (inclusive o webhook do Stripe) sem interrupção, até o corte de produção ser deliberadamente executado como última etapa da Fase 3. Ver [Arquitetura da Fase 3 (Microsserviços) — em desenvolvimento](#arquitetura-da-fase-3-microsserviços--em-desenvolvimento) abaixo.

## Estado atual do projeto

- **Módulo 1 (Setup & Infra)**: concluído. `firebase.json`, `.firebaserc`, `firestore.rules` (deny-all para client SDK), Firestore/Auth/Functions Emulator, TypeScript (com path alias `@/`), ESLint + Prettier e hook de pre-commit já configurados.
- **Módulo 2 (Core Business)**: concluído. Modelos de dados, middlewares de autenticação/autorização (Firebase Auth + custom claim `admin`), validação Zod, tratamento de erro centralizado e os endpoints REST de `/produtos` e `/pedidos` (RN01-RN09, RN07a) estão implementados, incluindo documentação OpenAPI/Swagger em `/docs` (Épico 2.7).
- **Módulo 3 (Testes)**: concluído. `functions/test/` cobre RN01-RN09/RN07a via Jest + Supertest contra o Firebase Emulator Suite — **49/49 testes passando**, cobertura 96%+ (acima da meta de 70% do `SPEC.md`).
- **Módulo 4 (este documento + CI/CD)**: concluído. Git, CI/CD, README e estratégia de deploy documentados.

**Fase 2 (integração de pagamento via Stripe): concluída e deployada em produção.** `POST /pedidos` cria automaticamente uma PaymentIntent no Stripe (modo teste); `POST /webhooks/stripe` confirma ou cancela pedidos automaticamente via evento assinado (RN10-RN15), com idempotência. 63/63 testes passando (49 Fase 1 + 14 Fase 2, zero regressão), CI verde no GitHub Actions. Os segredos `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` já estão configurados no Firebase Secret Manager do projeto real e o deploy foi validado de ponta a ponta via `workflow_dispatch`.

**Fase 3 (microsserviços): em desenvolvimento, branch `feat/fase-3-microservicos`, ainda não mesclada em `main`.** Reestrutura o monólito em 3 codebases independentes (`services/orders/`, `services/payments/`, `services/notifications/`) atrás de um API Gateway (Firebase Hosting). Estado atual: scaffold de cada serviço (`package.json`, `tsconfig`, `jest.config`) e a suíte de testes TDD dos Módulos 9-12 do `BACKLOG.md` já commitados nesta branch — propositalmente "vermelha" (`src/` de cada serviço ainda vazio), aguardando a implementação dos Módulos 8-11. `firebase.json` ainda declara só o codebase `default`; a produção real **não foi alterada** e continua servindo 100% do tráfego pelo monólito atual. Detalhes completos em [Arquitetura da Fase 3 (Microsserviços) — em desenvolvimento](#arquitetura-da-fase-3-microsserviços--em-desenvolvimento).

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
- [Arquitetura da Fase 3 (Microsserviços) — em desenvolvimento](#arquitetura-da-fase-3-microsserviços--em-desenvolvimento)
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

└── services/                  # Fase 3 (microsserviços) — EM DESENVOLVIMENTO,
                                # branch feat/fase-3-microservicos, não deployado.
                                # Ver "Arquitetura da Fase 3" para detalhes.
    ├── orders/                 # produtos + pedidos (RN01-RN09, RN16-RN18)
    ├── payments/                # Stripe + webhook (RN10-RN15, RN16-RN18)
    └── notifications/            # e-mail via Resend, sem rota HTTP (RN19-RN20)
        # cada um com seu próprio package.json/tsconfig/jest.config.js,
        # src/ (ainda vazio) e test/ (suíte TDD já commitada, "vermelha")
```

## CI/CD

Workflows em `.github/workflows/`:

- **`ci.yml`** — roda em todo Pull Request para `main` e em todo push em `main`. Etapas: `npm ci` (instala dependências), `npm run lint`, `npm run build`, `npm run test:coverage:emulator` (Jest + Supertest contra o Firebase Emulator Suite, com o mesmo `firebase-tools` travado no `package-lock.json`). Nenhuma etapa de CI toca um projeto Firebase real. Este workflow é o check obrigatório configurado na proteção da branch `main` (ver `CONTRIBUTING.md`). **Cuida exclusivamente de `functions/` (Fase 1+2, em produção) e não foi alterado pela Fase 3.**
- **`deploy.yml`** — deploy para Firebase Functions (`functions/`, codebase `default`, Fase 1+2). Ver decisão detalhada abaixo. **Não foi alterado pela Fase 3** — continua deployando somente o monólito atual.
- **`ci-services.yml`** (novo, Fase 3) — roda lint/build/test **de forma independente** para cada um dos 3 novos serviços (`services/orders/`, `services/payments/`, `services/notifications/`), via matrix job, disparado em push/PR que tocam `services/**` na branch `feat/fase-3-microservicos` (e em PRs futuros para `main`). Não interfere em `ci.yml`/`deploy.yml` nem nos checks obrigatórios de `main` hoje. **Estado esperado atualmente: vermelho** (lint falha por não haver `eslint.config` por serviço ainda — Task 8.1.2; testes falham por não haver `src/` implementado ainda — Módulos 8-10), refletindo o TDD "vermelho" intencional descrito em [Arquitetura da Fase 3](#arquitetura-da-fase-3-microsserviços--em-desenvolvimento). **Não existe workflow de deploy para os novos serviços nesta rodada** — deploy real é a última etapa da Fase 3 (Épico 8.6), disparada manualmente e só com aprovação explícita do usuário.

## Deploy

### Estado atual: projeto real provisionado, CD automatizado validado, Fase 1 + Fase 2 no ar

- **Projeto Firebase (Blaze):** `gscandelari-ecommerce-api` ([console](https://console.firebase.google.com/project/gscandelari-ecommerce-api/overview)), alias `production` em `.firebaserc`.
- **Function URL:** `https://us-central1-gscandelari-ecommerce-api.cloudfunctions.net/api` (`/health`, `/docs`, `/produtos`, `/pedidos`, `/webhooks/stripe`).
- **Política de limpeza do Artifact Registry** configurada (`firebase functions:artifacts:setpolicy`, imagens de container antigas removidas após 1 dia) — evita custo de armazenamento acumulado.
- **Deploy via GitHub Actions validado de ponta a ponta** (`workflow_dispatch`, secret `FIREBASE_SERVICE_ACCOUNT_KEY` configurado): lint, build, testes contra o Emulator Suite e `firebase deploy --only functions` reais, do runner do GitHub até o projeto Firebase real.
- **Branch protection** ativa em `main` (PR obrigatório + check de CI obrigatório).
- Segredos do Stripe (`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`, modo teste) configurados no Firebase Secret Manager — Fase 2 deployada e validada (webhook responde 400 sem assinatura, conforme esperado).

**Papéis da Service Account de deploy** (`github-actions-deploy@gscandelari-ecommerce-api.iam.gserviceaccount.com`), descobertos por tentativa/erro real contra o deploy (a lista abaixo é o mínimo que efetivamente funcionou, não uma lista teórica): Cloud Functions Admin, Cloud Run Admin, Artifact Registry Administrator, Cloud Build Editor, Service Account User, Firebase Admin, Service Usage Admin (necessário para o deploy habilitar `cloudbilling.googleapis.com` sozinho), Secret Manager Secret Accessor e Secret Manager Admin (necessário para o deploy conceder acesso ao secret para a service account de runtime das Functions).

### Decisão registrada (Task 4.5.1 do `BACKLOG.md`): deploy MANUAL

O deploy a partir de `main` é **manual**, disparado via `workflow_dispatch` (botão "Run workflow" no GitHub Actions, com um campo de confirmação obrigatório) ou via CLI local, e **não** automático a cada merge em `main`. Um gatilho manual dá a um humano a chance de decidir *quando* colocar uma versão em produção, mantendo ainda assim `main` sempre *deployável* (princípio central do GitHub Flow). Essa decisão pode ser revisitada (trocando o gatilho para `push` em `main`) quando o time preferir deploy contínuo.

### Deploy manual via GitHub Actions

1. Garanta que `main` está com o CI verde (badge/check do workflow `ci.yml`).
2. Vá em GitHub > Actions > workflow **"Deploy Firebase Functions"** > "Run workflow", selecione a branch `main`, digite `deploy` no campo de confirmação e execute.
3. O workflow reexecuta lint + build + testes antes de deployar (defesa em profundidade) e então roda `firebase deploy --only functions`.

### Deploy manual via Firebase CLI (local)

```bash
cd functions
npm run build
npm run test:emulator          # garanta que a suíte passa antes de deployar
cd ..
npx firebase-tools deploy --only functions --project production
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

## Arquitetura da Fase 3 (Microsserviços) — em desenvolvimento

> **Status: em desenvolvimento na branch `feat/fase-3-microservicos`, ainda não mesclada em `main`.** Esta seção documenta o alvo da Fase 3 (`SPEC.md` seção "Fase 3", `BACKLOG.md` Módulos 8-12) e o que já existe hoje nesta branch: estrutura de pastas + `package.json`/`tsconfig`/`jest.config` de cada novo serviço, e a suíte de testes TDD dos Módulos 9-12 (propositalmente "vermelha" — `src/` de cada serviço ainda está vazio, aguardando a implementação). **Nada disto está deployado.** A produção real do projeto (`gscandelari-ecommerce-api`) continua rodando exclusivamente o monólito da Fase 1+2 (`functions/`, codebase `default`, function `api`), servindo 100% do tráfego real sem qualquer interrupção — inclusive o webhook do Stripe, cadastrado no Dashboard real (modo teste) apontando para a URL do monólito. `firebase.json` hoje ainda declara só o codebase `default`; estendê-lo para os 4 codebases é a Task 8.1.3 (Módulo 8), ainda não executada.

### Diagrama (arquitetura alvo)

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
2. A partir da Task 8.1.3 do `BACKLOG.md` (Módulo 8, ainda não executada nesta branch), `firebase.json` passa a declarar um array `codebases` com `default` (`functions/`, Fase 1+2), `orders` (`services/orders`), `payments` (`services/payments`) e `notifications` (`services/notifications`). A partir daí, o mesmo comando já usado hoje sobe os 4 codebases simultaneamente a partir da raiz do repositório:
   ```bash
   npx firebase-tools emulators:start
   ```
   Isso sobe Auth + Firestore + Functions (4 codebases) + Hosting (gateway, Módulo 11) no mesmo Emulator UI (`localhost:4000`), sempre contra o projeto demo `demo-gscandelari-ecommerce-api` — nunca um projeto real, mesma garantia já documentada para a Fase 1+2.
3. Convenção de nomes de export por codebase (Firebase prefixa automaticamente pelo nome do codebase — Task 8.5.2): `orders-api`, `payments-api`, `notifications-onPedidoStatusChange`, sem colisão com a function `api` do codebase `default`.
4. Enquanto os Módulos 8-11 (implementação) não estiverem prontos, cada serviço já pode ser exercitado isoladamente via sua própria suíte de testes (TDD — hoje "vermelha", por design, até a implementação correspondente existir):
   ```bash
   cd services/orders && npm run lint && npm run build && npm run test:coverage:emulator
   cd services/payments && npm run lint && npm run build && npm run test:coverage:emulator
   cd services/notifications && npm run lint && npm run build && npm run test:coverage:emulator
   ```
   (`npm run lint` também falha hoje: cada serviço ainda não tem sua própria configuração de ESLint — isso é parte da Task 8.1.2, Módulo 8, ainda não executada.)
5. Uma vez o fluxo crítico implementado (Módulos 8-11), o roteiro de validação local ponta a ponta é: criar pedido (Orders) → chamada interna síncrona a Payments cria a PaymentIntent → simular evento de webhook do Stripe (CLI `stripe listen`/`stripe trigger` apontando para o Payments local) → chamada interna síncrona de Payments a Orders efetiva a transição de status → Firestore Trigger dispara Notifications → e-mail via Resend (modo sandbox) — tudo dentro do emulador, sem tocar rede/projeto real além dos SDKs mockados nos testes automatizados.

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
Será referenciado na definição da Cloud Function `onPedidoStatusChange` (opção `secrets`, 2ª geração) quando a Task 10.1.1 (Módulo 10) for implementada — mesmo mecanismo documentado em [Variáveis de ambiente e segredos](#variáveis-de-ambiente-e-segredos). Este segredo é configurado independentemente dos segredos já existentes de Payments (`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`) e nunca precisa ser acessível por Orders ou Payments (princípio de menor privilégio, Task 9.1.4).

### Como testar o fluxo de notificação por e-mail manualmente

Pré-requisito: Módulos 8-10 do `BACKLOG.md` implementados (Orders + Notifications rodando no emulador) e `RESEND_API_KEY` real (modo sandbox) configurada em `services/notifications/.env`.

1. Suba o Emulator Suite multi-codebase (seção acima).
2. Crie um usuário no Auth Emulator cujo e-mail seja o mesmo cadastrado na sua conta Resend (restrição do modo sandbox sem domínio verificado, ver acima) e crie um pedido autenticado via `POST /pedidos` (Orders).
3. Efetive a confirmação do pagamento — via admin (`PATCH /pedidos/:id/status` para `confirmado`) ou simulando o webhook do Stripe local apontando para o Payments do emulador.
4. `onPedidoStatusChange` (Notifications) dispara automaticamente ao detectar a mudança de `status` para `confirmado`; confira o e-mail recebido e/ou o log de envios em [resend.com/emails](https://resend.com/emails) no Dashboard (mostra todo envio, inclusive em modo sandbox).
5. Repita cancelando um pedido em `pendente` para validar o e-mail de cancelamento.
6. Confirme a cláusula best-effort de RN19: force uma falha (ex.: `RESEND_API_KEY` inválida) e confirme, pelo Firestore Emulator UI, que o pedido permanece `confirmado`/`cancelado` normalmente — a falha de e-mail nunca reverte ou bloqueia a transição de status já efetivada por Orders.

### Corte de produção — só como última etapa deliberada

A Fase 3 **nunca** decomissiona o monólito como parte do trabalho normal desta branch. A sequência completa está detalhada no Épico 8.6 do `BACKLOG.md`; resumo:

1. Todo o trabalho acontece isolado em `feat/fase-3-microservicos`, validado 100% localmente (Emulator Suite multi-codebase + suíte de testes por serviço) antes de qualquer deploy real.
2. PR revisado e mesclado em `main` só depois da suíte completa verde (Módulo 12) — o merge em si **não** deploya nada (deploy continua manual via `workflow_dispatch`, decisão herdada das Fases 1/2, Task 4.5.1).
3. Deploy real dos 3 novos codebases + Hosting com `--only` explícito (`firebase deploy --only functions:orders,functions:payments,functions:notifications,hosting`) — **nunca** toca o codebase `default`; a function `api` da Fase 1+2 continua servindo tráfego real ininterruptamente durante e depois deste deploy.
4. Smoke test completo em produção real pelo **novo** caminho, incluindo a migração manual da URL do webhook no Dashboard do Stripe (modo teste) para a nova URL pública de Payments.
5. **Somente** depois do smoke test validado, o codebase `default` é removido de `firebase.json` e a function `api` é explicitamente deletada (`firebase functions:delete api`) — decomissionamento deliberado, nunca automático.

Nenhuma das etapas de produção real acima (passos 3-5) é disparada automaticamente por CI. O novo workflow de CI desta fase (`.github/workflows/ci-services.yml`, ver [CI/CD](#cicd)) faz **apenas** lint/build/test dos 3 novos serviços — não existe (propositalmente) nenhum workflow de deploy para eles nesta rodada. Um workflow de deploy só será criado quando o Épico 8.6 for de fato executado, e mesmo assim como gatilho manual (`workflow_dispatch`) sujeito a aprovação explícita do usuário antes de qualquer disparo real, nunca automático.

## Contribuindo

Convenção de commits (Conventional Commits), estratégia de branching (GitHub Flow) e processo de Pull Request estão documentados em [`CONTRIBUTING.md`](./CONTRIBUTING.md).
