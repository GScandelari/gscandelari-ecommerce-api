## Spec Técnica Aprovada: gscandelari-ecommerce-api — Fase 1 (Core API)

### 1. Visão Geral & Escopo
Portfólio de demonstração de "Desenvolvimento de APIs REST robustas, integrações e microsserviços com Node.js e Express", construído em Firebase (Cloud Functions 2ª geração + Express + Firestore, plano Blaze).

O domínio é um **Sistema de Pedidos & Pagamentos (E-commerce Core)**, único, que evolui em 3 fases dentro de um **monorepo** chamado `gscandelari-ecommerce-api`:
- **Fase 1 (esta spec):** API core — Produtos, Pedidos, Clientes, sem gateway de pagamento real.
- **Fase 2 (futura, requer nova rodada de clarificação):** integração de pagamento real (gateway a definir) via webhook, cache de respostas externas em Firestore.
- **Fase 3 (futura, requer nova rodada de clarificação):** quebra em microsserviços (Orders, Payments, Notifications) comunicando-se via Firestore Triggers, com API Gateway via Firebase Hosting rewrites.

Esta spec cobre **apenas a Fase 1**.

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
