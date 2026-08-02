## Backlog: gscandelari-ecommerce-api — Fase 1 (Core API)

> Gerado a partir de SPEC.md. Este backlog fragmenta os Módulos 1-4 (seções 3 e 4 da spec) em épicos e tasks técnicas pequenas, testáveis de forma independente. Regras de escopo/negócio não foram reabertas; qualquer lacuna encontrada está sinalizada na seção "Bloqueios" ao final, para retorno ao agente clarificador.

### Ordem sugerida de execução (visão macro)
1. **Módulo 1** (Setup & Infra) — pré-requisito de tudo.
2. **Módulo 4 / Épico 4.1** (Git & convenções) — pode começar em paralelo ao Módulo 1.
3. **Módulo 2** (Core Business) — depende do Módulo 1. Ordem interna: 2.1 → 2.2 → 2.3 → 2.6 → 2.4 → 2.5 → 2.7.
4. **Módulo 3** (Testes) — depende de cada fatia do Módulo 2 conforme ela é concluída (pode ser feito TDD/BDD em paralelo, mas a suíte completa só fecha após 2.4 e 2.5).
5. **Módulo 4 / Épicos 4.2-4.5** (CI/CD, README, secrets, deploy) — em paralelo desde o início, mas o pipeline de testes (4.2.2) só fica verde após Módulo 3, e o deploy (4.2.3) só após Módulo 3 + 4.4 prontos.

---

### Módulo 1: Setup & Infra

- **Épico 1.1: Inicialização do monorepo e projeto Firebase**
  - [x] Task 1.1.1: Criar repositório e estrutura de pastas do monorepo (`functions/`, `docs/`, etc.) (critério de aceite: estrutura de pastas conforme convenção definida existe; primeiro commit realizado)
  - [x] Task 1.1.2: Inicializar projeto Firebase (`firebase init`) com Functions 2ª geração (Node 20), Firestore e Emulator Suite (Auth + Firestore + Functions) (critério de aceite: `firebase.json`/`.firebaserc` criados; `firebase emulators:start` sobe os 3 emuladores sem erro)
  - [x] Task 1.1.3: Configurar Firestore em modo nativo com `firestore.rules` restritivas (deny-all para client SDK; acesso só via backend/Admin SDK) (critério de aceite: tentativa de leitura/escrita direta via client SDK é negada, validado no emulator)
  Dependências: nenhuma (ponto de partida do projeto).

- **Épico 1.2: TypeScript + Express skeleton**
  - [x] Task 1.2.1: Configurar TypeScript em `functions/` (tsconfig, scripts de build) (critério de aceite: `npm run build` compila sem erros e gera artefato de saída)
  - [x] Task 1.2.2: Criar app Express básico exportado como Cloud Function HTTPS 2ª geração (`onRequest`) (critério de aceite: `GET /health` retorna 200 `{"status":"ok"}` no emulator)
  - [x] Task 1.2.3: Configurar variáveis de ambiente locais para o emulator (critério de aceite: app lê uma variável de exemplo e a expõe em `/health` ou log, sem erro no emulator)
  Dependências: Task 1.1.2.

- **Épico 1.3: Qualidade de código e estrutura**
  - [x] Task 1.3.1: Configurar ESLint + Prettier com regras TypeScript (critério de aceite: `npm run lint` roda sem erro no projeto inicial; arquivo propositalmente mal formatado é detectado)
  - [x] Task 1.3.2: Configurar hook de pre-commit (husky/lint-staged ou script equivalente) (critério de aceite: commit contendo erro de lint é bloqueado localmente)
  - [x] Task 1.3.3: Definir estrutura de pastas internas de `src/` (`routes/`, `models/`, `middlewares/`, `services/`, `repositories/`, `utils/`) com path aliases (critério de aceite: import via alias compila e resolve corretamente)
  Dependências: Task 1.2.1 (lint/estrutura podem rodar em paralelo à 1.2.2/1.2.3).

---

### Módulo 2: Core Business

> Tabela de rastreabilidade RN → Tasks ao final desta seção, para uso do agente qa-negocio.

