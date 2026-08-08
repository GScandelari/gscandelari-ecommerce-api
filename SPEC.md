## Spec Técnica Aprovada: gscandelari-ecommerce-api

Portfólio de demonstração de "Desenvolvimento de APIs REST robustas, integrações e microsserviços com Node.js e Express", construído em Firebase (Cloud Functions 2ª geração + Express + Firestore, plano Blaze).

O domínio é um **Sistema de Pedidos & Pagamentos (E-commerce Core)**, único, que evolui em fases dentro de um **monorepo** chamado `gscandelari-ecommerce-api`:
- **Fase 1 (concluída, deployada):** API core — Produtos, Pedidos, Clientes, sem gateway de pagamento real.
- **Fase 2 (concluída, deployada):** integração de pagamento real (Stripe, sempre em modo sandbox/teste) via PaymentIntent + webhook.
- **Fase 3 (concluída, código em `main`, deploy real ainda não executado):** quebra em microsserviços (Orders, Payments, Notifications), cada um um codebase de Cloud Functions deployável independentemente, com API Gateway via Firebase Hosting rewrites.
- **Fase 4 (concluída):** front-end de testes (React + Vite) para clientes e administradores, rodando contra o Emulator Suite (monólito da Fase 1+2).
- **Fase 5 (esta spec):** cancelamento pós-pagamento e reembolso — emenda às regras de status/cancelamento da Fase 1 (RN05/RN06/RN07) e de pagamento da Fase 2, com o front-end da Fase 4 refletindo o novo fluxo.

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

---

## Fase 3 (Microsserviços)

### 1. Visão Geral & Escopo
O sistema, hoje um único codebase de Cloud Functions (Fase 1+2), é reestruturado em **3 serviços independentes**, cada um seu próprio codebase de Cloud Functions (deploy independente):
- **Orders**: Produtos + Pedidos (Fase 1) — dono exclusivo da coleção `pedidos` no Firestore.
- **Payments**: integração Stripe + webhook (Fase 2), extraído para um serviço próprio.
- **Notifications** (novo): envia e-mail (Resend, sempre modo teste/sandbox) quando um pedido é confirmado ou cancelado.

Um **API Gateway** (Firebase Hosting com rewrites) expõe um único domínio público na frente dos 3 serviços.

Decisões técnicas (não são regras de negócio, não precisaram de aprovação do usuário além do padrão de comunicação abaixo, que foi decidido explicitamente pelo usuário):
- Comunicação **Orders → Payments** e **Payments → Orders** é **HTTP síncrona interna**, autenticada via ID token assinado pelo Google (OIDC nativo do GCP para chamadas serviço-a-serviço), não Firebase Auth (que é só para clientes finais) nem secret compartilhado.
- Comunicação para **Notifications** é **assíncrona** via Firestore Trigger (`onDocumentUpdated` em `pedidos`) — assimetria deliberada: Orders↔Payments precisa de resposta imediata (RN10), Notifications é fire-and-forget.
- Nenhum serviço além de Orders escreve na coleção `pedidos`.

### 2. Regras de Negócio & Casos de Teste (para o agente qa-negocio)
- **RN16**: Ao criar um pedido, Orders chama o serviço Payments via HTTP síncrono interno para criar a PaymentIntent (equivalente ao que hoje é uma chamada de função local) — o contrato de `POST /pedidos` para o cliente final não muda (RN10 continua valendo: `paymentIntentId`/`clientSecret` retornados na mesma resposta).
- **RN17**: Quando o webhook do Stripe (hospedado no serviço Payments) recebe `payment_intent.succeeded`/`payment_intent.payment_failed`/`payment_intent.canceled`, Payments chama um endpoint HTTP interno do Orders para efetivar a transição de status (equivalente às RN12/RN13 já existentes) — Payments nunca escreve diretamente no Firestore na coleção `pedidos`.
- **RN18**: Toda chamada HTTP interna entre serviços (Orders↔Payments) exige um ID token válido assinado pelo Google, verificado pelo serviço receptor; requisição sem token ou com token inválido é rejeitada (401), independente de qualquer Firebase Auth de cliente final.
- **RN19**: O serviço Notifications reage a mudanças na coleção `pedidos` (Firestore Trigger) e envia um e-mail para o cliente dono do pedido quando `status` transiciona para `confirmado` ou `cancelado`. Falha no envio de e-mail é registrada mas **nunca** reverte ou bloqueia a transição de status já efetivada por Orders (best-effort, fora do fluxo crítico).
- **RN20**: O API Gateway (Firebase Hosting rewrites) roteia `/produtos` e `/pedidos` (rotas públicas) para Orders, e `/webhooks/stripe` para Payments, através de um único domínio público. Notifications não expõe nenhuma rota pública.

