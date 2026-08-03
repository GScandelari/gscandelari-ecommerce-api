## Spec Técnica Aprovada: gscandelari-ecommerce-api

Portfólio de demonstração de "Desenvolvimento de APIs REST robustas, integrações e microsserviços com Node.js e Express", construído em Firebase (Cloud Functions 2ª geração + Express + Firestore, plano Blaze).

O domínio é um **Sistema de Pedidos & Pagamentos (E-commerce Core)**, único, que evolui em 3 fases dentro de um **monorepo** chamado `gscandelari-ecommerce-api`:
- **Fase 1 (concluída, deployada):** API core — Produtos, Pedidos, Clientes, sem gateway de pagamento real.
- **Fase 2 (esta spec):** integração de pagamento real (Stripe, sempre em modo sandbox/teste) via PaymentIntent + webhook.
- **Fase 3 (futura, requer nova rodada de clarificação):** quebra em microsserviços (Orders, Payments, Notifications) comunicando-se via Firestore Triggers, com API Gateway via Firebase Hosting rewrites.

---

## Fase 1 (Core API)

### 1. Visão Geral & Escopo
Ver domínio geral acima. Esta seção cobre **apenas a Fase 1**.

### 2. Regras de Negócio & Casos de Teste (para o agente qa-negocio)
- **RN01**: Um Produto possui nome, preço e estoque (quantidade inteira ≥ 0).
- **RN02**: Um Pedido pertence a um Cliente (usuário autenticado via Firebase Auth) e contém 1+ itens (produto + quantidade); o total é calculado a partir do preço dos produtos no momento da criação.
- **RN03**: Um Pedido só pode ser criado se todos os itens tiverem estoque suficiente; caso contrário, a criação é rejeitada (erro de validação, nenhum efeito colateral).
- **RN04**: Na criação de um Pedido válido, o estoque dos produtos envolvidos é decrementado imediatamente (sem etapa de "reserva" separada).
- **RN05**: Um Pedido segue o fluxo de status: `pendente → confirmado → enviado → entregue`. Adicionalmente, `cancelado` é alcançável a partir de `pendente`, `confirmado` ou `enviado` (nunca a partir de `entregue`). Não são permitidas outras transições fora dessa ordem (ex: `enviado → confirmado` é inválido). Esta regra define apenas quais transições existem estruturalmente; **quem** pode disparar cada uma é tratado separadamente por RN06/RN07/RN07a.
- **RN06**: O Cliente dono do pedido pode cancelá-lo **somente** enquanto o status for `pendente`. Ao cancelar, o estoque dos itens é restaurado.
- **RN07**: Um Admin (custom claim `admin: true` no Firebase Auth) pode alterar o status de qualquer pedido para qualquer transição válida (incluindo cancelar em qualquer estado anterior a `entregue`), e gerenciar o catálogo de Produtos (CRUD completo).
- **RN07a**: A restauração automática de estoque ao cancelar só ocorre se o pedido estava em `pendente` no momento do cancelamento (seja o cancelamento feito pelo Cliente ou pelo Admin). Se o Admin cancelar um pedido já em `confirmado` ou `enviado`, o estoque **não** é restaurado automaticamente — qualquer ajuste de estoque nesse caso é manual, fora do escopo da Fase 1.
- **RN08**: Um Cliente autenticado só pode listar/visualizar os próprios pedidos; nunca os de outro cliente. Um Admin pode listar/visualizar todos.
- **RN09**: Toda rota exige autenticação via Firebase Auth (ID token); rotas administrativas exigem adicionalmente o custom claim de admin.

**Casos de teste locais requeridos:** BDD/TDD com Jest + Supertest, executados contra o Firestore/Functions Emulator Suite (nunca contra projeto Firebase real). Meta: 70% de cobertura mínima, com cada RNxx acima rastreável a pelo menos um teste.

### 3. Decomposição de Tarefas (para o agente arquiteto-tarefas)
- **Módulo 1: Setup & Infra** — inicialização do projeto Firebase (Functions + Firestore + Emulators), TypeScript, Express, estrutura de pastas do monorepo, configuração de lint/format.
- **Módulo 2: Core Business** — modelos de dados (Produto, Pedido, Cliente), middleware de autenticação/autorização (Firebase Auth + custom claims), endpoints REST de Produtos e Pedidos implementando RN01–RN09, validação de entrada (Zod), tratamento de erro centralizado, documentação OpenAPI/Swagger.
- **Módulo 3: Testes e Cobertura** — suíte Jest + Supertest contra o Emulator Suite cobrindo todas as RNs, meta de 70% de cobertura.
- **Módulo 4 (paralelo, para devops-tech-writer): Infra de entrega** — CI/CD, README, convenções de Git, estratégia de deploy.