- **Épico 2.1: Modelos de dados**
  - [x] Task 2.1.1: Definir tipo/interface TypeScript de Produto (nome, preço, estoque inteiro) — implementa **RN01** (critério de aceite: interface `Produto` tipada, `estoque: number` documentado como inteiro ≥ 0)
  - [x] Task 2.1.2: Definir tipo/interface TypeScript de Cliente a partir do ID Token do Firebase Auth (uid, email, claims) — implementa **RN02**, **RN09** (critério de aceite: interface `Cliente`/`AuthUser` reflete os campos usados do decoded ID token) — implementado como augmentation de `Express.Request.user` em `src/types/express.d.ts`, em vez de uma interface `Cliente` separada (o decoded token só é usado via `req.user`).
  - [x] Task 2.1.3: Definir tipo/interface TypeScript de Pedido (clienteId, itens[produtoId+quantidade+precoUnitario], total, status enum, timestamps) — implementa **RN02**, **RN05** (critério de aceite: interface `Pedido` com `status: 'pendente'|'confirmado'|'enviado'|'entregue'|'cancelado'` e `itens: ItemPedido[]`)
  - [x] Task 2.1.4: Repository de Produtos no Firestore (CRUD puro, sem regra de negócio) (critério de aceite: create/get/list/update/delete funcionam contra o Firestore Emulator, testados manualmente)
  - [x] Task 2.1.5: Repository de Pedidos no Firestore (create/get/list/update, incluindo `list` filtrado por `clienteId`) (critério de aceite: operações funcionam contra o Firestore Emulator, incluindo listagem filtrada) — `create`/`update` ficaram no `pedidosService` (não no repository) porque precisam rodar dentro da mesma transação Firestore que decrementa/restaura estoque em `produtos`; o repository expõe leitura (`get`/`list`).
  Dependências: Módulo 1 completo.

- **Épico 2.2: Autenticação & Autorização — implementa RN09**
  - [x] Task 2.2.1: Middleware `authenticate` — valida Firebase ID Token do header `Authorization: Bearer` — implementa **RN09** (critério de aceite: sem token → 401; token inválido/expirado → 401; token válido → popula `req.user` com `uid`/`claims` e segue adiante)
  - [x] Task 2.2.2: Middleware `requireAdmin` — verifica custom claim `admin: true` — implementa **RN07**, **RN09** (critério de aceite: usuário sem claim admin → 403; usuário com `admin: true` → segue adiante)
  - [x] Task 2.2.3: Script/utilitário de dev para atribuir custom claim `admin: true` a um usuário no Auth Emulator (critério de aceite: script documentado seta a claim; confirmado via `admin.auth().getUser`)
  Dependências: Task 2.1.2, Módulo 1.

- **Épico 2.3: Validação de entrada (Zod)**
  - [x] Task 2.3.1: Schemas Zod de Produto (create/update) — reforça **RN01** (critério de aceite: schema rejeita preço negativo, estoque não-inteiro/negativo e nome vazio; aceita payload válido)
  - [x] Task 2.3.2: Schemas Zod de Pedido (create com lista de itens; update de status) — reforça **RN02**, **RN05** (critério de aceite: schema rejeita pedido sem itens, quantidade ≤ 0, e status fora do enum permitido)
  - [x] Task 2.3.3: Middleware genérico `validate(schema)` que aplica o schema Zod e retorna 400 com detalhes de erro em caso de falha (critério de aceite: payload inválido retorna 400 com lista de campos inválidos; payload válido segue para o handler)
  Dependências: Tasks 2.1.1, 2.1.3.

- **Épico 2.4: Tratamento de erro centralizado**
  - [x] Task 2.4.1: Middleware de erro global do Express, com payload de resposta padronizado (`{ error: { code, message } }`) e sem vazamento de stack trace (critério de aceite: exceção não tratada lançada em qualquer handler retorna 500 com payload padronizado)
  - [x] Task 2.4.2: Classes de erro de domínio (`NotFoundError`, `ForbiddenError`, `ValidationError`, `ConflictError`) integradas ao middleware de erro (critério de aceite: lançar cada classe de erro em um handler resulta no status HTTP correspondente — 404/403/400/409 — com corpo padronizado)
  Dependências: Épico 2.2 e 2.3 (usa os mesmos padrões de resposta).

