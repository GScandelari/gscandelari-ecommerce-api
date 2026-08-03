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
  - [x] Task 2.7.1: Especificação OpenAPI 3.0 (paths, schemas, security schemes) para Produtos e Pedidos (critério de aceite: arquivo `openapi.yaml`/`.json` válido em linter de OpenAPI, cobrindo todos os endpoints dos Épicos 2.5 e 2.6) — `functions/src/openapi.json`, validado com `npm run openapi:validate` (`@redocly/cli`): 0 erros.
  - [x] Task 2.7.2: Expor Swagger UI (`swagger-ui-express`) em `/docs` no ambiente de dev/emulator (critério de aceite: `GET /docs` no emulator renderiza UI navegável com todos os endpoints documentados) — montado em `app.ts` sem autenticação (são só docs); coberto por teste de sanidade.
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
  - [x] Task 4.1.1: Criar repositório remoto no GitHub `gscandelari-ecommerce-api`, branch `main` protegida (critério de aceite: repo criado, `main` é branch default e protegida exigindo PR) — repo criado e público (https://github.com/GScandelari/gscandelari-ecommerce-api); branch protection configurada via API (PR obrigatório, check de CI obrigatório, sem force-push/deleção).
  - [x] Task 4.1.2: Documentar convenção Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`...) (critério de aceite: `CONTRIBUTING.md` ou seção no README descreve a convenção; opcionalmente `commitlint` configurado)
  - [x] Task 4.1.3: Documentar e configurar fluxo GitHub Flow (feature branches curtas, PR obrigatório para `main`) (critério de aceite: documento descreve o fluxo; branch protection exige PR + checks antes de merge)
  Dependências: nenhuma — pode iniciar em paralelo ao Módulo 1.

- **Épico 4.2: CI/CD (GitHub Actions)**
  - [x] Task 4.2.1: Workflow de CI — instalar dependências e rodar lint em cada PR (critério de aceite: PR com erro de lint falha o check; PR limpo passa)
  - [x] Task 4.2.2: Workflow de CI — rodar testes (Jest+Supertest) contra o Firebase Emulator Suite dentro do runner (critério de aceite: workflow sobe/usa `firebase emulators:exec`, roda a suíte completa, falha o PR se algum teste falhar)
  - [x] Task 4.2.3: Workflow de CD — deploy para Firebase Functions a partir de `main` (critério de aceite: `firebase deploy --only functions` executa usando credenciais via GitHub Secret, disparado apenas quando branch = `main`, conforme estratégia definida na Task 4.5.1) — validado de ponta a ponta via `workflow_dispatch` (run 30818902631): lint, build, testes contra o emulador e deploy real via Service Account, todos verdes. Papel adicional necessário na Service Account além dos listados na Task 4.4.3: **Service Usage Admin** (sem ele, o deploy falha ao tentar habilitar `cloudbilling.googleapis.com`).
  Dependências: 4.2.1/4.2.2 requerem scripts de lint/test do Módulo 1/3 existentes; 4.2.3 depende de 4.2.1, 4.2.2 verdes e da Task 4.4.3.

- **Épico 4.3: Documentação (README)**
  - [x] Task 4.3.1: Seção "Como rodar localmente" (instalação, emuladores) (critério de aceite: seguindo os passos do zero, um dev sobe os emuladores e acessa `/health`)
  - [x] Task 4.3.2: Seção "Variáveis de ambiente / secrets necessários" (critério de aceite: README lista cada variável/secret com descrição e exemplo, sem valores reais)
  - [x] Task 4.3.3: Seção "Como rodar os testes" (critério de aceite: seguindo os passos, `npm run test:emulator` roda com sucesso)
  - [x] Task 4.3.4: Seção "Como fazer deploy" (critério de aceite: passos descritos reproduzem o deploy manual via Firebase CLI) — validado na prática: deploy real feito seguindo exatamente esses passos.
  Dependências: melhor qualidade se feito após Módulos 1-3 definidos, mas pode ser escrito incrementalmente desde o início.

- **Épico 4.4: Gestão de segredos**
  - [x] Task 4.4.1: Levantar lista de segredos necessários da aplicação na Fase 1 (critério de aceite: lista documentada; como a Fase 1 não integra gateway de pagamento real, documentar explicitamente quais segredos de app existem ou registrar "N/A nesta fase" além das credenciais de deploy) — N/A nesta fase (nenhum segredo de aplicação); único segredo é o de deploy (`FIREBASE_SERVICE_ACCOUNT_KEY`), documentado no README.
  - [x] Task 4.4.2: Configurar Firebase Secret Manager para os segredos de aplicação identificados, via `firebase functions:secrets:set` (critério de aceite: segredo(s) configurado(s) e referenciado(s) no código, nenhum valor commitado no repositório) — condicional ao resultado da Task 4.4.1 — N/A (nenhum segredo de aplicação na Fase 1, ver 4.4.1).
  - [x] Task 4.4.3: Configurar credenciais de deploy (service account) como GitHub Secret para uso no workflow de CD (critério de aceite: GitHub Actions autentica no Firebase via secret configurado, sem expor credenciais em log) — Service Account `github-actions-deploy@gscandelari-ecommerce-api.iam.gserviceaccount.com` criada, chave configurada como secret `FIREBASE_SERVICE_ACCOUNT_KEY` via `gh secret set` (conteúdo nunca exibido). Papéis concedidos, todos descobertos por tentativa/erro real contra deploys reais (Fase 1 e Fase 2), não uma lista teórica: Cloud Functions Admin, Cloud Run Admin, Artifact Registry Administrator, Cloud Build Editor, Service Account User, Firebase Admin, Service Usage Admin (habilita `cloudbilling.googleapis.com` sozinho), Secret Manager Secret Accessor (ler os secrets do Stripe) e Secret Manager Admin (conceder acesso aos secrets para a service account de runtime das Functions — sem ele, o deploy falha em `secrets:setIamPolicy`).
  Dependências: Task 4.4.1 primeiro; 4.4.3 é pré-requisito da Task 4.2.3.

- **Épico 4.5: Estratégia de deploy**
  - [x] Task 4.5.1: Decidir e documentar se o deploy a partir de `main` é automático pós-merge ou manual (`workflow_dispatch`) (critério de aceite: decisão registrada no README/ADR e refletida na implementação da Task 4.2.3)
  Dependências: informa a Task 4.2.3.

---

### Bloqueios (a levar de volta ao agente clarificador)

Nenhum. O único bloqueio identificado nesta rodada — restauração de estoque em cancelamento feito por Admin fora do estado `pendente` — foi resolvido pelo clarificador: **RN07a** define que o estoque só é restaurado automaticamente se o pedido estava `pendente` no momento do cancelamento; cancelamento pelo Admin em `confirmado`/`enviado` não restaura estoque (ajuste manual, fora do escopo da Fase 1). As Tasks 2.6.5 e 3.3.4 já refletem essa regra.

Demais decisões (código de status HTTP para acesso negado em `GET /pedidos/:id`, gatilho manual vs. automático de deploy) são detalhes técnicos de implementação já delegados pela própria spec e foram resolvidos dentro das tasks correspondentes.

---

## Backlog: gscandelari-ecommerce-api — Fase 2 (Integração de Pagamento — Stripe)

> Gerado a partir de SPEC.md, seção "Fase 2". Fragmenta os Módulos 5-7 (seção 3 da Fase 2) em épicos e tasks técnicas pequenas, testáveis de forma independente. Nenhuma regra de negócio (RN10-RN15) foi reaberta ou reinterpretada além do necessário para viabilizar a implementação; decisões puramente técnicas (nomes de campos, sequenciamento de chamadas, códigos HTTP de erro de integração) foram tomadas nesta rodada e estão documentadas em cada task. A Fase 1 (Módulos 1-4, 49/49 testes, já em produção) não foi alterada em escopo — apenas estendida onde a Fase 2 exige (modelo `Pedido`, `app.ts`, `pedidosService.ts`).

### Decisões técnicas registradas nesta rodada (não são bloqueios, não requerem o clarificador)

1. **Onde a PaymentIntent entra na transação de criação do pedido:** a chamada ao Stripe é uma chamada de rede externa e **nunca** pode acontecer dentro de `db.runTransaction(...)` (a transação existente em `pedidosService.criarPedido`, que decrementa estoque) porque transações do Firestore podem ser reexecutadas em caso de conflito de concorrência, o que criaria PaymentIntents duplicadas a cada retry. Sequência decidida:
   1. A transação Firestore **já existente** (Task 2.6.2 da Fase 1) roda **sem alteração de comportamento**, apenas inicializando os novos campos de pagamento como "ainda não processado" (`paymentStatus: 'aguardando_pagamento'`, `paymentIntentId: null`, `paymentClientSecret: null`). O pedido é persistido e o estoque decrementado, exatamente como hoje.
   2. **Fora** da transação, depois do commit, o serviço chama `stripe.paymentIntents.create(...)` com `amount = Math.round(pedido.total * 100)` (Stripe trabalha em centavos), `currency: 'brl'` e `metadata.pedidoId = pedido.id`.
   3. Em caso de sucesso, um `update` simples (não-transacional; nada mais escreve nesses dois campos nesse momento) grava `paymentIntentId`/`paymentClientSecret`/`paymentStatus: 'aguardando_pagamento'→` mantém, no documento já existente.
   4. Em caso de falha do Stripe (rede, chave inválida, etc.), executa-se uma **ação compensatória**: o pedido já criado é cancelado (reaproveitando a mesma lógica de restauração de estoque de RN06/RN07a) e marcado `paymentStatus: 'falhou'`, e a rota responde **502** ao cliente. Decisão: o pedido **não é apagado** (mantém trilha de auditoria, consistente com o fato de que nada no sistema hoje deleta pedidos), fica com `status: 'cancelado'`. Isso evita pedidos "pendentes" órfãos sem PaymentIntent associada.
2. **Nomes de campo decididos** em `Pedido`: `paymentIntentId: string | null`, `paymentClientSecret: string | null`, `paymentStatus: 'aguardando_pagamento' | 'pago' | 'falhou'`. `paymentStatus` é deliberadamente um campo separado de `status` (que continua sendo a máquina de estados do pedido/RN05) para não sobrecarregar a máquina de estados existente com semântica de pagamento.
3. **Raw body do webhook:** `app.use(express.json())` está registrado globalmente em `app.ts` antes de qualquer rota. `stripe.webhooks.constructEvent()` exige o corpo **cru** (Buffer), não o objeto já parseado pelo `express.json()`. Decisão: a rota `POST /webhooks/stripe` é registrada com `express.raw({ type: 'application/json' })` **antes** do `app.use(express.json())` global (Express aplica o parser de corpo apenas uma vez por request — a primeira rota/middleware que já tiver lido/consumido o body "vence"). Ver Task 6.1.1 para o detalhe de implementação e teste de regressão garantindo que `/produtos` e `/pedidos` continuam recebendo JSON normalmente.
4. **Reuso de lógica de domínio pelo webhook, sem checagem de papel:** o webhook não tem `req.user` (rota pública, RN11) — as novas funções de serviço chamadas por ele (`confirmarPagamentoPedido`, `cancelarPedidoPorFalhaPagamento`) não fazem checagem de admin/dono, pois a autorização do webhook é a própria verificação de assinatura Stripe (RN11), não Firebase Auth. Essas funções são internas, não expostas via rota HTTP.
5. **Eventos de tipo não mapeado** (nem `payment_intent.succeeded` nem `payment_intent.payment_failed`): aceitos com 200 e ignorados (sem efeito de domínio), para não gerar reentrega infinita por parte do Stripe. Registrados em `stripeEvents` por completude.

### Ordem sugerida de execução (visão macro)

1. **Módulo 5 / Épicos 5.1 e 5.2** (cliente Stripe + extensão do modelo) — podem rodar em paralelo entre si; pré-requisito de tudo o resto.
2. **Módulo 6 / Épico 6.1** (rota pública + raw body) — pode começar em paralelo ao Módulo 5, depende só da infra existente (`app.ts`).
3. **Módulo 5 / Épico 5.3** (criação da PaymentIntent no fluxo de criação de pedido) — depende de 5.1, 5.2 e do `pedidosService.criarPedido` já existente (Fase 1).
4. **Módulo 6 / Épicos 6.2 → 6.3 → 6.4** (assinatura → idempotência → processamento dos eventos), nessa ordem interna — 6.4 depende também de 5.2 (campos de pagamento) e reaproveita lógica de cancelamento/estoque da Fase 1.
5. **Módulo 7** (Testes) — pode ser feito incrementalmente em paralelo a cada épico dos Módulos 5/6 (TDD), mas o fechamento de cobertura e a checagem de regressão (Épico 7.5) só acontecem depois de 5.3 e 6.4 completos.

---

### Módulo 5: Integração Stripe

- **Épico 5.1: Setup do cliente Stripe**
  - [x] Task 5.1.1: Adicionar dependência do SDK oficial `stripe` a `functions/package.json` e criar `functions/src/stripeClient.ts` exportando `getStripeClient()` (singleton, mesmo padrão de `firebaseAdmin.ts`), configurado com a chave secreta lida de variável de ambiente/Secret Manager (`STRIPE_SECRET_KEY`) (critério de aceite: `getStripeClient()` retorna uma instância de `Stripe`; chamar a função sem a env var definida lança erro claro e imediato, testável isoladamente)
  - [x] Task 5.1.2: Documentar `STRIPE_SECRET_KEY` (valor dummy/placeholder, nunca uma chave real) em `.env.example`, para uso no emulator; nos testes Jest o SDK real nunca é chamado (mockado no Módulo 7) (critério de aceite: `.env.example` lista a variável com comentário explicando que deve ser uma chave `sk_test_...`; app sobe no emulator sem falhar mesmo com valor dummy)
  - [x] Task 5.1.3: Adicionar classe `PaymentGatewayError` (HTTP 502) a `errors/index.ts`, integrada ao middleware de erro existente — usada quando o Stripe falha após o pedido já ter sido criado (critério de aceite: lançar `PaymentGatewayError` em qualquer handler retorna 502 com o payload padronizado `{ error: { code, message } }`, mesmo padrão das demais classes de erro)
  Dependências: nenhuma (Módulo 1 já fornece a estrutura de pastas/erros).

- **Épico 5.2: Modelo de dados — extensão de Pedido**
  - [x] Task 5.2.1: Estender `Pedido`/`PedidoInput` (`functions/src/models/pedido.ts`) com `paymentIntentId: string | null`, `paymentClientSecret: string | null`, `paymentStatus: 'aguardando_pagamento' | 'pago' | 'falhou'` — base estrutural de **RN10** (critério de aceite: tipos compilam sem erro; `criarPedido` inicializa os três campos dentro da mesma transação Firestore já existente, antes de qualquer chamada ao Stripe, sem alterar o comportamento de decremento de estoque já testado na Fase 1)
  Dependências: nenhuma (extensão pura de tipo, pode rodar em paralelo à 5.1).

- **Épico 5.3: Criação da PaymentIntent na criação do pedido — implementa RN10**
  - [x] Task 5.3.1: Criar `functions/src/services/stripeService.ts` com `criarPaymentIntent(pedido: Pedido): Promise<{ paymentIntentId: string; clientSecret: string }>`, chamando `stripe.paymentIntents.create({ amount: Math.round(pedido.total * 100), currency: 'brl', metadata: { pedidoId: pedido.id } })` — implementa parte de **RN10** (critério de aceite: função isolada, testável com o cliente Stripe mockado, sem qualquer outra responsabilidade além de traduzir `Pedido` → chamada Stripe)
  - [x] Task 5.3.2: Criar a função de compensação `cancelarPedidoPorFalhaCriacaoPagamento(pedidoId)` em `pedidosService.ts`, reaproveitando a mesma rotina `restaurarEstoque` já usada por `cancelarPedidoCliente`/`alterarStatusAdmin`, transicionando o pedido para `status: 'cancelado'` e `paymentStatus: 'falhou'` (critério de aceite: chamada isolada e testável; ao ser executada, o estoque dos itens do pedido é restaurado e o status vira `cancelado`, validável por leitura direta no Firestore Emulator)
  - [x] Task 5.3.3: Orquestrar em `pedidosService.ts` um novo `criarPedidoComPagamento(clienteId, itens)` que: (a) chama a transação Firestore já existente (Task 2.6.2, inalterada) para criar o pedido com os campos de pagamento "vazios"; (b) fora da transação, chama `stripeService.criarPaymentIntent`; (c) em sucesso, faz `update` (não-transacional) do pedido com `paymentIntentId`/`paymentClientSecret`; (d) em falha, chama a compensação da Task 5.3.2 e relança como `PaymentGatewayError` — implementa a decisão arquitetural documentada acima, base de **RN10** (critério de aceite: nenhuma chamada de rede ao Stripe ocorre dentro de `db.runTransaction`, verificável por inspeção de código/teste; em caso de falha simulada do Stripe, o pedido termina `cancelado` com estoque restaurado, nunca "pendente" sem PaymentIntent associada)
  - [x] Task 5.3.4: Atualizar `POST /pedidos` (`pedidos.routes.ts`) para chamar `criarPedidoComPagamento` em vez de `criarPedido`, incluindo `paymentIntentId` e `paymentClientSecret` no corpo da resposta 201 — implementa **RN10** (critério de aceite: resposta 201 contém `paymentIntentId` e `paymentClientSecret` não nulos em caso de sucesso; em caso de falha do Stripe mockada, resposta é 502 com payload padronizado de erro)
  Dependências: Épicos 5.1, 5.2; Módulo 2 da Fase 1 (`pedidosService.criarPedido`, inalterado internamente).

#### Rastreabilidade RN10 → Tasks (Módulo 5)

| Regra | Descrição resumida | Tasks que implementam |
|---|---|---|
| RN10 | PaymentIntent criada automaticamente na criação do pedido; `paymentIntentId`/`clientSecret` persistidos e retornados | 5.2.1, 5.3.1, 5.3.2, 5.3.3, 5.3.4 |

---

### Módulo 6: Webhook & idempotência

- **Épico 6.1: Infra de rota pública com raw body**
  - [x] Task 6.1.1 **(sinalizada explicitamente — impacto direto do `express.json()` global)**: Reordenar os middlewares em `app.ts` de modo que `POST /webhooks/stripe` seja registrado com `express.raw({ type: 'application/json' })` **antes** de `app.use(express.json())` (o parser de body só pode ser consumido uma vez por request) — pré-requisito estrutural de **RN11** (critério de aceite: teste de integração confirma que `req.body` chega como `Buffer` dentro do handler do webhook; testes de regressão confirmam que `POST /produtos` e `POST /pedidos` continuam recebendo `req.body` como objeto JSON parseado normalmente, sem quebrar nenhum teste da Fase 1)
  - [x] Task 6.1.2: Criar `functions/src/routes/webhooks.routes.ts` com `POST /webhooks/stripe`, montado em `app.ts` **sem** o middleware `authenticate` (rota pública, por definição de RN11) — implementa parte estrutural de **RN11** (critério de aceite: rota responde sem exigir header `Authorization`; qualquer outro path sob `/webhooks` segue o 404 padrão do app)
  Dependências: nenhuma nova; ambas podem começar em paralelo ao Módulo 5, mas 6.1.1 deve ser resolvida antes de qualquer outra task do Módulo 6 (o handler depende do body cru).

- **Épico 6.2: Validação de assinatura e parsing do evento — implementa RN11**
  - [x] Task 6.2.1: Documentar `STRIPE_WEBHOOK_SECRET` em `.env.example` e implementar, dentro do handler de `POST /webhooks/stripe`, a chamada `stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], secret)`, capturando exceção de assinatura inválida — implementa **RN11** (critério de aceite: header `stripe-signature` ausente ou assinatura inválida → 400, nenhuma escrita em qualquer coleção do Firestore; assinatura válida → evento Stripe tipado disponível para o restante do handler)
  Dependências: Épico 6.1.

- **Épico 6.3: Idempotência — implementa RN14**
  - [x] Task 6.3.1: Criar `functions/src/repositories/stripeEventsRepository.ts` para a coleção `stripeEvents` (`{ eventId, type, processedAt }`), com `jaProcessado(eventId): Promise<boolean>` e `registrarEventoProcessado(eventId, type): Promise<void>` — implementa **RN14** (critério de aceite: `jaProcessado` retorna `false` para evento novo e `true` após `registrarEventoProcessado` ser chamado para o mesmo `eventId`, validado contra o Firestore Emulator)
  - [x] Task 6.3.2: No handler do webhook, checar `jaProcessado(event.id)` logo após a validação de assinatura e antes de qualquer efeito colateral de domínio; se já processado, responder 200 imediatamente sem reprocessar; caso contrário, processar o evento (Épico 6.4) e só então chamar `registrarEventoProcessado` — implementa **RN14** (critério de aceite: reenvio do mesmo `event.id` para `payment_intent.succeeded`/`payment_intent.payment_failed` não dispara segunda transição de status nem segunda restauração de estoque, validado por leitura direta no Firestore)
  Dependências: Épico 6.2.

- **Épico 6.4: Processamento dos eventos de pagamento — implementa RN12, RN13, RN15**
  - [x] Task 6.4.1: Adicionar a `pedidosService.ts` as funções internas `confirmarPagamentoPedido(pedidoId)` e `cancelarPedidoPorFalhaPagamento(pedidoId)`, sem checagem de autorização de cliente/admin (a autorização do chamador é a assinatura Stripe validada em 6.2, não Firebase Auth) — cada função é **idempotente por construção**: se o pedido não existir ou não estiver `pendente`, retorna um resultado "noop" (sem lançar erro, sem alterar o Firestore) — base de **RN12**, **RN13**, **RN15** (critério de aceite: chamar a função para pedido inexistente, ou para pedido já `confirmado`/`cancelado`/`entregue`, resulta em noop identificável pelo chamador, sem exceção e sem escrita no Firestore; chamar para pedido `pendente` produz o efeito esperado — `confirmarPagamentoPedido` transiciona para `confirmado` e seta `paymentStatus: 'pago'`; `cancelarPedidoPorFalhaPagamento` reaproveita `restaurarEstoque`, transiciona para `cancelado` e seta `paymentStatus: 'falhou'`)
  - [x] Task 6.4.2: Handler do webhook chama `confirmarPagamentoPedido(event.data.object.metadata.pedidoId)` para o tipo `payment_intent.succeeded` — implementa **RN12** (critério de aceite: pedido `pendente` + evento `succeeded` → status vira `confirmado`; resposta 200)
  - [x] Task 6.4.3: Handler do webhook chama `cancelarPedidoPorFalhaPagamento(event.data.object.metadata.pedidoId)` para os tipos `payment_intent.payment_failed` e `payment_intent.canceled` (mapeados como equivalentes de falha/expiração, conforme RN13) — implementa **RN13** (critério de aceite: pedido `pendente` + evento de falha → status vira `cancelado`, estoque restaurado; resposta 200)
  - [x] Task 6.4.4: Confirmar (via teste, não via código adicional — o comportamento já vem da Task 6.4.1) que evento com `metadata.pedidoId` inexistente ou pedido já fora de `pendente` responde 200 sem nenhuma escrita em `pedidos`, apenas logging — implementa **RN15** (critério de aceite: os dois cenários — pedido inexistente e pedido não-pendente — cobertos por teste de integração, ambos 200, ambos sem alteração no documento do pedido quando ele existe)
  - [x] Task 6.4.5: Tratar tipos de evento fora do mapeamento de RN12/RN13 (ex. `charge.refunded`, `payment_intent.created`) — decisão técnica: aceitar com 200, sem efeito de domínio, registrando em `stripeEvents` (Task 6.3.1) para não reprocessar (critério de aceite: evento de tipo desconhecido retorna 200, nenhuma escrita em `pedidos`, um doc é criado em `stripeEvents`)
  Dependências: Épicos 6.2, 6.3; Épico 5.2 (campos de pagamento no modelo `Pedido`).

#### Rastreabilidade RN11-RN15 → Tasks (Módulo 6)

| Regra | Descrição resumida | Tasks que implementam |
|---|---|---|
| RN11 | Webhook público, assinatura validada antes de qualquer processamento | 6.1.1, 6.1.2, 6.2.1 |
| RN12 | `payment_intent.succeeded` em pedido `pendente` → `confirmado` | 6.4.1, 6.4.2 |
| RN13 | `payment_intent.payment_failed`/equivalente em pedido `pendente` → cancela e restaura estoque | 6.4.1, 6.4.3 |
| RN14 | Reentrega do mesmo `event.id` é ignorada (idempotência) | 6.3.1, 6.3.2 |
| RN15 | `pedidoId` inexistente ou pedido não mais `pendente` → 200 sem efeito colateral | 6.4.1, 6.4.4 |

---

### Módulo 7: Testes

- **Épico 7.1: Setup de mocks do Stripe**
  - [x] Task 7.1.1: Configurar `jest.mock` sobre `functions/src/stripeClient.ts` com uma factory reutilizável (`test/helpers/mockStripe.ts`) capaz de simular `paymentIntents.create` e `webhooks.constructEvent` (sucesso e erro configuráveis por teste), sem nenhuma chamada de rede real e sem dependência de internet no CI (critério de aceite: helper permite configurar retorno/erro por teste; suíte roda offline)
  Dependências: Módulo 5 (Épico 5.1), Módulo 3 da Fase 1 (infraestrutura Jest já existente).

- **Épico 7.2: Testes de criação de pedido com pagamento — cobre RN10**
  - [x] Task 7.2.1: Teste `POST /pedidos` com sucesso: `paymentIntents.create` mockada retorna id + client secret → resposta 201 inclui `paymentIntentId`/`paymentClientSecret`; Firestore reflete os campos persistidos (critério de aceite: assert direto no Firestore Emulator e no corpo da resposta)
  - [x] Task 7.2.2: Teste `POST /pedidos` com `paymentIntents.create` mockada rejeitando: resposta 502; pedido no Firestore fica `cancelado`/`paymentStatus: 'falhou'`, estoque restaurado ao valor original (critério de aceite: leitura direta no Firestore confirma estoque igual ao valor anterior à tentativa de criação, e nenhuma PaymentIntent "fantasma" é referenciada no documento)
  Dependências: Épico 7.1, Módulo 5 (Épico 5.3).

- **Épico 7.3: Testes do webhook — cobre RN11, RN12, RN13, RN15**
  - [x] Task 7.3.1: Teste de assinatura inválida (`webhooks.constructEvent` mockada lançando erro) → 400, nenhuma escrita em `pedidos` nem `stripeEvents` — cobre **RN11**
  - [x] Task 7.3.2: Teste `payment_intent.succeeded` para pedido `pendente` existente → pedido vira `confirmado`, `paymentStatus: 'pago'`, resposta 200 — cobre **RN12**
  - [x] Task 7.3.3: Teste `payment_intent.payment_failed` para pedido `pendente` existente → pedido vira `cancelado`, estoque restaurado, resposta 200 — cobre **RN13**
  - [x] Task 7.3.4: Teste de evento com `metadata.pedidoId` inexistente → 200, nenhuma escrita em `pedidos` — cobre **RN15**
  - [x] Task 7.3.5: Teste de evento `payment_intent.succeeded` para pedido já em `confirmado` (fora de `pendente`) → 200, nenhuma alteração adicional — cobre **RN15**
  Dependências: Épico 7.1, Módulo 6 completo (Épicos 6.1-6.4).

- **Épico 7.4: Testes de idempotência — cobre RN14**
  - [x] Task 7.4.1: Teste de reenvio do mesmo `event.id` (`payment_intent.succeeded` duplicado) → segunda entrega não altera novamente o status, retorna 200 — cobre **RN14**
  - [x] Task 7.4.2: Teste de reenvio do mesmo `event.id` (`payment_intent.payment_failed` duplicado) → estoque não é restaurado duas vezes, retorna 200 — cobre **RN14**
  Dependências: Épico 7.1, Módulo 6 (Épico 6.3).

- **Épico 7.5: Regressão e cobertura final**
  - [x] Task 7.5.1: Rodar a suíte completa (Fase 1 + Fase 2) contra o Emulator Suite e confirmar zero regressões nos 49 testes já existentes da Fase 1, além dos novos testes verdes (critério de aceite: `npm run test:emulator` verde, nenhum teste pré-existente quebrado)
  - [x] Task 7.5.2: Confirmar que a cobertura ≥70% (threshold já configurado na Task 3.5.1 da Fase 1) se mantém com o novo código do Módulo 5/6 incluído (critério de aceite: `npm run test:coverage` reporta ≥70% em todas as métricas e não falha o threshold configurado)
  - [x] Task 7.5.3: Produzir, em conjunto com o agente qa-negocio, a tabela final de rastreabilidade RN10-RN15 → testes automatizados (critério de aceite: tabela produzida sem nenhuma RN10-RN15 órfã de teste, consolidando as tabelas por módulo acima)
  Dependências: Épicos 7.2, 7.3, 7.4 completos.

#### Rastreabilidade RN10-RN15 → Tasks (consolidada, Módulo 7)

| Regra | Tasks de teste que cobrem |
|---|---|
| RN10 | 7.2.1, 7.2.2 |
| RN11 | 7.3.1 |
| RN12 | 7.3.2 |
| RN13 | 7.3.3 |
| RN14 | 7.4.1, 7.4.2 |
| RN15 | 7.3.4, 7.3.5 |

---

### Fora de escopo desta rodada (delegado diretamente ao devops-tech-writer a partir da spec)

Os Requisitos de DevOps & Doc da Fase 2 (seção 4 da spec: novos segredos `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` via Secret Manager, documentação de cartões de teste do Stripe no README, passo manual de configurar a URL do webhook no Dashboard do Stripe) — **concluído** pelo agente devops-tech-writer: README.md (seções "Estado atual do projeto" e "Integração de pagamento (Stripe) — Fase 2") e `.env.example` atualizados.

### Bloqueios (a levar de volta ao agente clarificador)

Nenhum bloqueio de negócio identificado nesta rodada. Todas as lacunas encontradas durante o planejamento eram de natureza técnica (sequenciamento da chamada Stripe em relação à transação Firestore; formato do corpo cru no Express; nomes de campos no modelo `Pedido`; código HTTP de erro de gateway de pagamento) e foram resolvidas e documentadas na seção "Decisões técnicas registradas nesta rodada" acima, sem necessidade de reabrir RN10-RN15.

### Implementado (Módulos 5-7 concluídos)

**63/63 testes passando** (49 da Fase 1 + 14 da Fase 2), zero regressão, cobertura 94.9% statements / 73.4% branches / 95.2% funções / 96.4% linhas (meta ≥70%). Lint, format e build limpos.

Um desvio deliberado do desenho original, sem impacto observável (nenhum teste depende do nome das funções internas): a Task 5.3.2 previa uma função `cancelarPedidoPorFalhaCriacaoPagamento` separada de `cancelarPedidoPorFalhaPagamento` (Task 6.4.1). Na implementação, uma única função `cancelarPedidoPorFalhaPagamento` é reaproveitada nos dois pontos (compensação da criação e webhook de falha) — ambas fazem exatamente a mesma coisa (restaurar estoque, `status: 'cancelado'`, `paymentStatus: 'falhou'`, noop se o pedido não estiver mais `pendente`), então duas funções idênticas seriam duplicação sem benefício.

Também foi corrigido durante a implementação (não estava no desenho original): o handler do webhook checava `STRIPE_WEBHOOK_SECRET` no ambiente antes de chamar `stripe.webhooks.constructEvent`, o que quebrava todos os testes do Módulo 7 mesmo com o SDK mockado (a env var não existe no ambiente de teste). Corrigido para deixar o próprio `constructEvent` (real ou mockado) ser a fonte de verdade — a validação do secret já é responsabilidade do SDK, não precisa ser duplicada na rota.

### Deployado em produção

Segredos `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` (modo teste) configurados no Firebase Secret Manager real via `firebase functions:secrets:set --data-file`. Webhook cadastrado no Dashboard do Stripe (modo teste) apontando para `https://us-central1-gscandelari-ecommerce-api.cloudfunctions.net/api/webhooks/stripe`, eventos `payment_intent.succeeded`/`payment_intent.payment_failed`/`payment_intent.canceled`.

Deploy via `workflow_dispatch` validado de ponta a ponta (run verde após 3 rodadas de ajuste de papéis IAM na Service Account — ver Task 4.4.3): confirmado com `curl` real que `/health` responde 200 e `/webhooks/stripe` rejeita corretamente requisição sem assinatura (400).