**Casos de teste locais requeridos:** Jest + Supertest por serviço (cada codebase com sua própria suíte), mockando a comunicação HTTP entre serviços e o SDK do Resend (mesmo padrão de mock já usado para o Stripe na Fase 2). Meta: manter cobertura ≥70% em cada serviço.

### 3. Decomposição de Tarefas (para o agente arquiteto-tarefas)
- **Módulo 8: Reestruturação multi-codebase** — `firebase.json` com múltiplos `codebases`, reorganização de `functions/` em `services/orders/`, `services/payments/`, `services/notifications/`, migração do código já existente (Fase 1 → Orders, Fase 2 → Payments) sem regressão nos 63 testes já existentes.
- **Módulo 9: Extração do serviço Payments + comunicação síncrona** — endpoint interno em Payments para Orders chamar (criação de PaymentIntent), endpoint interno em Orders para Payments chamar (transição de status via webhook), autenticação via ID token Google nos dois sentidos (RN16-RN18).
- **Módulo 10: Serviço Notifications (novo)** — cliente Resend (mesmo padrão de singleton do Stripe/Firebase Admin), Firestore Trigger reagindo a mudanças de `status` em `pedidos`, envio de e-mail best-effort (RN19).
- **Módulo 11: API Gateway (Firebase Hosting)** — configuração de rewrites roteando para os 3 serviços (RN20).
- **Módulo 12: Testes e regressão** — suíte por serviço, mocks de comunicação inter-serviço e do Resend, confirmação de zero regressão nas RN01-RN15 já existentes.

### 4. Requisitos de DevOps & Doc (para o agente devops-tech-writer)
- Novo segredo via Firebase Secret Manager: chave de API do Resend (modo teste/sandbox).
- CI/CD: workflows precisam lidar com múltiplos codebases (lint/build/test por serviço; deploy por codebase, ex. `firebase deploy --only functions:orders,functions:payments,functions:notifications,hosting`).
- README deve documentar a nova arquitetura (diagrama textual dos 3 serviços + gateway), como rodar todos os serviços localmente no Emulator Suite, e como testar o fluxo de notificação por e-mail manualmente.
- Mesma estratégia de deploy manual (`workflow_dispatch`) já usada nas Fases 1/2 — sem mudança.

---

## Fase 4 (Front-end de testes)

### 1. Visão Geral & Escopo
Uma SPA em **React + Vite (TypeScript)**, em `web/` na raiz do monorepo, para exercitar visualmente a API já construída (Fases 1-2) — não é o produto final do portfólio (esse é a API), é uma **ferramenta de teste/demonstração**. Roda **exclusivamente contra o Firebase Emulator Suite local**, apontando para o monólito da Fase 1+2 (`functions/`, codebase `default`) — nunca contra o projeto Firebase real. Dois perfis de uso: **Cliente** (comprador) e **Administrador** (custom claim `admin: true`), na mesma aplicação, com rotas de admin condicionadas ao claim.

Decisão técnica (não é regra de negócio): o front-end **não acessa Firestore diretamente** — usa Firebase Auth (client SDK, contra o Auth Emulator) só para login/cadastro e obter o ID token, e todas as operações de dados passam pela API REST já existente (`fetch` com `Authorization: Bearer <idToken>`), reaproveitando toda a validação/regra de negócio já implementada no backend.

### 2. Regras de Negócio & Casos de Teste (para o agente qa-negocio)
- **RN21**: A aplicação permite cadastro e login de clientes via Firebase Auth (email/senha), contra o Auth Emulator.
- **RN22**: Cliente autenticado visualiza o catálogo de produtos disponíveis (`GET /produtos`).
- **RN23**: Cliente autenticado monta um pedido (1+ itens) e o cria (`POST /pedidos`); a aplicação usa o `paymentClientSecret` retornado para completar o pagamento via Stripe Elements (cartão de teste), exercitando RN10 de ponta a ponta.
- **RN24**: Cliente autenticado visualiza a lista dos próprios pedidos com status atual (`GET /pedidos`) e pode cancelar um pedido próprio enquanto `pendente` (`PATCH /pedidos/:id/cancelar`, RN06).
- **RN25**: Administrador (claim `admin`) tem acesso a uma área exclusiva com: CRUD completo de Produtos (RN01/RN07) e gestão de Pedidos — listar todos, ver detalhe, alterar status manualmente entre as transições válidas (RN05/RN07/RN07a).
- **RN26**: Rotas/UI de admin são escondidas no front-end para quem não tem o claim, mas isso é só UX — a autorização real continua sendo enforced pelo backend (`requireAdmin`); o front-end nunca é a fonte de verdade de autorização.
- **RN27**: A aplicação nunca se conecta a um projeto Firebase real — toda configuração (Auth, chamadas à API) aponta para o Emulator Suite local por padrão.