- **Épico 2.5: Endpoints REST de Produtos — implementa RN01, RN07, RN09**
  - [x] Task 2.5.1: `POST /produtos` — criar produto, admin only — implementa **RN01**, **RN07**, **RN09** (critério de aceite: admin com payload válido → 201 com produto criado; não-admin → 403; payload inválido → 400; sem token → 401)
  - [x] Task 2.5.2: `GET /produtos` — listar produtos, qualquer usuário autenticado — implementa **RN09** (critério de aceite: usuário autenticado → 200 com lista; sem token → 401)
  - [x] Task 2.5.3: `GET /produtos/:id` — detalhar produto — implementa **RN09** (critério de aceite: produto existente → 200; inexistente → 404; sem token → 401)
  - [x] Task 2.5.4: `PUT /produtos/:id` — atualizar produto, admin only — implementa **RN01**, **RN07**, **RN09** (critério de aceite: admin atualiza com dados válidos → 200; não-admin → 403; estoque negativo/tipo inválido → 400)
  - [x] Task 2.5.5: `DELETE /produtos/:id` — remover produto, admin only — implementa **RN07**, **RN09** (critério de aceite: admin remove produto existente → 204; não-admin → 403; inexistente → 404)
  Dependências: Épicos 2.1, 2.2, 2.3, 2.4.

- **Épico 2.6: Endpoints REST de Pedidos — implementa RN02 a RN09**
  - [x] Task 2.6.1: Função pura de máquina de estados de status de Pedido (dado status atual + status alvo, retorna válido/inválido; sem conhecimento de papel/autorização) — implementa **RN05** (critério de aceite: função testável cobre todas as transições válidas `pendente→confirmado→enviado→entregue`, mais `pendente→cancelado`, `confirmado→cancelado` e `enviado→cancelado`, e rejeita qualquer outra combinação, ex.: `enviado→confirmado` ou `entregue→cancelado`; a restrição de qual papel pode disparar cada transição é responsabilidade das Tasks 2.6.5/2.6.6, não desta função)
  - [x] Task 2.6.2: `POST /pedidos` — criar pedido — implementa **RN02**, **RN03**, **RN04**, **RN09** (critério de aceite: cliente autenticado cria pedido com estoque suficiente → 201, total calculado a partir do preço vigente dos produtos, estoque decrementado imediatamente; item com estoque insuficiente → 400, sem alteração de estoque e sem pedido persistido; sem token → 401)
  - [x] Task 2.6.3: `GET /pedidos` — listar pedidos — implementa **RN08**, **RN09** (critério de aceite: cliente autenticado recebe somente os próprios pedidos; admin recebe todos os pedidos; sem token → 401)
  - [x] Task 2.6.4: `GET /pedidos/:id` — detalhar pedido — implementa **RN08**, **RN09** (critério de aceite: cliente dono acessa o próprio pedido → 200; cliente tentando acessar pedido de outro cliente → 403; admin acessa qualquer pedido → 200; inexistente → 404)
  - [x] Task 2.6.5: `PATCH /pedidos/:id/status` — transição de status por Admin — implementa **RN05**, **RN07**, **RN07a**, **RN09** (critério de aceite: admin aplica transição válida → 200 com novo status persistido; admin tenta transição inválida → 400; não-admin → 403; se a transição for para `cancelado` e o status anterior era `pendente` → estoque dos itens é restaurado; se a transição for para `cancelado` e o status anterior era `confirmado` ou `enviado` → estoque **não** é alterado; usa a função da Task 2.6.1)
  - [x] Task 2.6.6: `PATCH /pedidos/:id/cancelar` — cancelamento pelo Cliente dono — implementa **RN06**, **RN08**, **RN09** (critério de aceite: cliente dono cancela pedido em status `pendente` → 200, status vira `cancelado`, estoque dos itens restaurado; cliente tenta cancelar pedido fora de `pendente` → 400; cliente tenta cancelar pedido de outro cliente → 403)
  Dependências: Épicos 2.1, 2.2, 2.3, 2.4 e Épico 2.5 (Produtos precisam existir para Pedidos referenciá-los); Task 2.6.1 antes de 2.6.5 e 2.6.6.