### 4. Requisitos de DevOps & Doc (para o agente devops-tech-writer)
- Repositório Git único (monorepo), estratégia **GitHub Flow** (main sempre deployável, feature branches curtas, PR para main).
- Convenção de commits: **Conventional Commits** (`feat:`, `fix:`, `chore:`, `test:`, `docs:`...).
- CI/CD: GitHub Actions — instala dependências, roda lint, roda testes contra o Firebase Emulator Suite; deploy para Firebase Functions só a partir de `main` (manual ou automático, a definir na implementação do pipeline).
- README.md deve documentar: como rodar localmente (emuladores), variáveis de ambiente/secrets necessários, como rodar os testes, como fazer deploy.
- Segredos via Firebase Secret Manager (`firebase functions:secrets:set`), nunca commitados.
- Nome do projeto Firebase e do repositório GitHub: `gscandelari-ecommerce-api`.

---

## Fase 2 (Integração de Pagamento — Stripe)

### 1. Visão Geral & Escopo
O mesmo domínio de Pedidos ganha integração real com o Stripe, **sempre em modo sandbox/teste** (este projeto nunca processa dinheiro real — usa exclusivamente chaves de teste do Stripe). O pagamento passa a ser criado automaticamente junto com o pedido, e sua confirmação/falha passa a disparar automaticamente as transições de status que hoje só o Admin faz manualmente.

Decisão técnica (não é regra de negócio, não precisou de aprovação do usuário): a integração usa a API de **PaymentIntent** do Stripe, não Checkout Session hospedado — como esta é uma API sem frontend, não há URLs de redirect (`success_url`/`cancel_url`) para expor; o `client_secret` retornado pela API é o que um futuro frontend usaria com Stripe.js/Elements para completar o pagamento.

### 2. Regras de Negócio & Casos de Teste (para o agente qa-negocio)
- **RN10**: Ao criar um Pedido (`POST /pedidos`), o sistema cria automaticamente uma PaymentIntent no Stripe no valor do `total` do pedido, com `metadata.pedidoId` apontando para o pedido criado. O `client_secret` e o `paymentIntentId` retornados pelo Stripe são persistidos no Pedido e incluídos na resposta do `POST /pedidos`.
- **RN11**: O endpoint `POST /webhooks/stripe` (rota pública, fora do middleware `authenticate`) recebe eventos do Stripe. Todo evento tem sua assinatura (`stripe-signature` header) validada contra o webhook signing secret antes de qualquer processamento; assinatura inválida → 400, sem efeito colateral.
- **RN12**: Evento `payment_intent.succeeded` recebido para um pedido em `pendente` transiciona o pedido para `confirmado` automaticamente — mesma transição que RN07 já permite ao Admin disparar manualmente, agora também disparável pelo webhook.
- **RN13**: Evento `payment_intent.payment_failed` (ou equivalente de falha/expiração) recebido para um pedido em `pendente` cancela o pedido automaticamente e restaura o estoque dos itens — reaproveita a mesma lógica de cancelamento de RN06/RN07a.
- **RN14**: Eventos de webhook já processados (mesmo `event.id` do Stripe) são ignorados em caso de reentrega/duplicata (idempotência) — não devem causar dupla transição de status nem dupla restauração de estoque.
- **RN15**: Se o `event.data.object.metadata.pedidoId` de um evento não corresponder a nenhum pedido existente, ou se o pedido já não estiver mais em `pendente` (ex.: evento atrasado chegando depois de já ter sido processado por outro caminho), o evento é aceito com 200 (para o Stripe não reenviar) mas não realiza nenhuma alteração — logado, não é erro do cliente.

**Casos de teste locais requeridos:** Jest + Supertest com o **SDK do Stripe mockado** (`jest.mock`) — sem chamada de rede real ao Stripe, sem depender de internet no CI. Meta: manter cobertura ≥70% (mesma meta da Fase 1).

### 3. Decomposição de Tarefas (para o agente arquiteto-tarefas)
- **Módulo 5: Integração Stripe** — cliente Stripe configurado (chave secreta via Secret Manager), criação de PaymentIntent na criação do pedido, persistência de `paymentIntentId`/`clientSecret`/`paymentStatus` no modelo de Pedido.
- **Módulo 6: Webhook & idempotência** — rota pública `POST /webhooks/stripe`, validação de assinatura, tratamento dos eventos `payment_intent.succeeded`/`payment_intent.payment_failed`, registro de eventos processados (nova coleção Firestore, ex. `stripeEvents`) para idempotência (RN14).
- **Módulo 7: Testes** — mocks do SDK do Stripe, casos cobrindo RN10–RN15, mantendo os testes da Fase 1 verdes (sem regressão).

### 4. Requisitos de DevOps & Doc (para o agente devops-tech-writer)
- Novos segredos via Firebase Secret Manager: chave secreta do Stripe (modo teste) e o webhook signing secret. Documentar no README como obter as chaves de teste do Stripe e como configurá-las localmente (emulador) e em produção.
- README deve documentar cartões de teste do Stripe (ex. `4242 4242 4242 4242`) para quem for testar o fluxo manualmente.
- Deploy do endpoint de webhook exige configurar a URL pública (`https://.../webhooks/stripe`) no Dashboard do Stripe (modo teste) — passo manual, documentar no README.
- Mesma estratégia de deploy manual (`workflow_dispatch`) já usada na Fase 1 — sem mudança.
