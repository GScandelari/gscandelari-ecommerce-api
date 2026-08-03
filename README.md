# gscandelari-ecommerce-api

API REST de e-commerce (Produtos, Pedidos, Clientes) — projeto de portfólio, **Fase 1 (Core API)**.

Construída com **Firebase Cloud Functions (2ª geração) + Express + TypeScript + Firestore**, com autenticação via **Firebase Auth** (papéis `cliente`/`admin` via custom claims). Ver a especificação completa em [`SPEC.md`](./SPEC.md) e o backlog de tasks em [`BACKLOG.md`](./BACKLOG.md).

> Fase 2 (integração de pagamento real via Stripe, sempre em modo sandbox) já está especificada em `SPEC.md` e em desenvolvimento. Fase 3 (quebra em microsserviços) ainda não faz parte deste repositório/spec.

## Estado atual do projeto

- **Módulo 1 (Setup & Infra)**: concluído. `firebase.json`, `.firebaserc`, `firestore.rules` (deny-all para client SDK), Firestore/Auth/Functions Emulator, TypeScript (com path alias `@/`), ESLint + Prettier e hook de pre-commit já configurados.
- **Módulo 2 (Core Business)**: concluído. Modelos de dados, middlewares de autenticação/autorização (Firebase Auth + custom claim `admin`), validação Zod, tratamento de erro centralizado e os endpoints REST de `/produtos` e `/pedidos` (RN01-RN09, RN07a) estão implementados, incluindo documentação OpenAPI/Swagger em `/docs` (Épico 2.7).
- **Módulo 3 (Testes)**: concluído. `functions/test/` cobre RN01-RN09/RN07a via Jest + Supertest contra o Firebase Emulator Suite — **49/49 testes passando**, cobertura 96%+ (acima da meta de 70% do `SPEC.md`).
- **Módulo 4 (este documento + CI/CD)**: concluído. Git, CI/CD, README e estratégia de deploy documentados.