**Casos de teste locais requeridos:** Vitest + React Testing Library (componentes/fluxos principais, com `fetch`/Firebase Auth mockados), sem depender de emulador rodando nos testes automatizados.

### 3. Decomposição de Tarefas (para o agente arquiteto-tarefas)
- **Módulo 13: Setup do projeto** — Vite + React + TypeScript em `web/`, Tailwind CSS, roteamento (React Router), cliente Firebase Auth configurado para o Emulator, cliente HTTP fino para a API.
- **Módulo 14: Autenticação** — telas de login/cadastro, contexto de auth (usuário atual + claims), rotas protegidas (cliente autenticado / admin).
- **Módulo 15: Área do Cliente** — catálogo de produtos, montagem e criação de pedido, integração Stripe Elements para completar pagamento, histórico de pedidos com cancelamento (RN21-RN24).
- **Módulo 16: Área do Admin** — CRUD de Produtos, listagem/detalhe/alteração de status de Pedidos (RN25).
- **Módulo 17: Testes e documentação** — Vitest + RTL para os fluxos principais, README de como rodar (emulador + front-end juntos).

### 4. Requisitos de DevOps & Doc (para o agente devops-tech-writer)
- `.env.example` do front-end: config do Firebase Web App (placeholders, funcionam com o Emulator sem valores reais) e chave publicável do Stripe (`pk_test_...`, não é segredo, mas fica como placeholder mesmo assim).
- README deve documentar como rodar o front-end junto com o Emulator Suite (dois processos: `firebase emulators:start` + `npm run dev` em `web/`), incluindo criar um usuário admin de teste via `functions/scripts/setAdminClaim.js`.
- CI leve (lint + build + test) para `web/`, mesmo padrão de `ci-services.yml`. Sem deploy — a aplicação não é publicada nesta fase (uso local/experimentação, conforme decisão do usuário).

---

## Fase 5 (Cancelamento pós-pagamento e Reembolso)

### 1. Visão Geral & Escopo

Emenda às regras de status/cancelamento de pedido (Fase 1, RN05/RN06/RN07) e de pagamento (Fase 2): hoje o Cliente só pode cancelar um pedido em `pendente`, e nenhum cancelamento — nem do Cliente, nem do Admin — dispara qualquer estorno real no Stripe (a Fase 1 documenta isso deliberadamente como fora de escopo, RN07a). Esta fase resolve a lacuna, encontrada durante testes manuais de ponta a ponta da Fase 4 (Emulator Suite + Stripe CLI): o cliente pode querer cancelar um pedido já pago, e quando isso acontece o dinheiro precisa ser devolvido — mas de forma **deliberadamente manual e caso a caso pelo Admin**, nunca automática, e nunca antes de confirmar se o produto físico precisa ou não retornar primeiro.

Esta fase afeta código já em produção real (`functions/`, Fases 1+2) e a área de Cliente/Admin do front-end de testes (`web/`, Fase 4). Não afeta a Fase 3 (`services/`), que continua sem deploy real por decisão já registrada do usuário — a emenda é replicada lá apenas por consistência de código-fonte (mesma duplicação deliberada já usada para `webhooks.routes.ts`), sem qualquer ação de deploy.

Decisão técnica (não é regra de negócio): assim como a criação de PaymentIntent (RN10), a chamada de estorno ao Stripe é uma chamada de rede — nunca pode acontecer dentro de uma `db.runTransaction` do Firestore; roda depois, com compensação manual (reflexo em `paymentStatus`) se falhar.