- **Épico 2.7: Documentação OpenAPI/Swagger**
  - [ ] Task 2.7.1: Especificação OpenAPI 3.0 (paths, schemas, security schemes) para Produtos e Pedidos (critério de aceite: arquivo `openapi.yaml`/`.json` válido em linter de OpenAPI, cobrindo todos os endpoints dos Épicos 2.5 e 2.6)
  - [ ] Task 2.7.2: Expor Swagger UI (`swagger-ui-express`) em `/docs` no ambiente de dev/emulator (critério de aceite: `GET /docs` no emulator renderiza UI navegável com todos os endpoints documentados)
  Dependências: Épicos 2.5 e 2.6 com contratos definidos (pode iniciar em paralelo à implementação final, mas fecha só depois).

#### Rastreabilidade RN → Tasks (Módulo 2)

| Regra | Descrição resumida | Tasks que implementam |
|---|---|---|
| RN01 | Produto: nome, preço, estoque inteiro ≥0 | 2.1.1, 2.3.1, 2.5.1, 2.5.4 |
| RN02 | Pedido pertence a cliente, 1+ itens, total calculado na criação | 2.1.2, 2.1.3, 2.3.2, 2.6.2 |
| RN03 | Criação rejeitada se estoque insuficiente, sem efeito colateral | 2.6.2 |
| RN04 | Estoque decrementado imediatamente na criação | 2.6.2 |
| RN05 | Fluxo de status e transições válidas | 2.1.3, 2.3.2, 2.6.1, 2.6.5 |
| RN06 | Cliente cancela somente em `pendente`; restaura estoque | 2.6.6 |
| RN07 | Admin altera status livremente (regras de transição) e CRUD de Produtos | 2.2.2, 2.5.1, 2.5.4, 2.5.5, 2.6.5 |
| RN07a | Estoque só é restaurado no cancelamento se o pedido estava `pendente`; cancelamento pelo Admin em `confirmado`/`enviado` não restaura estoque | 2.6.5, 3.3.4 |
| RN08 | Cliente só vê os próprios pedidos; Admin vê todos | 2.6.3, 2.6.4, 2.6.6 |
| RN09 | Toda rota exige autenticação; rotas admin exigem claim | 2.2.1, 2.2.2, 2.5.1–2.5.5, 2.6.2–2.6.6 |

---

### Módulo 3: Testes e Cobertura

- **Épico 3.1: Setup do ambiente de testes**
  - [x] Task 3.1.1: Configurar Jest + ts-jest em `functions/` (critério de aceite: `npm test` executa e passa um teste trivial de sanidade)
  - [x] Task 3.1.2: Configurar Supertest apontando para o app Express exportado (sem subir Functions completo) (critério de aceite: teste de exemplo faz `GET /health` via Supertest contra o app importado e recebe 200)
  - [x] Task 3.1.3: Script para rodar a suíte contra o Firebase Emulator Suite (`firebase emulators:exec`) (critério de aceite: `npm run test:emulator` sobe Auth+Firestore, roda a suíte Jest, encerra os emuladores, e propaga falha via exit code)
  - [x] Task 3.1.4: Helper de teste para criar usuários no Auth Emulator com/sem custom claim admin e obter ID token (critério de aceite: função utilitária `createTestUser({ admin })` retorna um ID token válido usável nos testes)
  - [x] Task 3.1.5: Helper de teste para popular/limpar coleções do Firestore Emulator entre casos de teste (critério de aceite: `beforeEach`/`afterEach` limpam `produtos`/`pedidos`, evitando vazamento de estado entre testes)
  Dependências: Módulo 1 e Módulo 2 (endpoints implementados, ao menos incrementalmente).

- **Épico 3.2: Testes de Produtos — cobre RN01, RN07, RN09**
  - [x] Task 3.2.1: Testes de `POST /produtos` (válido, payload inválido, não-admin, sem token) (critério de aceite: os 4 cenários cobertos e verdes)
  - [x] Task 3.2.2: Testes de `GET /produtos`, `GET /produtos/:id`, `PUT /produtos/:id`, `DELETE /produtos/:id` (sucesso e cenários de erro 400/401/403/404) (critério de aceite: cenários de sucesso e erro cobertos e verdes)
  Dependências: Épico 3.1, Épico 2.5.