**Fase 2 (integração de pagamento via Stripe): EM DESENVOLVIMENTO, não concluída.** O backlog dos Módulos 5-7 (`BACKLOG.md`) já foi gerado e o agente qa-negocio já escreveu os testes que cobrem RN10-RN15 (`functions/test/integration/pedidosPagamento.test.ts`, `functions/test/integration/webhooksStripe.test.ts`, com o SDK do Stripe mockado via `functions/test/helpers/mockStripe.ts`) — esses testes estão **vermelhos por design** (TDD): eles importam `functions/src/stripeClient.ts`, `functions/src/services/stripeService.ts` e `functions/src/routes/webhooks.routes.ts`, que **ainda não existem**. A implementação de produção (Módulos 5 e 6 — cliente Stripe, `stripeService`, rota de webhook, extensão do modelo `Pedido` com `paymentIntentId`/`paymentClientSecret`/`paymentStatus`) está **pendente**. Nenhum endpoint de pagamento está deployado em produção hoje. As seções abaixo marcadas "Fase 2" documentam como configurar os segredos e testar o fluxo **quando a implementação existir** — não descrevem uma funcionalidade já disponível.

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
- [Integração de pagamento (Stripe) — Fase 2, em desenvolvimento](#integração-de-pagamento-stripe--fase-2-em-desenvolvimento)
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

Levantamento (Task 4.4.1 do `BACKLOG.md`): a Fase 1 **não integra nenhum gateway de pagamento real** nem serviço externo que exija chave de API (ver `SPEC.md` seção 1). A Fase 2 (em desenvolvimento — ver "Estado atual do projeto" acima) introduz os dois primeiros segredos de aplicação do projeto, ambos do Stripe **em modo teste/sandbox** (nunca chaves de modo live/produção — este projeto de portfólio nunca processa dinheiro real):

| Variável | Descrição | Onde é usada (quando o Módulo 5/6 existir) |
|---|---|---|
| `STRIPE_SECRET_KEY` | Chave secreta de **teste** do Stripe (sempre no formato `sk_test_...`, nunca `sk_live_...`) | `functions/src/stripeClient.ts` (`getStripeClient()`) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret do endpoint de webhook (`whsec_...`), usado para validar a assinatura `stripe-signature` de cada evento recebido | `functions/src/routes/webhooks.routes.ts` |

Todo segredo de aplicação novo (incluindo os dois acima) é criado via Firebase Secret Manager, **nunca em `.env` commitado**:

```bash
firebase functions:secrets:set NOME_DO_SEGREDO
# valor é digitado interativamente, nunca fica em texto no shell/histórico
```

e referenciado no código via a opção `secrets` do `onRequest`/`onCall` (2ª geração), conforme a [documentação oficial do Firebase](https://firebase.google.com/docs/functions/config-env?gen=2#secret-manager). Ver a seção ["Integração de pagamento (Stripe) — Fase 2, em desenvolvimento"](#integração-de-pagamento-stripe--fase-2-em-desenvolvimento) abaixo para o passo a passo completo de como obter as chaves de teste e configurá-las localmente e em produção.

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
```

## CI/CD

Workflows em `.github/workflows/`:

- **`ci.yml`** — roda em todo Pull Request para `main` e em todo push em `main`. Etapas: `npm ci` (instala dependências), `npm run lint`, `npm run build`, `npm run test:coverage:emulator` (Jest + Supertest contra o Firebase Emulator Suite, com o mesmo `firebase-tools` travado no `package-lock.json`). Nenhuma etapa de CI toca um projeto Firebase real. Este workflow é o check obrigatório configurado na proteção da branch `main` (ver `CONTRIBUTING.md`).
- **`deploy.yml`** — deploy para Firebase Functions. Ver decisão detalhada abaixo.

## Deploy

### Estado atual: projeto real provisionado e com deploy ativo

- **Projeto Firebase (Blaze):** `gscandelari-ecommerce-api` ([console](https://console.firebase.google.com/project/gscandelari-ecommerce-api/overview)), alias `production` em `.firebaserc`.
- **Function URL:** `https://us-central1-gscandelari-ecommerce-api.cloudfunctions.net/api` (`/health`, `/docs`, `/produtos`, `/pedidos`).
- **Política de limpeza do Artifact Registry** configurada (`firebase functions:artifacts:setpolicy`, imagens de container antigas removidas após 1 dia) — evita custo de armazenamento acumulado.
- O primeiro deploy foi feito manualmente via Firebase CLI local (ver abaixo). O secret `FIREBASE_SERVICE_ACCOUNT_KEY` para o workflow `deploy.yml` (GitHub Actions) **ainda não foi configurado** — até lá, o deploy continua sendo feito localmente.

### Decisão registrada (Task 4.5.1 do `BACKLOG.md`): deploy MANUAL

O deploy a partir de `main` é **manual**, disparado via `workflow_dispatch` (botão "Run workflow" no GitHub Actions, com um campo de confirmação obrigatório) ou via CLI local, e **não** automático a cada merge em `main`. Um gatilho manual dá a um humano a chance de decidir *quando* colocar uma versão em produção, mantendo ainda assim `main` sempre *deployável* (princípio central do GitHub Flow). Essa decisão pode ser revisitada (trocando o gatilho para `push` em `main`) quando o time preferir deploy contínuo.

### Deploy manual via GitHub Actions

Pré-requisito pendente: configurar o secret `FIREBASE_SERVICE_ACCOUNT_KEY` no GitHub (Settings > Secrets and variables > Actions), com uma Service Account JSON com permissão de deploy de Functions (gerada no Console do Firebase/Google Cloud — Project Settings > Service Accounts). Depois disso:

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

## Integração de pagamento (Stripe) — Fase 2, em desenvolvimento

> **Status: implementação pendente.** Esta seção documenta como a integração com o Stripe **deverá** ser configurada e testada assim que os Módulos 5 e 6 do `BACKLOG.md` forem implementados (`functions/src/stripeClient.ts`, `stripeService.ts`, `webhooks.routes.ts`, extensão do modelo `Pedido`). Hoje, nenhuma rota de pagamento existe no app Express nem está deployada em produção — os testes que cobrem RN10-RN15 já existem (`functions/test/integration/pedidosPagamento.test.ts`, `webhooksStripe.test.ts`) e estão vermelhos por design (TDD), aguardando a implementação. Este projeto **nunca processa dinheiro real**: todas as chaves e o Dashboard usados são sempre em **modo teste/sandbox** do Stripe.

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

Os dois segredos precisam ser referenciados na definição da Cloud Function (opção `secrets` do `onRequest`, 2ª geração) quando o Módulo 5/6 for implementado, para ficarem disponíveis como variável de ambiente em produção — mesmo mecanismo documentado na [seção "Variáveis de ambiente e segredos"](#variáveis-de-ambiente-e-segredos) acima.

### Cartões de teste do Stripe

Para testar o fluxo de pagamento manualmente (via `client_secret` retornado por `POST /pedidos` e Stripe.js/Elements, ou via chamadas diretas de teste), use os [cartões de teste oficiais do Stripe](https://docs.stripe.com/testing#cards) — funcionam **somente** em modo teste, com qualquer data de validade futura, qualquer CVC de 3 dígitos e qualquer CEP:

| Número do cartão | Comportamento simulado |
|---|---|
| `4242 4242 4242 4242` | Pagamento aprovado com sucesso (dispara `payment_intent.succeeded`) |
| `4000 0000 0000 0002` | Cartão recusado (`card_declined`, dispara `payment_intent.payment_failed`) |
| `4000 0000 0000 9995` | Recusado por saldo insuficiente (`insufficient_funds`) |
| `4000 0025 0000 3155` | Exige autenticação 3D Secure adicional |

### Configurar a URL do webhook no Dashboard do Stripe (modo teste)

Passo **manual**, feito uma vez por ambiente (dev local com túnel/Stripe CLI, e produção), depois que o Módulo 6 (`POST /webhooks/stripe`) estiver implementado e deployado:

1. No [Dashboard do Stripe](https://dashboard.stripe.com), com o toggle **"Test mode"** ativado, vá em **Developers > Webhooks > Add endpoint**.
2. Em **Endpoint URL**, informe a URL pública da function em produção: `https://us-central1-gscandelari-ecommerce-api.cloudfunctions.net/api/webhooks/stripe` (mesmo padrão de URL documentado em "Deploy" acima, path `/webhooks/stripe`).
3. Em **Events to listen to**, selecione ao menos `payment_intent.succeeded` e `payment_intent.payment_failed` (RN12/RN13 do `SPEC.md`); outros eventos podem ser adicionados sem quebrar nada (RN15/Task 6.4.5 trata tipos não mapeados como no-op).
4. Salve o endpoint. O Stripe exibe o **Signing secret** (`whsec_...`) na página de detalhes do endpoint criado — clique em "Reveal" para visualizá-lo.
5. Copie esse valor e configure-o em produção com `firebase functions:secrets:set STRIPE_WEBHOOK_SECRET` (comando acima). Se o endpoint for recriado ou o secret for "rolado" (rotate) no Dashboard, repita este passo com o novo valor.
6. Para testar localmente sem expor o emulador publicamente, use o [Stripe CLI](https://docs.stripe.com/stripe-cli) (`stripe listen --forward-to localhost:5001/demo-gscandelari-ecommerce-api/us-central1/api/webhooks/stripe`), que gera seu próprio signing secret de teste temporário para colocar no `.env` local.

## Contribuindo

Convenção de commits (Conventional Commits), estratégia de branching (GitHub Flow) e processo de Pull Request estão documentados em [`CONTRIBUTING.md`](./CONTRIBUTING.md).