### 2. Regras de Negócio & Casos de Teste (para o agente qa-negocio)
- **RN28**: O Cliente dono do pedido pode cancelá-lo enquanto o status for `pendente` **ou** `confirmado` — nos dois casos o pedido vai imediatamente para `cancelado` (estende RN06, que hoje cobre só `pendente`). Estoque é restaurado nos dois casos (mesma lógica de RN07a para `pendente`; para `confirmado`, estoque também é restaurado agora, já que o produto ainda não foi despachado).
- **RN29**: Cancelar um pedido em `enviado` — seja a pedido do Cliente dono, seja por ação direta do Admin — **não** vai direto para `cancelado`. Vai para um novo status intermediário, `aguardando_devolucao`, refletindo que o produto ainda está fisicamente com o cliente. Isso se sobrepõe à parte de RN07 que hoje permite ao Admin cancelar diretamente a partir de `enviado`.
- **RN30**: Somente o Admin pode transicionar `aguardando_devolucao → cancelado`, confirmando que o produto retornou fisicamente. Ao confirmar, o estoque dos itens é restaurado (mesma lógica de RN07a).
- **RN31**: Nenhuma transição para `cancelado` (por RN28, RN29+RN30, ou o cancelamento já existente do Admin a partir de `pendente`) dispara reembolso automático. Se o pedido cancelado tinha `paymentStatus: "pago"` no momento do cancelamento (ou seja, o cancelamento partiu de `confirmado`, `enviado` ou `aguardando_devolucao` — nunca de `pendente`, onde ainda não há cobrança confirmada), `paymentStatus` passa para o novo valor `"estorno_pendente"`, sinalizando que um reembolso é devido mas ainda não foi processado.
- **RN32**: O Admin tem uma ação dedicada "Solicitar reembolso" (`PATCH /pedidos/:id/reembolsar` ou equivalente), disponível apenas quando `paymentStatus === "estorno_pendente"`, que chama a API de Refunds do Stripe (`stripe.refunds.create`) pelo valor total do pedido (`pedido.total` — sem reembolso parcial nesta fase) e atualiza `paymentStatus` para `"reembolsado"` em caso de sucesso. Em caso de falha na chamada ao Stripe, `paymentStatus` permanece `"estorno_pendente"` (permite nova tentativa) e a resposta é um erro de gateway (mesmo padrão de RN10/`PaymentGatewayError`, 502) — esta ação é independente de qualquer transição de `status` do pedido (o pedido já está `cancelado`; só o `paymentStatus` muda).
- **RN33**: `PedidoStatus` ganha o valor `aguardando_devolucao` (entre `enviado` e `cancelado` no fluxo); `PaymentStatus` ganha os valores `estorno_pendente` e `reembolsado`. A máquina de estados de RN05 é atualizada: `enviado → [entregue, aguardando_devolucao]` (troca `cancelado` por `aguardando_devolucao` como destino de cancelamento a partir daqui); `aguardando_devolucao → [cancelado]` (somente Admin, RN30).

**Casos de teste locais requeridos:** Jest + Supertest com o SDK do Stripe mockado (mesmo padrão da Fase 2, `mockStripe`/`refunds.create` mockado), cobrindo RN28-RN33 sem regressão nas RN01-RN15 já existentes (em especial: a máquina de estados RN05 muda, então os testes existentes de transição a partir de `enviado` precisam ser revistos). Meta: manter cobertura ≥70%.

### 3. Decomposição de Tarefas (para o agente arquiteto-tarefas)
- **Módulo 18: Máquina de estados e modelo de dados** — novo valor `aguardando_devolucao` em `PedidoStatus`, novos valores `estorno_pendente`/`reembolsado` em `PaymentStatus`, atualização da tabela de transições válidas (RN33), sem regressão nos testes existentes de RN05.
- **Módulo 19: Cancelamento estendido** — `PATCH /pedidos/:id/cancelar` (Cliente) passa a aceitar `confirmado` além de `pendente` (RN28) e a rotear para `aguardando_devolucao` quando `enviado`; `PATCH /pedidos/:id/status` (Admin) idem para o caso `enviado → aguardando_devolucao` e `aguardando_devolucao → cancelado` (RN29/RN30); lógica de marcar `paymentStatus: "estorno_pendente"` quando aplicável (RN31).
- **Módulo 20: Endpoint de reembolso** — novo endpoint admin-only para solicitar reembolso via Stripe (RN32), cliente Stripe já existente (`stripeClient.ts`) reaproveitado, chamada de rede fora de qualquer transação Firestore.
- **Módulo 21: Front-end (`web/`)** — Área do Cliente: botão de cancelar passa a aparecer também em `confirmado`/`enviado` (com aviso de que, a partir de `enviado`, o cancelamento aguarda confirmação de devolução); Área do Admin: novo status `aguardando_devolucao` no seletor de transições, novo botão "Solicitar reembolso" quando `paymentStatus === "estorno_pendente"`.
- **Módulo 22: Testes e regressão** — cobertura de RN28-RN33 em `functions/` (e replicada em `services/orders`+`services/payments`, Fase 3, sem deploy), testes Vitest/RTL novos para os componentes alterados do Módulo 21, confirmação de zero regressão nas RNs já existentes.

### 4. Requisitos de DevOps & Doc (para o agente devops-tech-writer)
- Nenhum segredo novo (reaproveita `STRIPE_SECRET_KEY` já configurado).
- README (raiz): atualizar a documentação da máquina de estados e do fluxo de cancelamento/reembolso; deixar claro que o reembolso é sempre uma ação manual e deliberada do Admin, nunca automática.
- Sem mudança na estratégia de deploy (`workflow_dispatch`, manual) — esta fase, assim como as demais mudanças em `functions/` desde a Fase 2, só é promovida a produção real mediante decisão explícita do usuário.