- **Épico 3.3: Testes de Pedidos — cobre RN02 a RN08**
  - [x] Task 3.3.1: Teste de criação de pedido com estoque suficiente — cobre **RN02**, **RN04** (critério de aceite: pedido criado com 201, total calculado corretamente, estoque decrementado — validado por leitura direta no Firestore Emulator)
  - [x] Task 3.3.2: Teste de criação de pedido com estoque insuficiente — cobre **RN03** (critério de aceite: resposta 400; estoque do produto inalterado; nenhum pedido persistido)
  - [x] Task 3.3.3: Teste de listagem/detalhe de pedidos por cliente vs. admin — cobre **RN08** (critério de aceite: cliente A não enxerga pedidos de cliente B; `GET` direto no pedido de outro cliente retorna 403; admin enxerga todos)
  - [x] Task 3.3.4: Teste de transições de status válidas e inválidas pelo admin — cobre **RN05**, **RN07**, **RN07a** (critério de aceite: sequência `pendente→confirmado→enviado→entregue` aceita; `enviado→confirmado` rejeitada com 400; não-admin tentando mudar status recebe 403; admin cancelando pedido `pendente` restaura estoque, validado no Firestore; admin cancelando pedido `confirmado` ou `enviado` **não** restaura estoque, validado no Firestore)
  - [x] Task 3.3.5: Teste de cancelamento pelo cliente dono e restauração de estoque — cobre **RN06**, **RN08** (critério de aceite: cancelamento em `pendente` restaura estoque, validado no Firestore, e muda status para `cancelado`; cancelamento fora de `pendente` pelo cliente é rejeitado com 400; cliente cancelando pedido alheio recebe 403)
  Dependências: Épico 3.1, Épico 2.6.

- **Épico 3.4: Testes de autenticação/autorização transversais — cobre RN09**
  - [x] Task 3.4.1: Teste unitário do middleware `authenticate` (token ausente, inválido, expirado, válido) — cobre **RN09** (critério de aceite: os 4 cenários cobertos com asserts diretos no middleware)
  - [x] Task 3.4.2: Teste unitário do middleware `requireAdmin` (sem claim, com claim) — cobre **RN07**, **RN09** (critério de aceite: os 2 cenários cobertos e verdes)
  Dependências: Épico 3.1, Épico 2.2.

- **Épico 3.5: Cobertura e rastreabilidade final**
  - [x] Task 3.5.1: Configurar coleta de cobertura Jest (`--coverage`) com threshold mínimo de 70% (branches/functions/lines/statements) (critério de aceite: `npm run test:coverage` falha o build se qualquer métrica ficar abaixo de 70%) — resultado real: 96.2% statements / 75.6% branches / 96.1% functions / 97.6% lines.
  - [x] Task 3.5.2: Checklist/tabela final de rastreabilidade RN→teste confirmando que RN01 a RN09 têm ao menos 1 teste automatizado cada (critério de aceite: tabela produzida — em conjunto com o agente qa-negocio — sem nenhuma RN órfã) — tabela "Rastreabilidade RN → Tasks" acima; todas as RN01-RN09/RN07a têm teste correspondente em `test/integration/` ou `test/unit/`.
  Dependências: Épicos 3.2, 3.3, 3.4 completos.

---

### Módulo 4 (paralelo, devops-tech-writer): Infra de entrega

- **Épico 4.1: Git & convenções**
  - [ ] Task 4.1.1: Criar repositório remoto no GitHub `gscandelari-ecommerce-api`, branch `main` protegida (critério de aceite: repo criado, `main` é branch default e protegida exigindo PR)
  - [ ] Task 4.1.2: Documentar convenção Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`...) (critério de aceite: `CONTRIBUTING.md` ou seção no README descreve a convenção; opcionalmente `commitlint` configurado)
  - [ ] Task 4.1.3: Documentar e configurar fluxo GitHub Flow (feature branches curtas, PR obrigatório para `main`) (critério de aceite: documento descreve o fluxo; branch protection exige PR + checks antes de merge)
  Dependências: nenhuma — pode iniciar em paralelo ao Módulo 1.

- **Épico 4.2: CI/CD (GitHub Actions)**
  - [ ] Task 4.2.1: Workflow de CI — instalar dependências e rodar lint em cada PR (critério de aceite: PR com erro de lint falha o check; PR limpo passa)
  - [ ] Task 4.2.2: Workflow de CI — rodar testes (Jest+Supertest) contra o Firebase Emulator Suite dentro do runner (critério de aceite: workflow sobe/usa `firebase emulators:exec`, roda a suíte completa, falha o PR se algum teste falhar)
  - [ ] Task 4.2.3: Workflow de CD — deploy para Firebase Functions a partir de `main` (critério de aceite: `firebase deploy --only functions` executa usando credenciais via GitHub Secret, disparado apenas quando branch = `main`, conforme estratégia definida na Task 4.5.1)
  Dependências: 4.2.1/4.2.2 requerem scripts de lint/test do Módulo 1/3 existentes; 4.2.3 depende de 4.2.1, 4.2.2 verdes e da Task 4.4.3.

- **Épico 4.3: Documentação (README)**
  - [ ] Task 4.3.1: Seção "Como rodar localmente" (instalação, emuladores) (critério de aceite: seguindo os passos do zero, um dev sobe os emuladores e acessa `/health`)
  - [ ] Task 4.3.2: Seção "Variáveis de ambiente / secrets necessários" (critério de aceite: README lista cada variável/secret com descrição e exemplo, sem valores reais)
  - [ ] Task 4.3.3: Seção "Como rodar os testes" (critério de aceite: seguindo os passos, `npm run test:emulator` roda com sucesso)
  - [ ] Task 4.3.4: Seção "Como fazer deploy" (critério de aceite: passos descritos reproduzem o deploy manual via Firebase CLI)
  Dependências: melhor qualidade se feito após Módulos 1-3 definidos, mas pode ser escrito incrementalmente desde o início.

- **Épico 4.4: Gestão de segredos**
  - [ ] Task 4.4.1: Levantar lista de segredos necessários da aplicação na Fase 1 (critério de aceite: lista documentada; como a Fase 1 não integra gateway de pagamento real, documentar explicitamente quais segredos de app existem ou registrar "N/A nesta fase" além das credenciais de deploy)
  - [ ] Task 4.4.2: Configurar Firebase Secret Manager para os segredos de aplicação identificados, via `firebase functions:secrets:set` (critério de aceite: segredo(s) configurado(s) e referenciado(s) no código, nenhum valor commitado no repositório) — condicional ao resultado da Task 4.4.1
  - [ ] Task 4.4.3: Configurar credenciais de deploy (service account) como GitHub Secret para uso no workflow de CD (critério de aceite: GitHub Actions autentica no Firebase via secret configurado, sem expor credenciais em log)
  Dependências: Task 4.4.1 primeiro; 4.4.3 é pré-requisito da Task 4.2.3.

- **Épico 4.5: Estratégia de deploy**
  - [ ] Task 4.5.1: Decidir e documentar se o deploy a partir de `main` é automático pós-merge ou manual (`workflow_dispatch`) (critério de aceite: decisão registrada no README/ADR e refletida na implementação da Task 4.2.3)
  Dependências: informa a Task 4.2.3.

---

### Bloqueios (a levar de volta ao agente clarificador)

Nenhum. O único bloqueio identificado nesta rodada — restauração de estoque em cancelamento feito por Admin fora do estado `pendente` — foi resolvido pelo clarificador: **RN07a** define que o estoque só é restaurado automaticamente se o pedido estava `pendente` no momento do cancelamento; cancelamento pelo Admin em `confirmado`/`enviado` não restaura estoque (ajuste manual, fora do escopo da Fase 1). As Tasks 2.6.5 e 3.3.4 já refletem essa regra.

Demais decisões (código de status HTTP para acesso negado em `GET /pedidos/:id`, gatilho manual vs. automático de deploy) são detalhes técnicos de implementação já delegados pela própria spec e foram resolvidos dentro das tasks correspondentes.
