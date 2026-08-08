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

---

## Backlog: gscandelari-ecommerce-api — Fase 3 (Microsserviços)

> Gerado a partir de SPEC.md, seção "Fase 3". Fragmenta os Módulos 8-12 (seção 3 da Fase 3) em épicos e tasks técnicas pequenas, testáveis de forma independente. Nenhuma regra de negócio (RN16-RN20) foi reaberta ou reinterpretada além do necessário para viabilizar a implementação. **Esta é a fase de maior risco até agora**: as Fases 1+2 estão deployadas em produção real (projeto `gscandelari-ecommerce-api`, 63/63 testes verdes), servindo tráfego real (inclusive o webhook do Stripe, configurado no Dashboard real do Stripe modo teste). Toda a decomposição abaixo foi desenhada para que o corte de produção seja a **última** ação, não a primeira, e para que o monólito atual (`functions/`, codebase `default`, function `api`) continue servindo tráfego ininterruptamente até o novo caminho estar validado ponta a ponta.

### Decisões técnicas registradas nesta rodada (não são bloqueios, não requerem o clarificador)

1. **Estratégia de migração sem downtime.** Toda a reestruturação é feita em uma branch isolada (`feat/fase-3-microservicos`), nunca diretamente em `main`, e validada 100% localmente (Emulator Suite multi-codebase + Hosting Emulator, suíte de testes por serviço) antes de qualquer deploy real. O corte de produção não é "big bang silencioso": é uma sequência controlada onde o monólito atual permanece intocado e servindo tráfego durante toda a transição, porque o comando de deploy dos novos codebases (`firebase deploy --only functions:orders,functions:payments,functions:notifications,hosting`) usa `--only` e portanto **nunca toca** no codebase `default` (function `api`) — Firebase só adiciona/atualiza os targets explicitamente listados. Sequência exata recomendada:
   1. Branch dedicada; `firebase.json` passa a declarar os 3 novos codebases **além** de manter o codebase `default` existente (não remover ainda) — isso evita que um deploy incompleto ou um `firebase deploy` sem `--only` explícito derrube a function `api` por omissão.
   2. Restruturação completa do código dentro da branch (Módulos 8-11 abaixo), validada localmente com `firebase emulators:start` subindo os 3 novos codebases + Firestore + Auth + Hosting simultaneamente, exercitando manualmente o fluxo crítico ponta a ponta (criar pedido → PaymentIntent via chamada interna → webhook simulado → transição de status via chamada interna → e-mail via trigger) inteiramente no emulador, sem qualquer chamada a projeto/rede real além dos SDKs mockados nos testes automatizados.
   3. Suíte de testes das 3 novas services rodando verde (Módulo 12), sem nenhuma regressão nas RN01-RN15 já cobertas nas Fases 1/2 (redistribuídas entre Orders e Payments).
   4. PR revisado e mergeado em `main` **só neste ponto** — o merge em si não deploya nada (estratégia de deploy manual via `workflow_dispatch`, herdada das Fases 1/2, Task 4.5.1).
   5. Deploy real dos 3 novos codebases + hosting, com `--only` explícito, function `api` do codebase `default` permanece rodando e servindo o domínio antigo sem interrupção durante e depois deste deploy (Task 8.6.1).
   6. Smoke test em produção real do fluxo crítico ponta a ponta pelo **novo** caminho, incluindo a migração manual da URL do webhook no Dashboard do Stripe (modo teste) para a nova URL pública de Payments — este é o único ponto de "corte" que depende de um passo manual externo ao Firebase, e é feito solitariamente e verificado antes de prosseguir (Task 8.6.2).
   7. Só depois do smoke test real validado, o codebase `default`/function `api` é removido de `firebase.json` e explicitamente deletado (`firebase functions:delete api`) — decomissionamento deliberado do monólito, nunca automático (Task 8.6.3).
   Risco residual identificado e considerado aceitável: como este projeto é um portfólio de demonstração sem frontend real, o único cliente externo de fato dependente da URL antiga é a configuração do webhook no Dashboard do Stripe — todo o resto do "tráfego real" é testável/observável via `curl`/Postman, o que reduz drasticamente a superfície de risco de um cutover clássico de API pública com muitos consumidores.

2. **Autenticação serviço-a-serviço via ID token do Google — mecanismo exato em Cloud Functions 2ª geração (Cloud Run por baixo).** Cada Cloud Function 2ª geração roda como um serviço Cloud Run com uma *service account* de runtime associada. Decisão de implementação:
   - **Emissão do token (lado chamador):** usar a biblioteca `google-auth-library` (`GoogleAuth().getIdTokenClient(audience)` → `fetchIdToken(audience)`), com `audience` = URL HTTPS do serviço de destino. Rodando dentro do GCP (Cloud Functions/Cloud Run), essa biblioteca resolve automaticamente via metadata server (`http://metadata.google.internal/.../identity?audience=...`), usando a identidade da service account de runtime da própria function — **sem gerenciar nenhuma chave**.
   - **Service accounts dedicadas:** em vez de usar a service account default do App Engine (compartilhada, permissões amplas), são provisionadas 2 SAs dedicadas (`orders-runtime@...`, `payments-runtime@...`), cada Cloud Function configurada para rodar com a sua via a opção `serviceAccount` do `onRequest` (Functions 2ª geração suporta essa opção, repassada ao Cloud Run subjacente).
   - **Validação (lado receptor) — RN18:** o serviço receptor usa `OAuth2Client.verifyIdToken` (mesma `google-auth-library`) para validar assinatura/emissor do token contra os certs públicos do Google, confere `aud` = URL do próprio serviço, e confere `email` do payload contra uma allow-list configurável via env var (o e-mail da SA do chamador esperado). Token ausente, assinatura inválida, `aud` errado ou `email` fora da allow-list → 401.
   - **Sobre a permissão IAM "Cloud Run Invoker":** decisão explícita de **não** usá-la como mecanismo de isolamento entre serviços nesta arquitetura, porque tanto Orders quanto Payments hospedam, no mesmo Cloud Run service, tanto rotas internas quanto rotas públicas (Orders serve `/produtos`/`/pedidos` ao público; Payments serve `/webhooks/stripe` ao público/Stripe) — o invoker é necessariamente `allUsers` nos dois, e essa permissão não consegue restringir por rota dentro do mesmo app Express. A fronteira de segurança real e single source of truth é a validação de token em nível de aplicação (RN18), não o IAM. Isso é registrado explicitamente para não ser confundido com uma lacuna de segurança — é uma escolha de design compatível com a estrutura de codebases definida pela spec (um único Express app por serviço, misturando rotas públicas e internas).
   - **Desenvolvimento local:** o metadata server não existe no Emulator Suite; por isso, uma flag de conveniência `SKIP_INTERNAL_AUTH` (default `false`, documentada como uso exclusivo de emulator, nunca deployada como `true`) permite testar localmente sem token real — o comportamento padrão (flag desligada) ainda exige o middleware real, para exercitá-lo nos testes automatizados com o SDK mockado.

3. **Fronteira exata da extração do código Stripe.** O código do Stripe é movido integralmente para Payments, mas a escrita no documento `Pedido` continua exclusiva de Orders — nunca há duplicação da fonte de verdade do pedido:
   - **Vai para Payments (código próprio, não compartilhado):** `stripeClient.ts`, `stripeService.ts` (adaptado — ver abaixo), `webhooks.routes.ts`, `stripeEventsRepository.ts`/coleção `stripeEvents` (idempotência de RN14 passa a ser 100% um concern interno de Payments, checado **antes** de qualquer chamada HTTP a Orders — reduz inclusive o número de chamadas internas em reentregas de webhook).
   - **Fica em Orders, inalterado internamente:** `confirmarPagamentoPedido`, `cancelarPedidoPorFalhaPagamento`, `restaurarEstoque`, `pedidosRepository.ts`, `pedidos.statusMachine.ts`, o modelo `Pedido` completo (com `paymentIntentId`/`paymentClientSecret`/`paymentStatus`) — Orders continua a única escrita em `pedidos`, exatamente como a spec exige ("Payments nunca escreve diretamente no Firestore na coleção pedidos"). Essas funções, que hoje são chamadas por import direto do handler do webhook (mesmo processo), passam a ser expostas como 2 endpoints HTTP internos (`POST /internal/pedidos/:id/confirmar-pagamento`, `POST /internal/pedidos/:id/cancelar-por-falha-pagamento`) chamados por Payments.
   - **Contrato simplificado na fronteira:** hoje `stripeService.criarPaymentIntent(pedido: Pedido)` recebe o objeto `Pedido` inteiro. Como Payments não deveria precisar conhecer o tipo `Pedido` completo (ele não lê nem escreve a coleção `pedidos`), o contrato do novo endpoint interno `POST /internal/payment-intents` é deliberadamente reduzido a `{ pedidoId: string, total: number }` → `{ paymentIntentId, clientSecret }`. Isso elimina qualquer necessidade de duplicar o tipo `Pedido` em Payments — uma simplificação real habilitada pela extração, não só uma tradução 1:1 do código antigo.
   - **`PaymentGatewayError`:** existe em **ambos** os codebases, com o mesmo papel em cada um mas por motivos diferentes — em Payments, é lançada quando a chamada real ao Stripe falha; em Orders, é lançada quando a chamada HTTP interna a Payments falha (rede, 401, 5xx) — mantendo o mesmo contrato observável (502) que o cliente final já via na Fase 2.

4. **Duplicação vs. compartilhamento de código entre os 3 codebases.** Decisão: duplicar deliberadamente os utilitários pequenos (`firebaseAdmin.ts`, `errors/index.ts`, `asyncHandler.ts`, `middlewares/errorHandler.ts`, e o novo par `mintInternalToken`/`verifyInternalToken`) em cada codebase que precisa deles, em vez de criar um pacote npm compartilhado (workspace). Motivo: cada arquivo tem poucas dezenas de linhas, muda raramente, e um pacote compartilhado exigiria uma ferramenta de build de monorepo (Turborepo/Nx) ou linking `file:`, adicionando complexidade de CI e — pior — reintroduzindo exatamente o tipo de acoplamento que a Fase 3 existe para eliminar (uma mudança não relacionada em Notifications forçando rebuild/versionamento sentido por Orders). Nuances por arquivo:
   - `firebaseAdmin.ts`: duplicado nos 3 (Notifications também precisa, para `admin.auth().getUser` e o próprio SDK do trigger).
   - `errors/index.ts`: duplicado em Orders e Payments (ambos têm rotas Express com o mesmo middleware de erro padronizado); Notifications não precisa (sem rotas HTTP, tratamento de erro é local/best-effort, RN19).
   - `authenticate`/`requireAdmin` (Firebase Auth de cliente final): só existem em Orders — Payments não tem rotas autenticadas por cliente final (webhook é público, validado por assinatura Stripe; rota interna é validada por ID token Google); Notifications não tem rotas HTTP.
   - `mintInternalToken`/`verifyInternalToken`: duplicado em Orders e Payments (os únicos 2 serviços que se chamam mutuamente); Notifications não precisa (comunicação assíncrona via trigger, sem chamada HTTP síncrona).
   Esta decisão é revisitada apenas se a superfície duplicada crescer muito além disso (ex.: > 8-10 arquivos) ou divergir de forma perigosa entre os serviços — não é o caso nesta fase.

5. **Resolução do e-mail do cliente em Notifications, sem duplicar dado no modelo `Pedido`.** O documento `Pedido` não tem (e não precisa ganhar) um campo de e-mail — Notifications resolve o e-mail do cliente dono via `admin.auth().getUser(pedido.clienteId).email` (Admin SDK, funciona a partir de qualquer codebase, independente de quem escreveu o dado), evitando desnormalizar/duplicar o e-mail no pedido só para uso de um serviço. Adicionalmente, o trigger `onDocumentUpdated` só dispara o envio quando `before.status !== after.status` **e** `after.status` é `confirmado`/`cancelado` — decisão técnica para não reenviar e-mail em updates não relacionados ao status (ex.: a gravação de `paymentIntentId`/`paymentClientSecret` que ocorre logo após a criação do pedido, com `status` ainda `pendente`).

6. **Semântica quando a chamada interna Payments → Orders falha (ex. Orders temporariamente indisponível).** Não é criado nenhum mecanismo de retry customizado: se a chamada de Payments para o endpoint interno de Orders falhar (rede, 5xx, 401 por token expirado), a exceção propaga e o handler do webhook responde ao Stripe com 5xx **sem** chamar `registrarEventoProcessado` — isso reaproveita o mecanismo de reentrega que o próprio Stripe já provê (o design de idempotência de RN14, herdado da Fase 2, já assume reentregas como caso normal). Nenhum código novo é necessário além de deixar a chamada interna propagar sua falha como uma exceção não capturada antes do registro de idempotência, mesma ordem já implementada na Task 6.3.2 da Fase 2 (processa o efeito de domínio, só depois registra o evento como processado).

### Ordem sugerida de execução (visão macro)

1. **Módulo 8 / Épicos 8.1 → 8.5** (branch, estrutura multi-codebase, migração de código de Orders e Payments, scaffolding de Notifications, validação local) — pré-requisito de tudo; 8.2 e 8.3 podem rodar em paralelo entre si; 8.4 é independente.
2. **Módulo 9** (comunicação síncrona Orders↔Payments) — depende de 8.2 e 8.3 completos; ordem interna 9.1 (autenticação) → 9.2 e 9.3 (podem rodar em paralelo entre si, ambas dependem de 9.1).
3. **Módulo 10** (Notifications) — pode rodar em paralelo ao Módulo 9; depende só de 8.4 e da coleção `pedidos` já existente/gerenciada por Orders.
4. **Módulo 11** (API Gateway) — depende de 8.5 (nomes de export definidos) e dos Módulos 9 e 10 completos (os 3 serviços já respondem corretamente antes de serem expostos atrás do gateway).
5. **Módulo 12** (Testes) — incremental em paralelo a cada épico dos Módulos 9-11 (TDD por serviço), fechamento de cobertura/rastreabilidade final só depois de tudo completo.
6. **Módulo 8 / Épico 8.6** (corte de produção e decomissionamento do `default`) — **sempre por último**, só depois de Módulos 9-12 validados localmente/no emulador; é a única parte desta fase que toca o ambiente de produção real.

---

### Módulo 8: Reestruturação multi-codebase

- **Épico 8.1: Preparação, branch e estrutura multi-codebase**
  - [x] Task 8.1.1: Criar branch `feat/fase-3-microservicos` a partir de `main`; nenhuma alteração é enviada a `main` até a validação completa local (emulador multi-codebase, Módulo 12) estar verde — reflete a Decisão técnica 1 (critério de aceite: branch criada; PR só é aberto ao final do Módulo 12, nunca antes)
  - [x] Task 8.1.2: Criar `services/orders/`, `services/payments/`, `services/notifications/`, cada uma com `package.json`, `tsconfig.json`, `tsconfig.build.json` e configuração de lint/format próprios, espelhando os scripts já usados em `functions/` (build/lint/test/test:coverage/test:emulator) (critério de aceite: `npm install` roda com sucesso, de forma independente, dentro de cada uma das 3 pastas)
  - [x] Task 8.1.3: Atualizar `firebase.json` para array `codebases` com `orders` (source `services/orders`), `payments` (source `services/payments`), `notifications` (source `services/notifications`) — **mantendo** o codebase `default` (source `functions`) declarado, sem remover, conforme Decisão técnica 1 (critério de aceite: `firebase.json` válido; `firebase emulators:start` sobe os 4 codebases — 3 novos + `default` — sem erro de configuração)
  Dependências: nenhuma (ponto de partida da Fase 3).

- **Épico 8.2: Migração do código Orders (Fase 1 + fronteira de pedidos)**
  - [x] Task 8.2.1: Copiar para `services/orders/src/` o código de Produtos e a base de Pedidos: `models/`, `repositories/produtosRepository.ts` e `pedidosRepository.ts`, `schemas/`, `routes/produtos.routes.ts` e `pedidos.routes.ts`, `middlewares/authenticate.ts`/`requireAdmin.ts`/`validate.ts`/`errorHandler.ts`, `firebaseAdmin.ts`, `errors/index.ts`, `utils/asyncHandler.ts`, `services/pedidos.statusMachine.ts`, `services/pedidosService.ts` (critério de aceite: `npm run build` dentro de `services/orders` compila sem erro e sem nenhuma referência a `stripeClient`/`stripeService`)
  - [x] Task 8.2.2: Em `pedidosService.ts` (cópia em Orders), remover o import direto de `criarPaymentIntent` e trocar a chamada dentro de `criarPedidoComPagamento` por uma chamada ao cliente HTTP interno de Payments (implementado na Task 9.2.2) — mantém exatamente a mesma sequência já documentada na Fase 2 (transação Firestore → chamada externa → update não-transacional → compensação em falha), só troca "chamada de função local" por "chamada HTTP autenticada" — implementa a fronteira da Decisão técnica 3 (critério de aceite: `criarPedidoComPagamento` não importa mais nada de um módulo Stripe; compila e é testável com a chamada HTTP interna mockada)
  - [x] Task 8.2.3: Manter `confirmarPagamentoPedido`/`cancelarPedidoPorFalhaPagamento`/`restaurarEstoque` inalterados internamente; expô-los via 2 novos handlers de rota interna (implementados na Task 9.3.1) em vez de serem chamados por import direto do webhook, que agora vive em outro codebase (critério de aceite: comportamento idêntico ao da Fase 2 nos testes unitários de `pedidosService` já existentes, sem alteração de asserts, apenas de forma de invocação)
  - [x] Task 8.2.4: Recriar `app.ts`/`index.ts` de Orders montando `/health`, `/docs`, `/produtos`, `/pedidos` e os novos `/internal/pedidos/...` (sem `/webhooks`) (critério de aceite: `GET /webhooks/stripe` em Orders retorna 404; `/produtos`, `/pedidos`, `/docs` idênticos ao comportamento pré-migração)
  Dependências: Épico 8.1.

- **Épico 8.3: Migração do código Payments (Fase 2 — Stripe)**
  - [x] Task 8.3.1: Copiar para `services/payments/src/` `stripeClient.ts`, `stripeService.ts`, `routes/webhooks.routes.ts`, `repositories/stripeEventsRepository.ts`, mais cópias próprias de `firebaseAdmin.ts`, `errors/index.ts` (incluindo `PaymentGatewayError`), `utils/asyncHandler.ts`, `middlewares/errorHandler.ts` — reflete a Decisão técnica 4 (critério de aceite: `npm run build` dentro de `services/payments` compila sem depender de nenhum arquivo fora da própria pasta)
  - [x] Task 8.3.2: Adaptar `stripeService.criarPaymentIntent` para a assinatura `criarPaymentIntent(pedidoId: string, total: number)`, eliminando a dependência do tipo `Pedido` em Payments — implementa a simplificação de contrato da Decisão técnica 3 (critério de aceite: nenhuma referência a um tipo `Pedido`/`@/models/pedido` resta em `services/payments`)
  - [x] Task 8.3.3: Recriar `app.ts`/`index.ts` de Payments montando `/health` e `/webhooks/stripe` (mais `/internal/payment-intents`, implementado na Task 9.2.1) — sem `/produtos`/`/pedidos`/`/docs` (critério de aceite: `GET /produtos` em Payments retorna 404)
  Dependências: Épico 8.1; em paralelo ao Épico 8.2.

- **Épico 8.4: Scaffolding do serviço Notifications (novo)**
  - [x] Task 8.4.1: Inicializar `services/notifications/` com `package.json`/`tsconfig` próprios e dependências mínimas (`firebase-admin`, `firebase-functions`, `resend`), sem Express — Notifications não expõe nenhuma rota HTTP pública (RN20) (critério de aceite: `npm run build` compila um `index.ts` placeholder válido, sem dependência de Express)
  Dependências: Épico 8.1.

- **Épico 8.5: Regressão de infraestrutura de deploy**
  - [x] Task 8.5.1: Validar localmente com `firebase emulators:start` que os 4 codebases (3 novos + `default`, ainda preservado) sobem simultaneamente sem conflito de porta/nome de função (critério de aceite: Emulator UI lista as functions ativas dos 4 codebases sem erro)
  - [x] Task 8.5.2: Confirmar e documentar a convenção de nomes de export por codebase (Firebase prefixa automaticamente pelo nome do codebase, ex. `export const api` dentro de `services/orders` resulta em `orders-api` no deploy) — nomes finais usados nos rewrites do Módulo 11 (critério de aceite: inspeção do plano de deploy/documentação confirma os nomes exatos esperados: `orders-api`, `payments-api`, `notifications-onPedidoStatusChange`, sem colisão com `api` do codebase `default`)
  Dependências: Épicos 8.2, 8.3, 8.4.

- **Épico 8.6: Corte de produção e decomissionamento do `default`** *(sempre por último — ver Decisão técnica 1)*
  - [ ] Task 8.6.1: Deploy real dos 3 novos codebases + hosting via `firebase deploy --only functions:orders,functions:payments,functions:notifications,hosting`, sem tocar no codebase `default` (critério de aceite: deploy conclui com sucesso; `curl` no domínio antigo `.../api/health` continua 200 durante e depois deste deploy; `curl` no novo domínio do Hosting em `/produtos` também responde 200, autenticação exigida)
  - [ ] Task 8.6.2: Smoke test em produção real do fluxo crítico ponta a ponta pelo **novo** caminho: criar pedido via novo domínio (Orders) → confirmar chamada interna real a Payments (PaymentIntent criada em modo teste do Stripe) → atualizar a URL do webhook no Dashboard do Stripe (modo teste) para a nova URL pública de Payments → disparar evento de teste real ou via `stripe trigger` → confirmar que Orders efetiva a transição de status via chamada interna de Payments → confirmar e-mail (Resend, modo teste/sandbox) disparado por Notifications (critério de aceite: os 5 passos validados manualmente com evidência — status HTTP e logs reais — antes de prosseguir para a Task 8.6.3)
  - [ ] Task 8.6.3: Somente após a Task 8.6.2 validada, remover o codebase `default` de `firebase.json` e excluir a function `api` (`firebase functions:delete api`) — decomissionamento deliberado do monólito, nunca automático (critério de aceite: `firebase functions:list` não lista mais `api`; domínio antigo `.../api/health` passa a responder 404, confirmando a remoção)
  Dependências: Épicos 8.1-8.5 completos; Módulos 9, 10 e 11 completos e validados localmente; execução real em produção coordenada com o agente devops-tech-writer (credenciais de deploy, Task 4.4.3 já existente).

---

### Módulo 9: Extração do serviço Payments + comunicação síncrona

> Implementa RN16-RN18. Tabela de rastreabilidade ao final desta seção.

- **Épico 9.1: Autenticação serviço-a-serviço via ID token Google — implementa RN18**
  - [x] Task 9.1.1: Criar utilitário `internalAuth.ts` (duplicado em Orders e Payments — Decisão técnica 4) com `mintInternalToken(audience: string): Promise<string>` usando `google-auth-library` (`GoogleAuth().getIdTokenClient(audience)`/`fetchIdToken`) — base de **RN16**/**RN17** (critério de aceite: função testável com `google-auth-library` mockada, retorna string de token; a chamada real e não-mockada só é exercitada manualmente em emulador/produção com credenciais, nunca no CI)
  - [x] Task 9.1.2: Criar middleware `verifyInternalToken` (duplicado em Orders e Payments) que extrai `Authorization: Bearer <token>`, valida via `OAuth2Client.verifyIdToken`, confere `aud` = URL do próprio serviço e `email` do payload contra allow-list configurável (env var `ALLOWED_CALLER_SERVICE_ACCOUNT_EMAIL`) — implementa **RN18** (critério de aceite: token ausente → 401; assinatura inválida ou `aud` incorreto → 401; `email` fora da allow-list → 401; token válido e esperado → segue adiante)
  - [ ] Task 9.1.3: Provisionar `orders-runtime@PROJECT.iam.gserviceaccount.com` e `payments-runtime@PROJECT.iam.gserviceaccount.com` via `gcloud iam service-accounts create`, e configurar cada Cloud Function 2ª geração para rodar com sua SA dedicada via a opção `serviceAccount` do export HTTPS (critério de aceite: `gcloud run services describe` confirma a service account dedicada configurada para cada function, distinta da SA default do App Engine) — **pendente**: ação real de provisionamento no GCP (`gcloud` não disponível neste ambiente), fica para o corte de produção (Épico 8.6), junto com o passo guiado de IAM já usado nas Fases 1/2. O código já está pronto para receber a opção `serviceAccount` no `onRequest` assim que as SAs existirem.
  - [ ] Task 9.1.4: Conceder às 2 novas SAs apenas as permissões mínimas necessárias (`roles/datastore.user` para ambas; `roles/secretmanager.secretAccessor` só para `payments-runtime`, que lê `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`) — sem conceder `roles/run.invoker` cruzado como mecanismo de segurança, conforme justificado na Decisão técnica 2 (critério de aceite: `gcloud projects get-iam-policy` confirma exatamente os papéis listados, nenhum papel administrativo herdado) — **pendente**, mesma razão da Task 9.1.3.
  - [x] Task 9.1.5: Documentar `SKIP_INTERNAL_AUTH` em `.env.example` de Orders e Payments (default `false`, uso exclusivo de emulator local, nunca deployado como `true`) — conveniência de dev descrita na Decisão técnica 2 (critério de aceite: com a flag ligada no emulator, chamada interna sem token passa; com a flag desligada — padrão — o middleware real é exercitado mesmo no emulator)
  Dependências: Épico 8.1.

- **Épico 9.2: Orders → Payments (criação de PaymentIntent) — implementa RN16**
  - [x] Task 9.2.1: Criar em Payments o endpoint interno `POST /internal/payment-intents`, protegido por `verifyInternalToken`, recebendo `{ pedidoId, total }`, chamando `stripeService.criarPaymentIntent` (assinatura simplificada da Task 8.3.2) e retornando `{ paymentIntentId, clientSecret }` (critério de aceite: sem token válido → 401; token válido + Stripe mockado com sucesso → 200 com os 2 campos; Stripe mockado com erro → 502 via `PaymentGatewayError` local de Payments)
  - [x] Task 9.2.2: Em Orders, criar `payments.internalClient.ts` que monta `Authorization` via `mintInternalToken(PAYMENTS_BASE_URL)` e faz `POST {PAYMENTS_BASE_URL}/internal/payment-intents`, com `PAYMENTS_BASE_URL` configurada via env/Secret (URL real do codebase `payments` gerada no deploy) (critério de aceite: cliente testável com chamada HTTP mockada; erro de rede ou resposta não-2xx é traduzido em `PaymentGatewayError` do lado de Orders)
  - [x] Task 9.2.3: Atualizar `criarPedidoComPagamento` (Orders) para usar o cliente da Task 9.2.2 no lugar do import direto de `stripeService` (Task 8.2.2), preservando a mesma sequência transacional e a mesma compensação já validada na Fase 2 — implementa **RN16** (critério de aceite: contrato de `POST /pedidos` para o cliente final não muda — mesmo 201 com `paymentIntentId`/`paymentClientSecret`, mesmo 502 em falha — validado por teste de regressão herdado da Fase 2)
  Dependências: Épico 9.1; Épicos 8.2/8.3.

- **Épico 9.3: Payments → Orders (efetivação de status via webhook) — implementa RN17**
  - [x] Task 9.3.1: Criar em Orders `POST /internal/pedidos/:id/confirmar-pagamento` e `POST /internal/pedidos/:id/cancelar-por-falha-pagamento`, protegidos por `verifyInternalToken`, delegando para `confirmarPagamentoPedido`/`cancelarPedidoPorFalhaPagamento` (Task 8.2.3) — implementa **RN17** (critério de aceite: sem token válido → 401; pedido `pendente` → 200 e transição efetivada, idêntico ao comportamento direto da Fase 2; pedido inexistente ou fora de `pendente` → 200 noop, RN15 preservada)
  - [x] Task 9.3.2: Em Payments, criar `orders.internalClient.ts` (mesmo padrão da Task 9.2.2, espelhado) usado pelo handler do webhook para chamar os 2 endpoints da Task 9.3.1 no lugar do import direto de `pedidosService` — implementa **RN17** (critério de aceite: handler do webhook chama o endpoint correto por tipo de evento, mesmo mapeamento de RN12/RN13; a checagem de idempotência — RN14, `stripeEvents` — continua ocorrendo em Payments **antes** de qualquer chamada HTTP a Orders)
  - [x] Task 9.3.3: Confirmar (inspeção de código + teste) que Payments nunca escreve diretamente na coleção `pedidos` do Firestore, conforme exigência explícita da spec (critério de aceite: nenhuma referência a `pedidosCollection`/`.collection("pedidos")` em `services/payments/`; suíte de testes de Payments não instancia nenhum repositório de pedidos)
  - [x] Task 9.3.4: Confirmar (teste + inspeção) a semântica de falha da Decisão técnica 6: se a chamada interna a Orders falhar, a exceção propaga e o webhook responde 5xx ao Stripe **sem** chamar `registrarEventoProcessado`, permitindo reentrega natural do Stripe (critério de aceite: com o cliente interno de Orders mockado para rejeitar, a resposta do webhook é 5xx e nenhum documento é criado em `stripeEvents`)
  Dependências: Épico 9.1; Épicos 8.2/8.3; Task 9.3.2 depende da Task 9.3.1 já existir.

#### Rastreabilidade RN16-RN18 → Tasks (Módulo 9)

| Regra | Descrição resumida | Tasks que implementam |
|---|---|---|
| RN16 | Orders chama Payments via HTTP síncrono interno para criar PaymentIntent; contrato externo de `POST /pedidos` inalterado | 9.1.1, 9.2.1, 9.2.2, 9.2.3 |
| RN17 | Payments chama endpoint interno de Orders para efetivar transição de status via webhook; Payments nunca escreve em `pedidos` | 9.1.1, 9.3.1, 9.3.2, 9.3.3 |
| RN18 | Toda chamada interna exige ID token Google válido, verificado pelo receptor; sem token/token inválido → 401 | 9.1.1, 9.1.2, 9.1.3, 9.1.4, 9.1.5 |

---

### Módulo 10: Serviço Notifications (novo)

> Implementa RN19.

- **Épico 10.1: Cliente Resend**
  - [x] Task 10.1.1: Adicionar dependência `resend` a `services/notifications/package.json`, criar `resendClient.ts` com `getResendClient()` singleton (mesmo padrão de `firebaseAdmin.ts`/`stripeClient.ts`), lendo `RESEND_API_KEY` de env/Secret Manager (critério de aceite: `getResendClient()` retorna instância; ausência da env var lança erro claro e imediato, testável isoladamente)
  - [x] Task 10.1.2: Documentar `RESEND_API_KEY` em `.env.example` de Notifications (valor dummy, modo sandbox do Resend) (critério de aceite: `.env.example` lista a variável com comentário explicando o modo sandbox/teste)
  Dependências: Épico 8.4.

- **Épico 10.2: Firestore Trigger e envio de e-mail — implementa RN19**
  - [x] Task 10.2.1: Criar `onPedidoStatusChange` (`onDocumentUpdated("pedidos/{pedidoId}", ...)`, Cloud Functions 2ª geração) comparando `event.data.before.status` com `event.data.after.status`; dispara a lógica de e-mail **somente** quando o status muda e o novo valor é `confirmado` ou `cancelado` — reflete a Decisão técnica 5 (critério de aceite: update do documento que não altera `status` não dispara envio, testável no emulator; update para `confirmado`/`cancelado` dispara; update para `enviado`/`entregue`/`pendente` não dispara)
  - [x] Task 10.2.2: Resolver o e-mail do cliente dono via `admin.auth().getUser(pedido.clienteId).email` — reflete a Decisão técnica 5 (critério de aceite: para `clienteId` válido no Auth Emulator, o e-mail resolvido bate com o cadastrado; para `clienteId` sem usuário correspondente, tratado como falha best-effort, sem lançar exceção não tratada)
  - [x] Task 10.2.3: Montar e enviar o e-mail via `resend.emails.send(...)` com template mínimo (assunto/corpo variam conforme `confirmado`/`cancelado`, incluindo `pedidoId` e `total`) — implementa **RN19** (critério de aceite: com Resend mockado, a chamada de envio recebe destinatário/assunto/corpo corretos para cada um dos 2 status)
  - [x] Task 10.2.4: Tratamento best-effort de falha: qualquer exceção do SDK do Resend (ou de `getUser`) é capturada e logada, a function encerra com sucesso — nunca reverte ou bloqueia a transição de status já efetivada por Orders (que já ocorreu antes do trigger disparar) — implementa explicitamente a cláusula best-effort de **RN19** (critério de aceite: com o SDK do Resend mockado para lançar erro, `onPedidoStatusChange` completa sem erro não tratado no emulator, e um log de erro é produzido)
  Dependências: Épico 10.1; Épico 8.2 (coleção `pedidos` já gerenciada por Orders).

#### Rastreabilidade RN19 → Tasks (Módulo 10)

| Regra | Descrição resumida | Tasks que implementam |
|---|---|---|
| RN19 | Notifications envia e-mail em transição para `confirmado`/`cancelado`; falha é best-effort, nunca bloqueia a transição | 10.2.1, 10.2.2, 10.2.3, 10.2.4 |

---

### Módulo 11: API Gateway (Firebase Hosting)

> Implementa RN20.

- **Épico 11.1: Configuração de rewrites**
  - [x] Task 11.1.1: Adicionar bloco `hosting` a `firebase.json` com `rewrites`: `/produtos/**` e `/pedidos/**` → function `orders-api`, `/webhooks/stripe` → function `payments-api` — implementa **RN20** (critério de aceite: `firebase.json` válido; a regra mais específica (`/webhooks/stripe`) precede regras genéricas, testável no Hosting Emulator)
  - [x] Task 11.1.2: Confirmar que Notifications não é referenciada em nenhum rewrite e não expõe nenhum `onRequest`/`onCall` — só o trigger Firestore da Task 10.2.1 — implementa a cláusula final de **RN20** (critério de aceite: inspeção de `services/notifications/src/index.ts` confirma zero exports HTTP; nenhuma entrada de Notifications em `hosting.rewrites`)
  - [x] Task 11.1.3: Validar end-to-end no Hosting Emulator; decisão técnica complementar: `/health` de cada serviço permanece acessível apenas via URL direta da function (sem rewrite dedicado no gateway), já que a spec só exige `/produtos`, `/pedidos` e `/webhooks/stripe` roteados publicamente (critério de aceite: `curl` contra o domínio do Hosting Emulator para `/produtos` e `/webhooks/stripe` chega no serviço correto; paths não mapeados retornam o 404 padrão do Hosting)
  Dependências: Épico 8.5 (nomes de export definidos); Módulos 9 e 10 completos (serviços já corretos antes de expostos atrás do gateway).

#### Rastreabilidade RN20 → Tasks (Módulo 11)

| Regra | Descrição resumida | Tasks que implementam |
|---|---|---|
| RN20 | Gateway roteia `/produtos`/`/pedidos` → Orders, `/webhooks/stripe` → Payments; Notifications sem rota pública | 11.1.1, 11.1.2, 11.1.3 |

---

### Módulo 12: Testes e regressão

> Cobre RN16-RN20 e confirma zero regressão em RN01-RN15. Tabela de rastreabilidade consolidada ao final.

- **Épico 12.1: Redistribuição da suíte existente (63 testes) — confirma zero regressão em RN01-RN15**
  - [x] Task 12.1.1: Mover os testes de Produtos/Pedidos (Fase 1, RN01-RN09) para `services/orders/test/`, ajustando imports para os paths do novo codebase, sem alterar nenhum assert (critério de aceite: suíte roda com `npm test` dentro de `services/orders`, mesma contagem de testes/asserts da Fase 1)
  - [x] Task 12.1.2: Mover os testes de Stripe/webhook (Fase 2, RN10-RN15): a parte que exercita `stripeService`/webhook diretamente vai para `services/payments/test/`; a parte que exercita `criarPedidoComPagamento`/`confirmarPagamentoPedido`/`cancelarPedidoPorFalhaPagamento` vai para `services/orders/test/`, agora mockando a chamada HTTP interna em vez do import direto (critério de aceite: os 14 testes da Fase 2, ou seus equivalentes 1:1, continuam verdes, redistribuídos conforme a fronteira do Módulo 9, sem perda de cenário)
  - [x] Task 12.1.3: Rodar as 3 suítes (Orders/Payments/Notifications) e confirmar zero regressão: soma total de testes ≥63 (herdados de Fases 1+2) mais os novos dos Módulos 9-11 (critério de aceite: `npm test` verde em cada uma das 3 pastas)
  Dependências: Módulos 8 e 9 completos.

- **Épico 12.2: Testes de comunicação síncrona — cobre RN16-RN18**
  - [x] Task 12.2.1: Teste de `POST /pedidos` (Orders) com cliente interno de Payments mockado com sucesso → 201 com `paymentIntentId`/`paymentClientSecret` — cobre **RN16**
  - [x] Task 12.2.2: Teste de `POST /pedidos` com cliente interno de Payments mockado falhando (rede ou 401) → 502 para o cliente final, pedido compensado (cancelado, estoque restaurado) — cobre **RN16**, **RN18**
  - [x] Task 12.2.3: Teste unitário de `verifyInternalToken` (suíte duplicada em Orders e Payments): sem token → 401; assinatura inválida (mockada) → 401; `aud` errado → 401; `email` fora da allow-list → 401; token válido → segue adiante — cobre **RN18**
  - [x] Task 12.2.4: Teste de `POST /internal/payment-intents` (Payments) e dos 2 endpoints internos de Orders sem header `Authorization` → 401 em todos — cobre **RN18**
  - [x] Task 12.2.5: Teste de fluxo simulando `payment_intent.succeeded` no webhook de Payments com o cliente interno de Orders mockado → confirma chamada ao endpoint correto de Orders com o `pedidoId` certo — cobre **RN17**
  - [x] Task 12.2.6: Teste de falha na chamada interna Payments→Orders → resposta 5xx ao Stripe, nenhum registro em `stripeEvents` — cobre **RN17**, valida a Decisão técnica 6
  Dependências: Épico 12.1; Módulo 9.

- **Épico 12.3: Testes de Notifications — cobre RN19**
  - [x] Task 12.3.1: Teste de `onPedidoStatusChange` disparando e-mail em transição para `confirmado`, com Resend e `admin.auth().getUser` mockados — cobre **RN19**
  - [x] Task 12.3.2: Teste de `onPedidoStatusChange` disparando e-mail em transição para `cancelado` — cobre **RN19**
  - [x] Task 12.3.3: Teste de `onPedidoStatusChange` **não** disparando e-mail quando `status` não muda (ex.: update que só altera `paymentIntentId`) — cobre **RN19**
  - [x] Task 12.3.4: Teste de falha do Resend mockada (rejeita) → função completa sem erro não tratado, nenhuma exceção propagada — cobre a cláusula best-effort de **RN19**
  Dependências: Módulo 10.

- **Épico 12.4: Testes do API Gateway — cobre RN20**
  - [x] Task 12.4.1: Teste (Hosting Emulator, ou validação estática de `firebase.json`) confirmando que `/produtos`/`/pedidos` roteiam para Orders e `/webhooks/stripe` roteia para Payments — cobre **RN20**
  Dependências: Módulo 11.

- **Épico 12.5: Cobertura e rastreabilidade final**
  - [x] Task 12.5.1: Configurar/copiar o threshold de cobertura ≥70% (herdado da Task 3.5.1) em cada um dos 3 `package.json` (`test:coverage` por codebase) (critério de aceite: os 3 comandos falham se qualquer métrica ficar abaixo de 70%)
  - [x] Task 12.5.2: Produzir, em conjunto com o agente qa-negocio, a tabela final de rastreabilidade RN16-RN20 → testes automatizados, consolidando com as tabelas já existentes de RN01-RN15 (critério de aceite: tabela sem nenhuma RN16-RN20 órfã de teste)
  Dependências: Épicos 12.1-12.4 completos.

#### Rastreabilidade RN16-RN20 → Tasks de teste (consolidada, Módulo 12)

| Regra | Tasks de teste que cobrem |
|---|---|
| RN16 | 12.2.1, 12.2.2 |
| RN17 | 12.2.5, 12.2.6 |
| RN18 | 12.2.3, 12.2.4 |
| RN19 | 12.3.1, 12.3.2, 12.3.3, 12.3.4 |
| RN20 | 12.4.1 |

---

### Fora de escopo desta rodada (delegado diretamente ao devops-tech-writer a partir da spec)

Os Requisitos de DevOps & Doc da Fase 3 (seção 4 da spec): novo segredo `RESEND_API_KEY` via Secret Manager; workflows de CI/CD adaptados para múltiplos codebases (lint/build/test por serviço; deploy por codebase, `firebase deploy --only functions:orders,functions:payments,functions:notifications,hosting`); README com diagrama textual da nova arquitetura (3 serviços + gateway), como rodar todos os serviços localmente no Emulator Suite, e como testar o fluxo de notificação por e-mail manualmente; mesma estratégia de deploy manual (`workflow_dispatch`) já usada nas Fases 1/2. A execução real do corte de produção (Épico 8.6) depende diretamente da Task 4.4.3 já existente (credenciais de deploy) e de credenciais adicionais para as 2 novas service accounts de runtime (Task 9.1.3/9.1.4) — coordenação necessária com o agente devops-tech-writer antes da Task 8.6.1.

### Bloqueios (a levar de volta ao agente clarificador)

Nenhum bloqueio de negócio identificado nesta rodada. Todas as questões levantadas durante o planejamento eram de natureza técnica/arquitetural (mecanismo exato de emissão/validação de ID token Google em Cloud Functions 2ª geração; fronteira de extração do código Stripe e simplificação do contrato entre Orders e Payments; decisão de duplicar vs. compartilhar utilitários pequenos; sequência de corte de produção sem downtime; forma de resolver o e-mail do cliente em Notifications sem duplicar dado no modelo `Pedido`; semântica de retry quando a chamada interna Payments→Orders falha) e foram resolvidas e documentadas na seção "Decisões técnicas registradas nesta rodada" acima, sem necessidade de reabrir RN16-RN20.

---

## Backlog: gscandelari-ecommerce-api — Fase 4 (Front-end de testes)

> Gerado a partir de SPEC.md, seção "Fase 4". Fragmenta os Módulos 13-17 (seção 3 da Fase 4) em épicos e tasks técnicas pequenas, testáveis de forma independente. Nenhuma regra de negócio (RN21-RN27) foi reaberta ou reinterpretada além do necessário para viabilizar a implementação. Todas as tasks abaixo foram implementadas (`web/` existe no filesystem, lint/build/testes verdes localmente e em `ci-web.yml`). O front-end consome exclusivamente a API do monólito Fase 1+2 (`functions/`) rodando no Emulator Suite (`http://localhost:5001/demo-gscandelari-ecommerce-api/us-central1/api`); os serviços da Fase 3 (`services/orders`, `services/payments`, `services/notifications`) não são consumidos nesta fase (ainda sem deploy real, e a spec da Fase 4 aponta explicitamente para o codebase `default`).

### Decisões técnicas registradas nesta rodada (não são bloqueios, não requerem o clarificador)

1. **Estrutura de pastas de `web/src/`.** Organização por responsabilidade (não por feature), para manter os fluxos de Cliente/Admin fáceis de navegar num app pequeno:
   ```
   web/src/
     main.tsx                 # bootstrap (React + AuthProvider + Router)
     App.tsx
     routes/
       AppRouter.tsx           # definição de rotas
       ProtectedRoute.tsx       # exige usuário autenticado
       AdminRoute.tsx           # exige isAdmin === true
     pages/                    # componentes de rota (Login, Signup, Catalog, Checkout, Orders, OrderDetail, AdminProducts, AdminOrders, AdminOrderDetail)
     components/                # UI reutilizável (Navbar, ProductCard, OrderStatusBadge, ConfirmDialog, ErrorBanner, PaymentForm)
     context/                   # AuthContext, CartContext
     api/                       # apiClient.ts (fino) + produtos.ts + pedidos.ts (funções tipadas por endpoint)
     lib/                       # firebase.ts (Auth Emulator), stripe.ts (stripePromise)
     types/                     # Produto, Pedido, ItemPedido, StatusPedido, ApiError — espelham functions/src/openapi.json
     utils/
   ```
   Testes ficam co-localizados (`Componente.test.tsx` ao lado do componente), padrão Vitest/RTL idiomático — evita uma pasta `test/` paralela que se desalinha da estrutura de páginas/componentes conforme o app cresce.

2. **Cliente HTTP fino — tratamento de erro consistente (`src/api/apiClient.ts`).** Um único `request<T>(path, options)`:
   - Injeta `Authorization: Bearer <idToken>` automaticamente via um *token provider* fornecido pelo `AuthContext` (nunca lê `localStorage`/estado global solto — o token vem sempre de `auth.currentUser`).
   - Toda resposta não-2xx é traduzida numa classe única `ApiError extends Error` com `{ status, code, message }`. Se o corpo bater no formato já conhecido do backend (`{ error: { code, message } }` — mesmo padrão usado desde a Fase 1, Task 2.4.1), `code`/`message` vêm dali (as mensagens do backend já são pensadas para usuário final: "Estoque insuficiente", "Transição de status inválida", etc.). Se o corpo não for esse formato (ex. erro genérico do Hosting/emulador, HTML de erro), cai num mapa de mensagens padrão por status HTTP (400/401/403/404/409/502/500).
   - Falha de rede (`fetch` rejeita — emulador não está rodando) é normalizada como `ApiError(status: 0, message: "Não foi possível conectar à API. Verifique se o Firebase Emulator Suite está rodando (firebase emulators:start).")` — mensagem específica do caráter "ferramenta de teste local" desta fase (RN27).
   - Tratamento especial de 401: uma única tentativa de `getIdToken(/* forceRefresh */ true)` + replay da requisição (cobre o caso comum de token expirado em sessão longa); se o replay também falhar com 401, `apiClient` dispara `signOut()` via o token provider e propaga o `ApiError` (token realmente inválido/revogado, não adianta insistir).
   - Nenhum componente de UI chama `fetch` diretamente — todas as chamadas passam por `src/api/produtos.ts`/`src/api/pedidos.ts`, funções tipadas 1:1 com os endpoints documentados em `functions/src/openapi.json`.

3. **`AuthContext` e o claim de admin — `getIdTokenResult()`, não decodificação manual do JWT.** Decisão: usar `user.getIdTokenResult()` do SDK oficial (nunca `jwt-decode` ou parsing manual de base64) — é a API suportada pelo Firebase para ler custom claims, já lida com cache/expiração corretamente. Comportamento:
   - Em cada mudança de `onAuthStateChanged`, o contexto chama `getIdTokenResult()` e deriva `isAdmin = claims.admin === true`.
   - Logo após login/cadastro bem-sucedido, força `getIdTokenResult(/* forceRefresh */ true)` uma vez, para refletir uma claim setada pouco antes via `functions/scripts/setAdminClaim.js`.
   - Expõe `refreshClaims()` publicamente no contexto, para o caso de um admin ser promovido **durante** uma sessão já aberta (o token em cache do SDK só se atualiza sozinho a cada renovação automática, ~1h) — documentado no README (Task 17.4.1) que promover um usuário exige rodar o script e então logar novamente ou chamar essa função.
   - `apiClient` usa `getIdToken()` (sem forçar refresh a cada requisição) para não gerar uma chamada de rede extra por request; o único ponto de refresh forçado por padrão é o pós-login/cadastro e o retry de 401 (decisão 2).

4. **Integração exata com `@stripe/stripe-js`/`@stripe/react-stripe-js`.** Fluxo de PaymentIntent (não Checkout Session, herdado da decisão da Fase 2):
   - `stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)`, um singleton carregado uma única vez em `src/lib/stripe.ts`.
   - `<Elements stripe={stripePromise}>` só é montado **depois** que `POST /pedidos` responde com sucesso e `paymentClientSecret` existe — nunca antes (evita montar o SDK do Stripe prematuramente, e evita ambiguidade de "para qual pedido é esse Elements").
   - Dentro do `Elements`, um único `<CardElement>` (Card Element clássico, não Payment Element — mais simples para o caso de uso de teste/demonstração com um único método de pagamento, cartão) dentro de `PaymentForm`, que usa os hooks `useStripe()`/`useElements()`.
   - Confirmação: `stripe.confirmCardPayment(paymentClientSecret, { payment_method: { card: elements.getElement(CardElement) } })`. Em sucesso (`paymentIntent.status === 'succeeded'`), UI mostra confirmação e link para "Meus Pedidos"; em erro, exibe `result.error.message` (mensagem já amigável, gerada pelo próprio Stripe.js para cartões de teste, ex. cartão recusado `4000 0000 0000 0002`).
   - Nuance documentada explicitamente (não é bloqueio, é comportamento esperado do sistema): a confirmação do pagamento no front-end (Stripe) e a transição do **status do pedido** para `confirmado` (RN12, Fase 2) são coisas distintas — a segunda só ocorre quando o webhook `POST /webhooks/stripe` é efetivamente entregue. Como o Emulator Suite roda em `localhost`, isso só acontece localmente se o Stripe CLI estiver encaminhando eventos (`stripe listen --forward-to .../webhooks/stripe`) — documentado na Task 17.4.2. Sem esse passo, o pagamento aparece confirmado no Stripe mas o pedido permanece `pendente` até um Admin alterar o status manualmente (RN25) — comportamento correto e esperado da ferramenta de teste, não um bug.

5. **Carrinho de compras em memória, não persistido.** `CartContext` guarda os itens do pedido em construção só em estado React (sem `localStorage`/`sessionStorage`) — a spec descreve "montar um pedido e criá-lo" como um fluxo de uma sessão só; persistência entre reloads/abas está fora do escopo de uma ferramenta de teste local e adicionaria complexidade (sincronização com estoque real) sem benefício de demonstração.

6. **Guarda contra conexão a um projeto Firebase real (base de RN27).** `src/lib/firebase.ts` só chama `initializeApp`/`connectAuthEmulator` se `VITE_FIREBASE_PROJECT_ID` começar com `demo-` (convenção do próprio Firebase Emulator Suite para projetos que nunca tocam infraestrutura real); caso contrário, lança erro e interrompe o boot da aplicação — trava em código, não só em documentação/convenção.

### Ordem sugerida de execução (visão macro)

1. **Módulo 13** (Setup) — pré-requisito de tudo. Ordem interna: 13.1 → 13.2 (paralelo) → 13.4 → 13.5.4 → 13.5.1-13.5.3; o Épico 13.3 (roteamento) começa aqui como esqueleto, mas só fecha de fato depois do Módulo 14 existir (`ProtectedRoute`/`AdminRoute` reais).
2. **Módulo 14** (Autenticação) — depende de 13.1 e 13.4; fecha a integração do Épico 13.3.
3. **Módulo 15** (Área do Cliente) e **Módulo 16** (Área do Admin) — podem rodar em paralelo entre si; ambos dependem do Módulo 14 completo e do Épico 13.5. Dentro do Módulo 15, ordem interna 15.1 → 15.2 → 15.3.
4. **Módulo 17** (Testes e documentação) — incremental (TDD) em paralelo a cada épico dos Módulos 14-16 conforme cada um fecha; o fechamento de rastreabilidade final (tabela RN21-RN27) e o README (Épico 17.4) só acontecem depois dos Módulos 14-16 completos.

---

### Módulo 13: Setup do projeto

- **Épico 13.1: Scaffold do projeto**
  - [x] Task 13.1.1: Criar `web/` com `npm create vite@latest web -- --template react-ts` na raiz do monorepo; ajustar `package.json` (nome, scripts `dev`/`build`/`preview`/`lint`/`test`) (critério de aceite: `npm run dev` dentro de `web/` sobe o servidor Vite e a tela padrão renderiza sem erro)
  - [x] Task 13.1.2: Configurar ESLint + Prettier em `web/`, consistentes com as convenções já usadas em `functions/`/`services/` (critério de aceite: `npm run lint` roda sem erro no scaffold inicial; um arquivo propositalmente mal formatado é detectado)
  - [x] Task 13.1.3: Criar a estrutura de pastas de `web/src/` definida na Decisão técnica 1 (`routes/`, `pages/`, `components/`, `context/`, `api/`, `lib/`, `types/`, `utils/`), cada pasta com um `index.ts`/placeholder mínimo (critério de aceite: import relativo entre pastas resolve e compila; `npm run build` não falha por causa da estrutura vazia)
  Dependências: nenhuma (ponto de partida da Fase 4).

- **Épico 13.2: Estilo (Tailwind CSS)**
  - [x] Task 13.2.1: Instalar e configurar Tailwind CSS (`postcss`, `tailwind.config.ts`, diretivas em `index.css`) (critério de aceite: uma classe utilitária Tailwind aplicada a um elemento de teste produz o estilo esperado no navegador/no snapshot de teste)
  Dependências: Épico 13.1.

- **Épico 13.3: Roteamento**
  - [x] Task 13.3.1: Instalar `react-router-dom`; criar `AppRouter` com as rotas públicas (`/login`, `/cadastro`) e placeholders para as demais (`/`, `/pedidos`, `/pedidos/:id`, `/admin/produtos`, `/admin/pedidos`, `/admin/pedidos/:id`) (critério de aceite: navegar entre `/login` e `/cadastro` funciona sem reload de página)
  - [x] Task 13.3.2: Criar `ProtectedRoute` (exige usuário autenticado) e `AdminRoute` (exige `isAdmin`) como componentes de rota, consumindo o `AuthContext` do Módulo 14 — esqueleto pode ser escrito contra uma interface mockada de `AuthContext` antes do Módulo 14 existir de fato — implementa base de **RN26** (critério de aceite: acesso não autenticado a rota protegida redireciona para `/login`; usuário autenticado sem claim admin acessando rota `/admin/*` é redirecionado/bloqueado, nunca chega a renderizar o conteúdo admin)
  Dependências: Épico 13.1; fechamento real de 13.3.2 depende do Épico 14.1.

- **Épico 13.4: Cliente Firebase Auth (Emulator)**
  - [x] Task 13.4.1: Criar `src/lib/firebase.ts` inicializando `initializeApp` + `getAuth` + `connectAuthEmulator(auth, VITE_AUTH_EMULATOR_URL)`, com a trava de `projectId` iniciando em `demo-` descrita na Decisão técnica 6 — implementa base de **RN27** (critério de aceite: em dev, a aplicação conecta ao Auth Emulator, confirmável via log/console; alterar `VITE_FIREBASE_PROJECT_ID` para um valor sem prefixo `demo-` faz a inicialização lançar erro explícito e interromper o boot, não silenciosamente seguir em frente)
  Dependências: Épico 13.1.

- **Épico 13.5: Cliente HTTP fino para a API**
  - [x] Task 13.5.1: Criar `src/api/apiClient.ts` com `request<T>(path, options)`, implementando o tratamento de erro consistente da Decisão técnica 2 (critério de aceite: resposta 2xx retorna o JSON tipado; resposta de erro com corpo `{error:{code,message}}` lança `ApiError` populado a partir do corpo; corpo não reconhecível cai no mapa de mensagens por status HTTP; falha de `fetch`/rede lança `ApiError(status: 0)` com a mensagem orientando checar o Emulator Suite)
  - [x] Task 13.5.2: Integrar o *token provider* do `AuthContext` ao `apiClient` (header `Authorization` automático) e implementar o retry único de 401 com `getIdToken(true)` + replay, incluindo o `signOut()` disparado se o replay também falhar — Decisão técnica 2 e 3 (critério de aceite: requisição sem usuário logado não inclui header `Authorization`; com usuário logado, o header é injetado automaticamente; um 401 simulado no mock dispara exatamente uma tentativa de refresh+replay antes de desistir)
  - [x] Task 13.5.3: Criar `src/api/produtos.ts` e `src/api/pedidos.ts` com uma função tipada por endpoint (`listarProdutos`, `obterProduto`, `criarProduto`, `atualizarProduto`, `removerProduto`, `criarPedido`, `listarPedidos`, `obterPedido`, `alterarStatusPedido`, `cancelarPedido`), encapsulando `apiClient` — nenhum outro módulo chama `fetch` diretamente (critério de aceite: cada função tem assinatura tipada batendo com os schemas de `functions/src/openapi.json`; grep por `fetch(` no restante de `src/` não retorna nenhuma ocorrência fora de `apiClient.ts`)
  - [x] Task 13.5.4: Definir tipos TypeScript em `src/types/` espelhando os schemas do backend (`Produto`, `Pedido`, `ItemPedido`, `StatusPedido = 'pendente'|'confirmado'|'enviado'|'entregue'|'cancelado'`, `PaymentStatus`) a partir de `functions/src/openapi.json` (critério de aceite: tipos batem 1:1 com os schemas documentados; nenhum campo interno do backend não exposto pela API é replicado no front-end)
  Dependências: Épico 13.1; Task 13.5.2 depende do Épico 14.1 para o token provider real (pode ser desenvolvida contra um stub até lá).

---

### Módulo 14: Autenticação

> Implementa RN21 e RN26. Tabelas de rastreabilidade ao final de cada épico correspondente.

- **Épico 14.1: `AuthContext`**
  - [x] Task 14.1.1: Criar `AuthContext`/`AuthProvider` com `onAuthStateChanged`, expondo `{ user, isAdmin, loading, signIn, signUp, signOut, refreshClaims }` (critério de aceite: consumidores do contexto recebem `loading: true` até o Firebase resolver o estado inicial de sessão, depois `loading: false` com `user`/`isAdmin` corretos)
  - [x] Task 14.1.2: Resolver `isAdmin` via `getIdTokenResult()` (Decisão técnica 3), com refresh forçado pós-login/cadastro e a função `refreshClaims()` pública — implementa base de **RN21** (critério de aceite: usuário sem custom claim → `isAdmin=false`; usuário com claim setada via `functions/scripts/setAdminClaim.js` **antes** do login → `isAdmin=true` já no primeiro carregamento; claim setada **depois** do login só reflete após `refreshClaims()` ou novo login, comportamento coberto por teste com o SDK mockado)
  Dependências: Épico 13.4.

- **Épico 14.2: Telas de login/cadastro — implementa RN21**
  - [x] Task 14.2.1: `LoginPage` com formulário (e-mail/senha) chamando `signInWithEmailAndPassword` via `AuthContext.signIn` — implementa **RN21** (critério de aceite: credenciais válidas → redireciona para `/`; credenciais inválidas → mensagem amigável derivada do código de erro do Firebase Auth, ex. `auth/invalid-credential` → "E-mail ou senha inválidos")
  - [x] Task 14.2.2: `SignupPage` com formulário chamando `createUserWithEmailAndPassword` via `AuthContext.signUp`, com login automático após cadastro — implementa **RN21** (critério de aceite: e-mail já cadastrado → mensagem amigável, `auth/email-already-in-use`; cadastro válido → usuário autenticado e redirecionado para `/`)
  - [x] Task 14.2.3: Botão/ação de logout (`AuthContext.signOut`) na navbar (critério de aceite: após logout, rotas antes acessíveis voltam a redirecionar para `/login`)
  Dependências: Épico 14.1.

- **Épico 14.3: Rotas protegidas — implementa RN26**
  - [x] Task 14.3.1: Fechar a integração real de `ProtectedRoute`/`AdminRoute` (Task 13.3.2) com o `AuthContext`, tratando explicitamente o estado `loading` para não haver "flash" de redirecionamento antes do Firebase confirmar a sessão — implementa **RN26** (critério de aceite: recarregar a página numa rota protegida com sessão válida não redireciona incorretamente para `/login` enquanto o estado de auth ainda está resolvendo)
  - [x] Task 14.3.2: Navbar/menu condicional: itens de admin (link para `/admin/*`) só são renderizados quando `isAdmin === true`; nada de admin é montado no DOM para clientes comuns — reforça explicitamente que **RN26** é só UX, a autorização real permanece no backend (critério de aceite: inspeção do DOM renderizado para um usuário não-admin confirma ausência total dos elementos/links de admin, não apenas `display:none`/classe oculta)
  Dependências: Épicos 13.3, 14.1, 14.2.

#### Rastreabilidade RN21, RN26 → Tasks (Módulo 14)

| Regra | Descrição resumida | Tasks que implementam |
|---|---|---|
| RN21 | Cadastro e login de clientes via Firebase Auth contra o Auth Emulator | 13.4.1, 14.1.1, 14.1.2, 14.2.1, 14.2.2, 14.2.3 |
| RN26 | UI de admin escondida para quem não tem o claim; backend é a fonte real de autorização | 13.3.2, 14.3.1, 14.3.2 |

---

### Módulo 15: Área do Cliente

> Implementa RN22-RN24.

- **Épico 15.1: Catálogo de produtos — implementa RN22**
  - [x] Task 15.1.1: `CatalogPage` consumindo `listarProdutos` (`GET /produtos`), exibindo nome/preço/estoque de cada produto — implementa **RN22** (critério de aceite: catálogo renderiza a lista retornada pela API; produto com `estoque: 0` é sinalizado visualmente e não fica selecionável para o carrinho)
  - [x] Task 15.1.2: Estados de carregamento e erro usando o `ApiError` do cliente HTTP (Decisão técnica 2) (critério de aceite: falha simulada na chamada exibe a mensagem de `ApiError`, nunca uma tela em branco ou um erro não tratado no console)
  Dependências: Módulo 14 completo (usuário autenticado); Épico 13.5.

- **Épico 15.2: Montagem, criação de pedido e pagamento — implementa RN23**
  - [x] Task 15.2.1: Instalar `@stripe/stripe-js` e `@stripe/react-stripe-js`; criar `src/lib/stripe.ts` com o `stripePromise` singleton (`loadStripe(VITE_STRIPE_PUBLISHABLE_KEY)`) — Decisão técnica 4 (critério de aceite: dependências instaladas e buildando; ausência/vazio de `VITE_STRIPE_PUBLISHABLE_KEY` falha de forma explícita e logada, não silenciosamente)
  - [x] Task 15.2.2: `CartContext` para montar o pedido (adicionar/remover item, ajustar quantidade, respeitando o estoque exibido no catálogo), carrinho em memória e não persistido — Decisão técnica 5 (critério de aceite: tentar adicionar quantidade além do estoque exibido é bloqueado na UI antes de qualquer chamada à API)
  - [x] Task 15.2.3: `CheckoutPage` com resumo do pedido e botão "Confirmar pedido" chamando `criarPedido` (`POST /pedidos`) — implementa parte de **RN23** (critério de aceite: sucesso → recebe `paymentClientSecret`/`id` e avança para a etapa de pagamento; 400 de estoque insuficiente, ex. condição de corrida com outro comprador → mensagem de erro específica, carrinho não é limpo automaticamente; 502 de falha ao criar o pagamento → mensagem de erro específica)
  - [x] Task 15.2.4: `PaymentForm` — `<Elements stripe={stripePromise}>` montado só após `paymentClientSecret` existir, `<CardElement>` + `useStripe()`/`useElements()`, chamando `stripe.confirmCardPayment(paymentClientSecret, { payment_method: { card: elements.getElement(CardElement) } })` — Decisão técnica 4, implementa **RN23** de ponta a ponta (critério de aceite: com o cartão de teste `4242 4242 4242 4242`, `confirmCardPayment` resolve com `status: 'succeeded'` e a UI exibe confirmação + link para "Meus Pedidos"; cartão de teste de recusa, ex. `4000 0000 0000 0002`, exibe `result.error.message` tal como retornado pelo Stripe.js)
  - [x] Task 15.2.5: Mensagem explícita na tela de confirmação de pagamento informando que o status do pedido só transiciona para `confirmado` quando o webhook local (Stripe CLI, Task 17.4.2) estiver configurado; caso contrário permanece `pendente` até ação manual do Admin — reflete a nuance documentada na Decisão técnica 4 (critério de aceite: mensagem visível na tela de sucesso do pagamento, sem bloquear o fluxo)
  Dependências: Épico 15.1; Épico 13.5 (`criarPedido`).

- **Épico 15.3: Histórico de pedidos e cancelamento — implementa RN24**
  - [x] Task 15.3.1: `OrdersPage` consumindo `listarPedidos` (`GET /pedidos`), exibindo status atual de cada pedido do cliente logado — implementa parte de **RN24** (critério de aceite: lista mostra exatamente os pedidos retornados pela API — o filtro por cliente já é feito pelo backend, RN08 — nenhuma lógica de filtro adicional no front-end)
  - [x] Task 15.3.2: `OrderDetailPage` consumindo `obterPedido` (`GET /pedidos/:id`) com itens/total/status/`paymentStatus` (critério de aceite: se a API retornar 403/404 mesmo assim — ex. link direto manipulado — a UI mostra mensagem amigável em vez de travar)
  - [x] Task 15.3.3: Botão "Cancelar pedido" visível somente quando `status === 'pendente'`, chamando `cancelarPedido` (`PATCH /pedidos/:id/cancelar`) — implementa **RN24** (critério de aceite: cancelamento bem-sucedido atualiza a UI para `cancelado` sem reload manual; o botão nunca é renderizado fora de `pendente` — reforço de UX consistente com RN26, autorização real continua no backend)
  Dependências: Épico 15.1; Épico 13.5.

#### Rastreabilidade RN22-RN24 → Tasks (Módulo 15)

| Regra | Descrição resumida | Tasks que implementam |
|---|---|---|
| RN22 | Cliente autenticado visualiza o catálogo de produtos | 15.1.1, 15.1.2 |
| RN23 | Cliente monta e cria pedido; completa pagamento via Stripe Elements com o `paymentClientSecret` | 15.2.1, 15.2.2, 15.2.3, 15.2.4, 15.2.5 |
| RN24 | Cliente vê histórico dos próprios pedidos e cancela um pedido `pendente` | 15.3.1, 15.3.2, 15.3.3 |

---

### Módulo 16: Área do Admin

> Implementa RN25.

- **Épico 16.1: CRUD de Produtos**
  - [x] Task 16.1.1: `AdminProductsPage` listando produtos (reaproveita `listarProdutos`) com ações de editar/remover, acessível apenas via `AdminRoute` — implementa parte de **RN25** (critério de aceite: rota só acessível a `isAdmin === true`, confirmado por teste; lista exibe todos os produtos)
  - [x] Task 16.1.2: Formulário de criação/edição de produto (`nome`, `preco`, `estoque`) chamando `criarProduto`/`atualizarProduto`, com validação client-side mínima (obrigatoriedade, tipos, `estoque` inteiro ≥ 0) espelhando — sem duplicar como fonte de verdade — a validação Zod já existente no backend — implementa **RN25** (critério de aceite: submissão com dados inválidos é bloqueada na UI antes de chamar a API, com mensagem por campo; submissão válida atualiza a lista após o 200/201)
  - [x] Task 16.1.3: Confirmação explícita (modal/dialog) antes de chamar `removerProduto` (`DELETE /produtos/:id`) — implementa **RN25** (critério de aceite: remoção só ocorre após confirmação explícita do usuário; lista atualizada após o 204)
  Dependências: Épico 14.3 (`AdminRoute`); Épico 13.5.

- **Épico 16.2: Gestão de Pedidos**
  - [x] Task 16.2.1: `AdminOrdersPage` listando todos os pedidos (`listarPedidos` como admin já retorna todos, RN08 resolvido no backend) — implementa parte de **RN25** (critério de aceite: lista exibe pedidos de todos os clientes, sem filtro adicional no front-end)
  - [x] Task 16.2.2: `AdminOrderDetailPage` com seletor de novo status restrito, por UX, às transições estruturalmente válidas a partir do status atual (mesma máquina de estados de RN05, replicada como tabela estática só para a UI — a validação real permanece no backend, reforçando **RN26**) — implementa **RN25** (critério de aceite: para um pedido `enviado`, o seletor só oferece `entregue`/`cancelado`; uma chamada direta simulando contornar a UI ainda é rejeitada pelo backend com 400, confirmado por teste, evidenciando que a UI não é a fonte de verdade)
  - [x] Task 16.2.3: Chamada de `alterarStatusPedido` (`PATCH /pedidos/:id/status`) a partir do seletor, com feedback de sucesso/erro (400 de transição inválida tratado via `ApiError` genérico) — implementa **RN25** (critério de aceite: alteração bem-sucedida atualiza a UI sem reload manual; erro 400 exibe mensagem amigável sem quebrar a tela)
  Dependências: Épico 14.3; Épico 13.5.

#### Rastreabilidade RN25 → Tasks (Módulo 16)

| Regra | Descrição resumida | Tasks que implementam |
|---|---|---|
| RN25 | Área exclusiva do Admin: CRUD de Produtos e gestão de Pedidos (listar, detalhar, alterar status) | 16.1.1, 16.1.2, 16.1.3, 16.2.1, 16.2.2, 16.2.3 |

---

### Módulo 17: Testes e documentação

> Cobre RN21-RN27 (testes automatizados) e RN27 (verificação em código). Tabela de rastreabilidade consolidada ao final desta seção.

- **Épico 17.1: Setup Vitest + React Testing Library**
  - [x] Task 17.1.1: Configurar Vitest (`vitest.config.ts`, ambiente `jsdom`) + `@testing-library/react` + `@testing-library/jest-dom` (critério de aceite: `npm test` roda um teste trivial de sanidade sem depender de emulador rodando ou de rede)
  - [x] Task 17.1.2: Helpers de mock reutilizáveis: `mockApiClient` (intercepta `apiClient.request`, sem `fetch` real) e mocks de `firebase/auth`/`AuthContext` para os 3 perfis (não-autenticado, cliente, admin) (critério de aceite: um teste de exemplo usando ambos os mocks passa sem subir o Firebase Emulator Suite)
  Dependências: Módulo 13 (interfaces de `apiClient`/`AuthContext` já existentes, ao menos como contrato).

- **Épico 17.2: Testes dos fluxos principais — cobre RN21-RN26**
  - [x] Task 17.2.1: Testes de `LoginPage`/`SignupPage` (sucesso e erros de credenciais, `firebase/auth` mockado) — cobre **RN21**
  - [x] Task 17.2.2: Testes de `ProtectedRoute`/`AdminRoute` (não-autenticado redirecionado; autenticado não-admin bloqueado de rota admin; admin acessa normalmente) — cobre **RN26**
  - [x] Task 17.2.3: Teste de `CatalogPage` (lista renderizada a partir do `mockApiClient`, incluindo o caso de produto sem estoque) — cobre **RN22**
  - [x] Task 17.2.4: Teste do fluxo de criação de pedido até a etapa de pagamento — `criarPedido` mockado retornando `paymentClientSecret`; `@stripe/react-stripe-js` mockado (`useStripe`/`useElements`) confirmando que `confirmCardPayment` é chamado com o `clientSecret` correto — cobre **RN23**
  - [x] Task 17.2.5: Teste de `OrdersPage`/cancelamento (lista renderizada; botão "Cancelar" ausente fora de `pendente`; `cancelarPedido` disparado ao clicar) — cobre **RN24**
  - [x] Task 17.2.6: Testes de `AdminProductsPage` (CRUD mockado via `apiClient`) e de `AdminOrderDetailPage` (seletor de status restrito por transição válida a partir de diferentes status atuais) — cobre **RN25**
  Dependências: Épico 17.1; cada task depende do épico/módulo correspondente (14.x/15.x/16.x) já implementado.

- **Épico 17.3: Verificação de RN27**
  - [x] Task 17.3.1: Teste unitário confirmando que `src/lib/firebase.ts` só inicializa quando `VITE_FIREBASE_PROJECT_ID` tem prefixo `demo-` — a mesma trava da Task 13.4.1, agora coberta por teste automatizado — cobre **RN27** (critério de aceite: teste alterando a env var para um `projectId` sem o prefixo `demo-` confirma que a inicialização lança erro, não segue silenciosamente)
  Dependências: Épico 13.4.

- **Épico 17.4: Documentação**
  - [x] Task 17.4.1: Seção no README (raiz ou `web/README.md`) documentando como rodar `web/` junto com o Emulator Suite (2 processos: `firebase emulators:start` na raiz + `npm run dev` em `web/`), incluindo o passo de criar um cliente de teste, promovê-lo a admin via `functions/scripts/setAdminClaim.js` e logar novamente (ou usar `refreshClaims()`) para o claim refletir na UI (critério de aceite: seguindo os passos do zero, um dev cria um cliente, promove a admin via script, loga e acessa `/admin/produtos` com sucesso)
  - [x] Task 17.4.2: Documentar no README o passo opcional do Stripe CLI (`stripe listen --forward-to http://localhost:5001/demo-gscandelari-ecommerce-api/us-central1/api/webhooks/stripe`) necessário para o pedido transicionar automaticamente para `confirmado` após o pagamento de teste ser confirmado no front-end — reflete a nuance da Decisão técnica 4 (critério de aceite: comando exato documentado; README esclarece que esse passo é opcional para exercitar RN23 isoladamente, mas necessário para ver RN23+RN12 fechar o ciclo)
  Dependências: Módulos 13-16 completos (ou ao menos estáveis o suficiente para documentar com precisão).

#### Rastreabilidade RN21-RN27 → Tasks de teste (consolidada, Módulo 17)

| Regra | Tasks de teste que cobrem |
|---|---|
| RN21 | 17.2.1 |
| RN22 | 17.2.3 |
| RN23 | 17.2.4 |
| RN24 | 17.2.5 |
| RN25 | 17.2.6 |
| RN26 | 17.2.2 |
| RN27 | 17.3.1 |

---

### Rastreabilidade RN21-RN27 → Tasks (consolidada, todos os módulos da Fase 4)

| Regra | Descrição resumida | Tasks que implementam |
|---|---|---|
| RN21 | Cadastro/login de clientes via Firebase Auth (Auth Emulator) | 13.4.1, 14.1.1, 14.1.2, 14.2.1, 14.2.2, 14.2.3, 17.2.1 |
| RN22 | Cliente autenticado visualiza o catálogo de produtos | 15.1.1, 15.1.2, 17.2.3 |
| RN23 | Cliente monta/cria pedido e completa pagamento via Stripe Elements com `paymentClientSecret` | 15.2.1, 15.2.2, 15.2.3, 15.2.4, 15.2.5, 17.2.4, 17.4.2 |
| RN24 | Cliente vê histórico dos próprios pedidos e cancela pedido `pendente` | 15.3.1, 15.3.2, 15.3.3, 17.2.5 |
| RN25 | Área exclusiva do Admin: CRUD de Produtos e gestão de Pedidos | 16.1.1, 16.1.2, 16.1.3, 16.2.1, 16.2.2, 16.2.3, 17.2.6 |
| RN26 | UI de admin escondida para quem não tem o claim; backend é a fonte real de autorização | 13.3.2, 14.3.1, 14.3.2, 16.2.2, 17.2.2 |
| RN27 | Aplicação nunca se conecta a um projeto Firebase real; sempre aponta para o Emulator Suite local por padrão | 13.4.1, 17.3.1 |

### Fora de escopo desta rodada (delegado diretamente ao devops-tech-writer a partir da spec)

Os Requisitos de DevOps & Doc da Fase 4 (seção 4 da spec): `.env.example` do front-end (config do Firebase Web App em placeholders e `VITE_STRIPE_PUBLISHABLE_KEY` como `pk_test_...` placeholder); CI leve (lint + build + test) para `web/`, mesmo padrão de `ci-services.yml`, sem step de deploy (a aplicação não é publicada nesta fase, uso local/experimentação por decisão explícita do usuário). O conteúdo funcional do README sobre "como rodar `web/` + emulador juntos" (Épico 17.4 acima) já é responsabilidade deste backlog por estar explicitamente dentro do Módulo 17 (seção 3 da spec, atribuído ao arquiteto-tarefas); a criação do arquivo `.env.example` em si e o workflow de CI ficam com o devops-tech-writer, coordenando os nomes exatos de variável definidos nas Decisões técnicas 4 e 6 acima (`VITE_FIREBASE_PROJECT_ID`, `VITE_AUTH_EMULATOR_URL`, `VITE_STRIPE_PUBLISHABLE_KEY`) para não haver divergência entre o que o código lê e o que o `.env.example` documenta.

### Bloqueios (a levar de volta ao agente clarificador)

Nenhum bloqueio de negócio identificado nesta rodada. Uma nuance foi identificada e resolvida como decisão técnica, não como bloqueio: RN23 exige apenas que a aplicação "exercite RN10 de ponta a ponta" (criação da PaymentIntent e confirmação do pagamento via Stripe Elements) — a transição do **status** do pedido para `confirmado` é RN12 (Fase 2), que depende da entrega do webhook, algo que só acontece localmente com o Stripe CLI configurado (`stripe listen`, fora do que a spec da Fase 4 pede explicitamente). Isso não é uma lacuna de regra de negócio: a spec não promete o fechamento desse ciclo automaticamente em ambiente local, e o comportamento (pedido fica `pendente` até ação manual do Admin, RN25, se o Stripe CLI não estiver rodando) é consistente com as regras já existentes — apenas documentado explicitamente (Decisão técnica 4, Task 15.2.5, Task 17.4.2) para não ser confundido com um defeito da implementação.

Demais decisões (estrutura de pastas de `web/src/`, forma de tratamento de erro do cliente HTTP, mecanismo de exposição do claim de admin, integração exata com Stripe Elements, persistência do carrinho) são detalhes técnicos de implementação, delegados pela própria spec ao arquiteto-tarefas, e foram resolvidos e documentados na seção "Decisões técnicas registradas nesta rodada" acima.

---

## Backlog: gscandelari-ecommerce-api — Fase 5 (Cancelamento pós-pagamento e Reembolso)

> Gerado a partir de SPEC.md, seção "Fase 5". Fragmenta os Módulos 18-22 (seção 3 da Fase 5) em épicos e tasks técnicas pequenas, testáveis de forma independente. Nenhuma regra de negócio (RN28-RN33) foi reaberta ou reinterpretada além do necessário para viabilizar a implementação — esta fase é uma **emenda** a RN05/RN06/RN07/RN07a (Fase 1) e ao modelo de pagamento da Fase 2, então todo código já existente citado abaixo (`pedidos.statusMachine.ts`, `pedidosService.ts`, `pedidos.routes.ts`, `stripeClient.ts`, `errors/index.ts`) é **estendido no lugar**, não recriado. Esta fase toca código já em produção real (`functions/`) — assim como a Fase 2, qualquer promoção a produção depende de decisão explícita do usuário e segue a mesma estratégia de deploy manual (`workflow_dispatch`, Task 4.5.1). Os serviços da Fase 3 (`services/orders`, `services/payments`) recebem a mesma emenda por consistência de código-fonte (Épico 22.7), mas continuam sem deploy real.

### Decisões técnicas registradas nesta rodada (não são bloqueios, não requerem o clarificador)

1. **Nome, verbo HTTP e autorização do endpoint de reembolso (RN32).** `PATCH /pedidos/:id/reembolsar`, montado em `functions/src/routes/pedidos.routes.ts` ao lado das rotas de `:id/status` e `:id/cancelar` (mesmo arquivo, mesmo recurso `/pedidos`, evita criar um sub-router só para isso). Verbo `PATCH` por consistência com os outros dois endpoints de transição de estado do pedido já existentes (`:id/status`, `:id/cancelar`) — o reembolso é conceitualmente a mesma categoria de operação ("atualiza um sub-estado do pedido"), mesmo não sendo uma transição de `status` (RN32 é explícito: é o `paymentStatus` que muda, o `status` do pedido já está `cancelado` e não se altera). Protegido por `requireAdmin` (middleware já existente desde a Fase 1, Task 2.2.2) — admin-only, sem exceção, conforme RN32. A chamada ao Stripe usa `stripe.refunds.create({ payment_intent: pedido.paymentIntentId, amount: Math.round(pedido.total * 100) })` — `amount` explícito (não omitido) para manter o mesmo padrão já usado em `criarPaymentIntent` (Task 5.3.1, Fase 2), que sempre calcula o valor em centavos a partir de `pedido.total` em vez de depender do valor implícito já capturado no PaymentIntent; isso também deixa o comportamento determinístico e testável com o SDK mockado.
2. **Um único ponto de checagem de RN31, reaproveitado nos 2 pontos de entrada que efetivamente escrevem `status: "cancelado"`.** Revisando o código existente (`pedidosService.ts`): a transição `aguardando_devolucao → cancelado` (RN30) **não** é um terceiro ponto de entrada distinto — ela é disparada pelo Admin através do mesmo endpoint genérico `PATCH /pedidos/:id/status`, ou seja, pela mesma função `alterarStatusAdmin` que já trata qualquer transição para `cancelado` disparada pelo Admin (inclusive a partir de `pendente`/`confirmado`, herdadas da Fase 1). Os pontos de entrada reais são portanto só 2: `cancelarPedidoCliente` (Cliente) e `alterarStatusAdmin` (Admin, qualquer origem). Decisão: criar uma função pura `determinarPaymentStatusAoCancelar(paymentStatusAtual: PaymentStatus): PaymentStatus` em `pedidosService.ts` — retorna `"estorno_pendente"` se `paymentStatusAtual === "pago"`, senão retorna o valor recebido inalterado — chamada por ambas as funções sempre que a transição efetivada for para `"cancelado"` (nunca na transição `enviado → aguardando_devolucao`, que não é um cancelamento efetivo ainda). Evita duplicar a regra "pago → estorno_pendente" em 2 lugares com o risco de um deles divergir no futuro.
3. **Restauração de estoque nas novas transições (RN28, RN30) — `restaurarEstoque` já é reutilizável sem alteração de assinatura.** A função `restaurarEstoque(tx, itens)` (Fase 2, interna a `pedidosService.ts`) já é agnóstica de onde é chamada — recebe só a transação e os itens, sem saber a origem/destino da transição. Os call sites é que mudam:
   - `cancelarPedidoCliente`: hoje só chama `restaurarEstoque` quando `status === "pendente"` (única origem possível). Passa a chamar também quando `status === "confirmado"` (RN28) — nenhuma mudança na função em si.
   - `alterarStatusAdmin`: hoje chama `restaurarEstoque` só quando `novoStatus === "cancelado" && pedido.status === "pendente"` (RN07a, Fase 1, inalterado). Passa a chamar **também** quando `novoStatus === "cancelado" && pedido.status === "aguardando_devolucao"` (RN30) — a condição vira uma disjunção (`pendente` OU `aguardando_devolucao`), nunca `confirmado`.
   - **Nuance explícita, não é lacuna:** isso preserva deliberadamente uma assimetria entre Cliente e Admin para a transição `confirmado → cancelado`: quando o **Cliente** cancela um pedido `confirmado`, o estoque é restaurado (RN28, novo); quando o **Admin** cancela um pedido `confirmado` via `PATCH /pedidos/:id/status`, o estoque **não** é restaurado (RN07a, Fase 1, textualmente inalterado por esta spec). RN28 fala exclusivamente do Cliente ("O Cliente dono do pedido pode cancelá-lo..."); RN30 (a única extensão de RN07a mencionada nesta fase) fala exclusivamente de `aguardando_devolucao → cancelado`. Como a spec não menciona alterar o comportamento do Admin para `confirmado → cancelado`, o comportamento herdado da Fase 1 (ajuste manual, fora de escopo) permanece — mesmo padrão de decisão já usado na Fase 1 (RN07a) para justificar a assimetria cliente/admin. Documentado aqui para deixar explícito que não foi um esquecimento; ver também Tasks 19.4.1/22.4.4.
4. **Erro HTTP quando o reembolso é solicitado fora de `paymentStatus === "estorno_pendente"`.** `ValidationError` (400), pelo mesmo padrão já usado em `cancelarPedidoCliente` para "só é possível cancelar pedidos com status 'pendente'" — é uma precondição de estado de negócio violada por um payload/ação de outra forma bem formada, não um conflito de concorrência (que usaria `ConflictError`/409). Mantém consistência com o vocabulário de erro já estabelecido nas Fases 1/2 em vez de introduzir uma nova semântica de status HTTP só para este endpoint.
5. **Sequenciamento entre os Módulos 18-22.** Detalhado na seção "Ordem sugerida de execução" abaixo. Resumo: Módulo 18 é pré-requisito de tudo (define os novos valores de enum e a nova transição válida que os Módulos 19/20 consomem); Módulos 19 e 20 podem ser desenvolvidos em paralelo entre si (mexem em funções/rotas diferentes de `pedidosService.ts`/`pedidos.routes.ts`, sem overlap de código); Módulo 21 depende dos contratos finais de 19/20; Módulo 22 é incremental (TDD) em paralelo a cada módulo, com a replicação para `services/` (Épico 22.7) deliberadamente por último, só depois do comportamento em `functions/` estar validado.
6. **Replicação em `services/orders`/`services/payments` (Fase 3) — só código-fonte, sem deploy, e a fronteira do reembolso precisa de um endpoint interno novo.** A extensão do modelo/máquina de estados e da lógica de cancelamento (RN28-RN31, RN33) é duplicação direta 1:1 em `services/orders` — a mesma duplicação deliberada já documentada na Decisão técnica 4 da Fase 3 (nenhum dado sai da fronteira de Orders, `restaurarEstoque`/`cancelarPedidoCliente`/`alterarStatusAdmin` em `services/orders` não dependem do Stripe). O endpoint de reembolso (RN32) é diferente: na Fase 3, todo código que fala com o Stripe foi extraído para `services/payments` (Decisão técnica 3 da Fase 3) — `services/orders` não tem `stripeClient.ts` nem `stripeService.ts` e não deve ganhá-los agora só para o reembolso, sob pena de recriar exatamente o acoplamento que a Fase 3 eliminou. Decisão: replicar RN32 seguindo o **mesmo padrão já usado para a criação de PaymentIntent** (Módulo 9 da Fase 3) — um novo endpoint interno `POST /internal/refunds` em `services/payments` (protegido por `verifyInternalToken`, já existente), e `services/orders` chama esse endpoint via `payments.internalClient.ts` (já existente, Task 9.2.2 da Fase 3) em vez de chamar o Stripe diretamente. Isso é replicação de **comportamento equivalente**, não um "copy-paste" literal do código de `functions/` — reflete a mesma adaptação arquitetural documentada na Fase 3 para RN10. Nenhuma task deste backlog (Épico 22.7) executa `firebase deploy`, `gcloud`, ou qualquer comando que afete o projeto Firebase real — só edição de arquivos-fonte e testes/build locais.

### Ordem sugerida de execução (visão macro)

1. **Módulo 18** (Máquina de estados e modelo de dados) — pré-requisito de tudo; define os novos valores de `PedidoStatus`/`PaymentStatus` e a nova transição válida que os demais módulos consomem. Épicos 18.1 e 18.2 podem ser feitos no mesmo PR, mas 18.2 (máquina de estados) depende dos tipos definidos em 18.1.
2. **Módulo 19** (Cancelamento estendido) e **Módulo 20** (Endpoint de reembolso) — podem rodar **em paralelo** entre si (mexem em funções/rotas diferentes de `pedidosService.ts`/`pedidos.routes.ts`, sem overlap de código), mas ambos dependem do Módulo 18 completo. Dentro do Módulo 19: Épico 19.1 (helper RN31) antes de 19.3/19.4 (que o consomem); Épico 19.2 é só uma confirmação, pode ser feito a qualquer momento; 19.3 (Cliente) e 19.4 (Admin) podem rodar em paralelo entre si.
3. **Módulo 21** (Front-end) — depende dos contratos finais dos Módulos 19 e 20 (nomes de campo/endpoint não podem mudar depois). O Épico 21.1 (tipos/API client) pode começar assim que o Módulo 18 fechar, adiantando trabalho.
4. **Módulo 22** (Testes e regressão) — incremental (TDD) em paralelo a cada épico dos Módulos 18-21 conforme cada um fecha; a replicação em `services/orders`+`services/payments` (Épico 22.7) é deliberadamente a **última** fatia, só depois do comportamento em `functions/` estar validado e estável (evita retrabalho de replicar algo que ainda pode mudar); o fechamento de cobertura/rastreabilidade final (Épico 22.6) é sempre por último dentro de `functions/`.

---

### Módulo 18: Máquina de estados e modelo de dados

> Implementa RN33 (base estrutural para todos os demais módulos). Tabela de rastreabilidade ao final desta seção.

- **Épico 18.1: Modelo de dados**
  - [ ] Task 18.1.1: Estender `PedidoStatus` em `functions/src/services/pedidos.statusMachine.ts` com o valor `"aguardando_devolucao"`, e `PaymentStatus` em `functions/src/models/pedido.ts` com os valores `"estorno_pendente"` e `"reembolsado"` — implementa a base de **RN33** (critério de aceite: `npm run build` compila sem erro; `PedidoStatus` passa a ter 6 valores, `PaymentStatus` passa a ter 5 valores, ambos exportados sem quebrar nenhum import existente)
  - [ ] Task 18.1.2: Atualizar `alterarStatusSchema` (`functions/src/schemas/pedido.schema.ts`) para incluir `"aguardando_devolucao"` no `z.enum([...])` — implementa a base de **RN33** (critério de aceite: `PATCH /pedidos/:id/status` com `{ status: "aguardando_devolucao" }` passa da validação Zod; um valor fora do enum continua rejeitado com 400)
  Dependências: nenhuma (ponto de partida da Fase 5).

- **Épico 18.2: Máquina de estados — implementa RN33**
  - [ ] Task 18.2.1: Atualizar `VALID_TRANSITIONS` em `pedidos.statusMachine.ts`: `enviado: ["entregue", "aguardando_devolucao"]` (remove `"cancelado"` como destino direto a partir de `enviado`); nova chave `aguardando_devolucao: ["cancelado"]` — implementa **RN33** (critério de aceite: `isValidTransition("enviado", "cancelado")` passa a retornar `false`; `isValidTransition("enviado", "aguardando_devolucao")` retorna `true`; `isValidTransition("aguardando_devolucao", "cancelado")` retorna `true`; `isValidTransition("aguardando_devolucao", "entregue")` e qualquer outro destino a partir de `aguardando_devolucao` retornam `false`; as demais transições herdadas — `pendente→confirmado`, `pendente→cancelado`, `confirmado→enviado`, `confirmado→cancelado`, `enviado→entregue` — permanecem exatamente como estavam)
  - [ ] Task 18.2.2: Confirmar (inspeção + teste unitário isolado da função pura, sem subir o Emulator) que a mudança de contrato de `enviado→cancelado` é a **única** alteração estrutural de RN05 nesta fase — nenhuma outra transição herdada da Fase 1 muda (critério de aceite: tabela de transições completa, antes/depois, documentada no teste; teste explicitamente nomeado para deixar claro que a rejeição de `enviado→cancelado` é uma mudança de contrato intencional, não uma regressão)
  Dependências: Épico 18.1.

#### Rastreabilidade RN33 → Tasks (Módulo 18)

| Regra | Descrição resumida | Tasks que implementam |
|---|---|---|
| RN33 | Novo valor `aguardando_devolucao` em `PedidoStatus`; novos valores `estorno_pendente`/`reembolsado` em `PaymentStatus`; máquina de estados atualizada (`enviado→[entregue,aguardando_devolucao]`, `aguardando_devolucao→[cancelado]`) | 18.1.1, 18.1.2, 18.2.1, 18.2.2 |

---

### Módulo 19: Cancelamento estendido

> Implementa RN28, RN29, RN30, RN31. Tabela de rastreabilidade ao final desta seção.

- **Épico 19.1: Helper compartilhado de `paymentStatus` ao cancelar — implementa RN31**
  - [ ] Task 19.1.1: Criar `determinarPaymentStatusAoCancelar(paymentStatusAtual: PaymentStatus): PaymentStatus` em `pedidosService.ts` (função pura, sem I/O) — reflete a Decisão técnica 2 (critério de aceite: retorna `"estorno_pendente"` quando `paymentStatusAtual === "pago"`; retorna o valor recebido inalterado para `"aguardando_pagamento"`, `"falhou"`, `"estorno_pendente"` ou `"reembolsado"`; testável isoladamente, sem transação/Firestore)
  Dependências: Épico 18.1 (tipo `PaymentStatus` já estendido).

- **Épico 19.2: Confirmação de reuso de `restaurarEstoque`**
  - [ ] Task 19.2.1: Confirmar por inspeção que `restaurarEstoque(tx, itens)` não precisa de nenhuma alteração de assinatura ou de corpo para os novos call sites das Tasks 19.3.1 e 19.4.1 — reflete a Decisão técnica 3 (critério de aceite: diff do PR não altera `restaurarEstoque` em si, apenas as condições nos call sites em `cancelarPedidoCliente`/`alterarStatusAdmin`)
  Dependências: nenhuma (só uma confirmação, pode ser feita a qualquer momento).

- **Épico 19.3: `cancelarPedidoCliente` (Cliente) — implementa RN28, RN29**
  - [ ] Task 19.3.1: Estender `cancelarPedidoCliente` para aceitar `status === "confirmado"` como origem de cancelamento direto, além de `"pendente"` já existente — em ambos os casos: `restaurarEstoque(tx, pedido.itens)`, `status: "cancelado"`, `paymentStatus: determinarPaymentStatusAoCancelar(pedido.paymentStatus)` (Task 19.1.1) — implementa **RN28** (critério de aceite: cliente dono cancela pedido `confirmado` → 200, `status` vira `cancelado`, estoque restaurado, validável por leitura direta no Firestore Emulator; se `paymentStatus` era `"pago"`, passa a `"estorno_pendente"`; se era `"aguardando_pagamento"`, permanece inalterado)
  - [ ] Task 19.3.2: Estender `cancelarPedidoCliente` para rotear `status === "enviado"` para `"aguardando_devolucao"` em vez de rejeitar — sem restaurar estoque, sem alterar `paymentStatus` (o pedido ainda não está `cancelado`) — implementa **RN29** (critério de aceite: cliente dono "cancela" pedido `enviado` → 200, `status` vira `aguardando_devolucao`; estoque do produto inalterado; `paymentStatus` inalterado; validável por leitura direta no Firestore)
  - [ ] Task 19.3.3: Confirmar/ajustar a rejeição (`ValidationError`, 400) para `status` fora de `["pendente", "confirmado", "enviado"]` — ou seja, tentativas de cancelamento pelo Cliente a partir de `aguardando_devolucao`, `entregue` ou `cancelado` continuam bloqueadas (critério de aceite: os 3 cenários — `aguardando_devolucao`, `entregue`, `cancelado` — retornam 400, sem nenhuma escrita no Firestore)
  Dependências: Épicos 18.2, 19.1, 19.2.

- **Épico 19.4: `alterarStatusAdmin` (Admin) — implementa RN29, RN30, RN31, preserva RN07a**
  - [ ] Task 19.4.1: Estender a condição de restauração de estoque em `alterarStatusAdmin` de `novoStatus === "cancelado" && pedido.status === "pendente"` para `novoStatus === "cancelado" && (pedido.status === "pendente" || pedido.status === "aguardando_devolucao")` — implementa **RN30**, preserva **RN07a** para `confirmado` (Decisão técnica 3) (critério de aceite: admin transiciona `pendente→cancelado` → estoque restaurado, comportamento herdado inalterado; admin transiciona `aguardando_devolucao→cancelado` → estoque restaurado; admin transiciona `confirmado→cancelado` → estoque **não** restaurado, comportamento herdado inalterado — os 3 cenários validados por leitura direta no Firestore)
  - [ ] Task 19.4.2: Aplicar `determinarPaymentStatusAoCancelar` (Task 19.1.1) sempre que `novoStatus === "cancelado"` em `alterarStatusAdmin`, independente da origem — implementa **RN31** (critério de aceite: admin cancela pedido `confirmado` com `paymentStatus: "pago"` → `paymentStatus` vira `"estorno_pendente"`; admin cancela pedido `pendente` com `paymentStatus: "aguardando_pagamento"` → `paymentStatus` permanece inalterado; admin confirma `aguardando_devolucao→cancelado` com `paymentStatus: "pago"` → vira `"estorno_pendente"`)
  - [ ] Task 19.4.3: Confirmar (teste, sem código adicional — o comportamento já vem de `isValidTransition`, Task 18.2.1) que `alterarStatusAdmin` aceita `enviado→aguardando_devolucao` sem nenhum efeito colateral de estoque/pagamento — implementa **RN29** para o caso "ação direta do Admin" (critério de aceite: admin transiciona pedido `enviado→aguardando_devolucao` → 200; estoque inalterado; `paymentStatus` inalterado)
  - [ ] Task 19.4.4: Confirmar (teste) que `alterarStatusAdmin` rejeita `enviado→cancelado` com 400, refletindo a mudança de contrato da Task 18.2.1 — implementa a cláusula de sobreposição de RN29 sobre a parte de RN07 que hoje permitia essa transição direta (critério de aceite: tentativa de `PATCH /pedidos/:id/status` com `{status: "cancelado"}` para um pedido `enviado` retorna 400; nenhuma escrita no Firestore)
  Dependências: Épicos 18.2, 19.1, 19.2.

- **Épico 19.5: Regressão de contrato das rotas**
  - [ ] Task 19.5.1: Confirmar que `PATCH /pedidos/:id/cancelar` continua sem exigir corpo de requisição (o destino — `cancelado` ou `aguardando_devolucao` — é inteiramente decidido no backend a partir do `status` atual do pedido, nenhuma escolha exposta ao chamador) e que `PATCH /pedidos/:id/status` aceita `"aguardando_devolucao"` no payload (Task 18.1.2) sem exigir nenhum outro campo novo (critério de aceite: nenhuma mudança de assinatura nas duas rotas em `pedidos.routes.ts` além do que já é herdado do schema/serviço; contrato de resposta — o próprio `Pedido` atualizado, 200 — inalterado)
  Dependências: Épicos 19.3, 19.4.

#### Rastreabilidade RN28-RN31 → Tasks (Módulo 19)

| Regra | Descrição resumida | Tasks que implementam |
|---|---|---|
| RN28 | Cliente cancela `pendente` ou `confirmado` → `cancelado` imediato, estoque restaurado nos dois casos | 19.3.1 |
| RN29 | Cancelar a partir de `enviado` (Cliente ou Admin) vai para `aguardando_devolucao`, não direto a `cancelado` | 19.3.2, 19.4.3, 19.4.4, 18.2.1 |
| RN30 | Só Admin transiciona `aguardando_devolucao→cancelado`; estoque restaurado | 19.4.1 |
| RN31 | Nenhuma transição a `cancelado` reembolsa automaticamente; se `paymentStatus` era `"pago"`, vira `"estorno_pendente"` | 19.1.1, 19.3.1, 19.4.2 |

---

### Módulo 20: Endpoint de reembolso

> Implementa RN32. Tabela de rastreabilidade ao final desta seção.

- **Épico 20.1: Serviço de reembolso**
  - [ ] Task 20.1.1: Criar `reembolsarPedido(pedidoId: string): Promise<Pedido>` em `pedidosService.ts`, reaproveitando `getStripeClient()`/`stripeClient.ts` já existente (Fase 2) — fluxo: (a) leitura do pedido; (b) se `pedido.paymentStatus !== "estorno_pendente"`, lança `ValidationError` (Decisão técnica 4), sem chamar o Stripe; (c) **fora** de qualquer `db.runTransaction`, chama `stripe.refunds.create({ payment_intent: pedido.paymentIntentId, amount: Math.round(pedido.total * 100) })` (Decisão técnica 1); (d) em sucesso, `update` não-transacional de `paymentStatus: "reembolsado"` (mesmo padrão não-transacional já usado em `criarPedidoComPagamento`, Task 5.3.3 da Fase 2); (e) em falha, `paymentStatus` permanece `"estorno_pendente"` (nenhuma escrita), relança como `PaymentGatewayError` (502) — implementa **RN32** (critério de aceite: nenhuma chamada ao Stripe ocorre dentro de `db.runTransaction`, verificável por inspeção de código; sucesso mockado → `paymentStatus` vira `"reembolsado"`, `status` do pedido permanece inalterado — RN32 é explícito que é ação independente da máquina de estados; falha mockada → `paymentStatus` permanece `"estorno_pendente"`, permitindo nova tentativa; `pedidoId` inexistente → `NotFoundError`, 404)
  - [ ] Task 20.1.2: Confirmar que `PaymentGatewayError` (já existente em `errors/index.ts` desde a Fase 2) não precisa de nenhuma alteração para ser reutilizada aqui — mesmo padrão de RN10 (critério de aceite: erro de falha no reembolso segue o mesmo payload padronizado `{ error: { code: "PAYMENT_GATEWAY_ERROR", message } }` já usado pelo erro de falha na criação de PaymentIntent)
  Dependências: Épico 18.1 (`paymentStatus` estendido).

- **Épico 20.2: Rota `PATCH /pedidos/:id/reembolsar` (admin-only) — Decisão técnica 1**
  - [ ] Task 20.2.1: Adicionar a rota em `functions/src/routes/pedidos.routes.ts`, protegida por `requireAdmin`, chamando `reembolsarPedido` — implementa **RN32** (critério de aceite: não-admin → 403; admin + `paymentStatus !== "estorno_pendente"` → 400, sem chamada ao Stripe; admin + `paymentStatus === "estorno_pendente"` + Stripe mockado com sucesso → 200 com `paymentStatus: "reembolsado"` no corpo; admin + Stripe mockado falhando → 502, `paymentStatus` no Firestore continua `"estorno_pendente"`; sem token → 401)
  - [ ] Task 20.2.2: Atualizar `functions/src/openapi.json` (Fase 1, Task 2.7.1) com o novo endpoint `PATCH /pedidos/:id/reembolsar` e os novos valores de `PedidoStatus`/`PaymentStatus` nos schemas já documentados — critério de aceite: `npm run openapi:validate` (`@redocly/cli`) continua em 0 erros; `GET /docs` (Swagger UI) lista o novo endpoint e os novos valores de enum aparecem nos schemas de `Pedido`
  Dependências: Épico 20.1.

#### Rastreabilidade RN32 → Tasks (Módulo 20)

| Regra | Descrição resumida | Tasks que implementam |
|---|---|---|
| RN32 | Admin solicita reembolso via Stripe quando `paymentStatus === "estorno_pendente"`; sucesso → `"reembolsado"`; falha → mantém `"estorno_pendente"`, 502 | 20.1.1, 20.1.2, 20.2.1, 20.2.2 |

---

### Módulo 21: Front-end (`web/`)

> Reflete RN28-RN33 na UI de Cliente e Admin, sem duplicar autorização/regra de negócio (a validação real permanece no backend, RN26 já estabelecido na Fase 4). Tabela de rastreabilidade ao final desta seção.

- **Épico 21.1: Tipos e API client — espelha RN33, RN32**
  - [ ] Task 21.1.1: Atualizar `web/src/types/pedido.ts`: `PedidoStatus` ganha `"aguardando_devolucao"`; `PaymentStatus` ganha `"estorno_pendente"`/`"reembolsado"`; `TRANSICOES_VALIDAS` atualizado para espelhar exatamente `VALID_TRANSITIONS` de `functions/src/services/pedidos.statusMachine.ts` (Task 18.2.1) — implementa a base de **RN33** no front (critério de aceite: `TRANSICOES_VALIDAS["enviado"]` passa a ser `["entregue", "aguardando_devolucao"]`; `TRANSICOES_VALIDAS["aguardando_devolucao"]` é `["cancelado"]`; comparação campo-a-campo com o backend documentada no teste correspondente, Task 22.7 não aplicável aqui — teste fica no próprio Módulo 22)
  - [ ] Task 21.1.2: Adicionar `reembolsarPedido(id: string): Promise<Pedido>` em `web/src/api/pedidos.ts`, chamando `PATCH /pedidos/:id/reembolsar` (Task 20.2.1) — mesmo padrão de `alterarStatusPedido`/`cancelarPedido` já existentes (critério de aceite: função tipada, sem corpo de requisição, reaproveitando `request<T>` do `apiClient`)
  Dependências: Módulos 19 e 20 completos (contratos finais de endpoint/campos já fechados); Épico 13.5 da Fase 4 (`apiClient` já existente).

- **Épico 21.2: Área do Cliente — `OrderDetailPage.tsx` — implementa RN28, RN29**
  - [ ] Task 21.2.1: Atualizar a condição de exibição do botão "Cancelar pedido" de `pedido.status === "pendente"` para `["pendente", "confirmado", "enviado"].includes(pedido.status)` — implementa **RN28**, **RN29** (critério de aceite: botão visível para os 3 status; ausente para `aguardando_devolucao`, `entregue`, `cancelado`)
  - [ ] Task 21.2.2: Diferenciar o rótulo/aviso do botão conforme o status atual: em `pendente`/`confirmado`, mantém "Cancelar pedido"; em `enviado`, o rótulo/confirmação deixa explícito que o cancelamento aguardará confirmação de devolução do produto antes de virar `cancelado` (RN29) — a chamada de API continua sendo a mesma `PATCH /pedidos/:id/cancelar` em todos os casos, a decisão de destino (`cancelado` vs `aguardando_devolucao`) é sempre do backend (critério de aceite: usuário em pedido `enviado` vê o aviso distinto antes de confirmar a ação; nenhuma lógica de decisão de destino é replicada no front-end)
  Dependências: Épico 21.1.

- **Épico 21.3: Área do Admin — `AdminOrderDetailPage.tsx` — implementa RN29, RN30, RN32**
  - [ ] Task 21.3.1: Confirmar que o seletor de transições já existente (`opcoesValidas = TRANSICOES_VALIDAS[pedido.status]`) passa a oferecer `"aguardando_devolucao"` quando o pedido está `enviado`, e `"cancelado"` quando está `aguardando_devolucao`, sem nenhuma alteração de código além da Task 21.1.1 (o componente já é dirigido pela tabela) — implementa **RN29**, **RN30** (critério de aceite: nenhuma mudança de código em `AdminOrderDetailPage.tsx` é necessária para esta task além da já feita em 21.1.1; comportamento confirmado por teste de componente, Módulo 22)
  - [ ] Task 21.3.2: Adicionar botão "Solicitar reembolso", renderizado apenas quando `pedido.paymentStatus === "estorno_pendente"`, chamando `reembolsarPedido` (Task 21.1.2) e atualizando o pedido exibido em caso de sucesso — implementa **RN32** no front (critério de aceite: botão ausente para qualquer outro `paymentStatus`; presente e clicável para `"estorno_pendente"`; em sucesso, o `paymentStatus` exibido na tela muda para `"reembolsado"` sem reload manual; em falha — 502 simulado — mensagem de erro exibida via `ErrorMessage`, botão permanece disponível para nova tentativa, refletindo que `paymentStatus` continua `"estorno_pendente"` no backend)
  Dependências: Épico 21.1.

#### Rastreabilidade RN28-RN33 → Tasks (Módulo 21, reflexo no front-end)

| Regra | Descrição resumida | Tasks que implementam |
|---|---|---|
| RN28 | Botão de cancelar visível também em `confirmado` | 21.2.1 |
| RN29 | Botão de cancelar visível em `enviado`, com aviso de que aguarda devolução; seletor admin oferece `aguardando_devolucao` | 21.2.1, 21.2.2, 21.3.1 |
| RN30 | Seletor admin oferece `cancelado` a partir de `aguardando_devolucao` | 21.3.1 |
| RN32 | Botão "Solicitar reembolso" condicionado a `paymentStatus === "estorno_pendente"` | 21.1.2, 21.3.2 |
| RN33 | Tipos/`TRANSICOES_VALIDAS` do front espelhando o backend | 21.1.1 |

---

### Módulo 22: Testes e regressão

> Cobre RN28-RN33 em `functions/`, replica em `services/orders`+`services/payments` (Fase 3, sem deploy), cobre os componentes alterados do Módulo 21 e confirma zero regressão indevida nas RN01-RN27 já existentes (a única mudança de contrato esperada é `enviado→cancelado` deixar de ser uma transição válida, RN29/RN33 — documentada, não é regressão). Tabela de rastreabilidade consolidada ao final.

- **Épico 22.1: Extensão dos mocks do Stripe**
  - [ ] Task 22.1.1: Estender `test/helpers/mockStripe.ts` (Fase 2, Task 7.1.1) para simular também `stripe.refunds.create` (sucesso e erro configuráveis por teste) — critério de aceite: helper permite configurar retorno/erro de `refunds.create` por teste, sem chamada de rede real, suíte roda offline
  Dependências: Módulo 20.

- **Épico 22.2: Testes da máquina de estados — cobre RN33**
  - [ ] Task 22.2.1: Teste unitário de `isValidTransition` cobrindo os novos casos: `enviado→aguardando_devolucao` (válido), `enviado→cancelado` (agora inválido), `aguardando_devolucao→cancelado` (válido), `aguardando_devolucao→entregue` (inválido) — cobre **RN33**
  - [ ] Task 22.2.2: Revisar o teste de integração pré-existente da Fase 1 (Task 3.3.4, `enviado→confirmado rejeitada`/transições do Admin) para confirmar que ele não assume mais `enviado→cancelado` como cenário válido — ajustar o cenário para a nova regra sem remover a cobertura da transição `enviado→entregue` já existente — cobre **RN33** (critério de aceite: teste atualizado, comentário explícito de que a mudança reflete RN29/RN33, não uma regressão)
  Dependências: Épico 22.1 (não obrigatório, mas mantém a suíte no mesmo PR); Módulo 18.

- **Épico 22.3: Testes de cancelamento estendido — Cliente — cobre RN28, RN29**
  - [ ] Task 22.3.1: Teste de cliente cancelando pedido `confirmado` → 200, `cancelado`, estoque restaurado — cobre **RN28**
  - [ ] Task 22.3.2: Teste de cliente cancelando pedido `confirmado` com `paymentStatus: "pago"` → `paymentStatus` vira `"estorno_pendente"` — cobre **RN31**
  - [ ] Task 22.3.3: Teste de cliente cancelando pedido `pendente` com `paymentStatus: "aguardando_pagamento"` → `paymentStatus` permanece inalterado (nunca vira `estorno_pendente` a partir de `pendente`) — cobre **RN31**
  - [ ] Task 22.3.4: Teste de cliente "cancelando" pedido `enviado` → 200, `status` vira `aguardando_devolucao`, estoque inalterado, `paymentStatus` inalterado — cobre **RN29**
  - [ ] Task 22.3.5: Teste de cliente tentando cancelar pedido em `aguardando_devolucao`, `entregue` e `cancelado` → 400 nos 3 casos, sem alteração no Firestore — cobre o limite de **RN29**
  Dependências: Épico 22.1; Módulo 19 (Épico 19.3).

- **Épico 22.4: Testes de cancelamento estendido — Admin — cobre RN29, RN30, RN31, RN07a**
  - [ ] Task 22.4.1: Teste de admin transicionando pedido `enviado→aguardando_devolucao` → 200, sem alteração de estoque/`paymentStatus` — cobre **RN29**
  - [ ] Task 22.4.2: Teste de admin transicionando `aguardando_devolucao→cancelado` → 200, estoque restaurado — cobre **RN30**
  - [ ] Task 22.4.3: Teste de admin confirmando `aguardando_devolucao→cancelado` com `paymentStatus: "pago"` → vira `"estorno_pendente"` — cobre **RN31**
  - [ ] Task 22.4.4: Teste de regressão de RN07a: admin cancelando pedido `confirmado` → estoque **não** restaurado (comportamento herdado da Fase 1, inalterado) — confirma explicitamente que a extensão de RN28 é exclusiva do Cliente e não vazou para o caminho do Admin (Decisão técnica 3) — cobre **RN07a**
  - [ ] Task 22.4.5: Teste de admin tentando transicionar diretamente `enviado→cancelado` → 400 (transição não mais estruturalmente válida) — cobre **RN29**/**RN33**
  Dependências: Épico 22.1; Módulo 19 (Épico 19.4).

- **Épico 22.5: Testes do endpoint de reembolso — cobre RN32**
  - [ ] Task 22.5.1: Teste `PATCH /pedidos/:id/reembolsar` com `paymentStatus: "estorno_pendente"` + Stripe mockado com sucesso → 200, `paymentStatus` vira `"reembolsado"`, `status` do pedido inalterado
  - [ ] Task 22.5.2: Teste `PATCH /pedidos/:id/reembolsar` com `paymentStatus: "estorno_pendente"` + Stripe mockado falhando → 502, `paymentStatus` permanece `"estorno_pendente"` (permite nova tentativa)
  - [ ] Task 22.5.3: Teste `PATCH /pedidos/:id/reembolsar` com `paymentStatus` diferente de `"estorno_pendente"` (`"pago"`, `"reembolsado"`, `"aguardando_pagamento"`, `"falhou"`) → 400 em todos, nenhuma chamada ao Stripe
  - [ ] Task 22.5.4: Teste `PATCH /pedidos/:id/reembolsar` por não-admin → 403; sem token → 401
  Dependências: Épico 22.1; Módulo 20.

- **Épico 22.6: Regressão e cobertura final — `functions/`**
  - [ ] Task 22.6.1: Rodar a suíte completa (Fases 1-5) contra o Emulator Suite e confirmar zero regressão indevida além da mudança de contrato documentada de `enviado→cancelado` (Épico 22.2) — critério de aceite: `npm run test:emulator` verde, nenhum teste pré-existente quebrado por motivo diferente da mudança de contrato já documentada
  - [ ] Task 22.6.2: Confirmar que a cobertura ≥70% (threshold já configurado desde a Fase 1, Task 3.5.1) se mantém com o novo código dos Módulos 18-20 (critério de aceite: `npm run test:coverage` reporta ≥70% em todas as métricas)
  - [ ] Task 22.6.3: Produzir, em conjunto com o agente qa-negocio, a tabela final de rastreabilidade RN28-RN33 → testes automatizados, consolidando as tabelas por módulo acima (critério de aceite: tabela sem nenhuma RN28-RN33 órfã de teste)
  Dependências: Épicos 22.2-22.5 completos.

- **Épico 22.7: Replicação em `services/orders` + `services/payments` (Fase 3, sem deploy) — Decisão técnica 6**
  - [ ] Task 22.7.1: Replicar em `services/orders/src/services/pedidos.statusMachine.ts` e `services/orders/src/models/pedido.ts` as mesmas alterações do Módulo 18 (mesma duplicação deliberada já documentada na Decisão técnica 4 da Fase 3) — só código-fonte, nenhuma ação de deploy (critério de aceite: `npm run build` dentro de `services/orders` compila sem erro; nenhum comando `firebase deploy`/`gcloud` é executado nesta task)
  - [ ] Task 22.7.2: Replicar em `services/orders/src/services/pedidosService.ts` e `services/orders/src/routes/pedidos.routes.ts` a mesma lógica do Módulo 19 (cancelamento estendido, RN28-RN31) — nenhuma dependência de Stripe é introduzida em `services/orders` (a lógica de estoque/`paymentStatus` é autocontida, sem chamada de rede) (critério de aceite: comportamento idêntico ao de `functions/` nos testes equivalentes, validado localmente contra o Firestore Emulator, sem nenhuma ação em produção real)
  - [ ] Task 22.7.3: Replicar RN32 respeitando a fronteira já estabelecida na Fase 3 (Decisão técnica 6): criar em `services/payments` o endpoint interno `POST /internal/refunds` (protegido por `verifyInternalToken`, já existente), recebendo `{ paymentIntentId, amount }`, chamando `stripe.refunds.create` e retornando `{ refundId, status }`; em `services/orders`, `reembolsarPedido` usa `payments.internalClient.ts` (já existente) para chamar esse endpoint, seguido do mesmo `update` não-transacional de `paymentStatus` do Módulo 20 (critério de aceite: `PATCH /pedidos/:id/reembolsar` em `services/orders` funciona de ponta a ponta no Emulator Suite multi-codebase, com o cliente HTTP interno mockado nos testes automatizados; nenhuma referência a `stripeClient`/`stripeService` resta em `services/orders`, mantendo a fronteira já estabelecida na Fase 3)
  - [ ] Task 22.7.4: Replicar/adaptar os testes equivalentes aos Épicos 22.2-22.5 em `services/orders` e `services/payments`, mockando a comunicação HTTP interna onde aplicável (mesmo padrão do Módulo 12 da Fase 3) — critério de aceite: `npm test` verde em ambas as pastas; cobertura ≥70% mantida em ambas
  - [ ] Task 22.7.5: Checklist de revisão de PR confirmando explicitamente que nenhuma task deste épico executou `firebase deploy`, `gcloud`, ou qualquer comando que afete o projeto Firebase real — só edição de arquivos-fonte e execução local de testes/emuladores (critério de aceite: PR descreve a checklist marcada; nenhum log/evidência de deploy real anexado, ao contrário do que já ocorreu nas Fases 1/2 para código de produção)
  Dependências: Épicos 22.2-22.6 completos em `functions/` (comportamento validado e estável antes de replicar).

#### Rastreabilidade RN28-RN33 → Tasks de teste (consolidada, Módulo 22)

| Regra | Tasks de teste que cobrem |
|---|---|
| RN28 | 22.3.1 |
| RN29 | 22.3.4, 22.3.5, 22.4.1, 22.4.5 |
| RN30 | 22.4.2 |
| RN31 | 22.3.2, 22.3.3, 22.4.3 |
| RN32 | 22.5.1, 22.5.2, 22.5.3, 22.5.4 |
| RN33 | 22.2.1, 22.2.2, 22.4.5 |

---

### Rastreabilidade RN28-RN33 → Tasks (consolidada, todos os módulos da Fase 5)

| Regra | Descrição resumida | Tasks que implementam (código) | Tasks que implementam (testes) |
|---|---|---|---|
| RN28 | Cliente cancela `pendente` ou `confirmado` → `cancelado` imediato, estoque restaurado nos dois casos | 19.3.1, 21.2.1 | 22.3.1 |
| RN29 | Cancelar a partir de `enviado` (Cliente ou Admin) vai para `aguardando_devolucao`, não direto a `cancelado` | 18.2.1, 19.3.2, 19.4.3, 19.4.4, 21.2.1, 21.2.2, 21.3.1 | 22.3.4, 22.3.5, 22.4.1, 22.4.5 |
| RN30 | Só Admin transiciona `aguardando_devolucao→cancelado`; estoque restaurado | 19.4.1, 21.3.1 | 22.4.2 |
| RN31 | Nenhuma transição a `cancelado` reembolsa automaticamente; se `paymentStatus` era `"pago"`, vira `"estorno_pendente"` | 19.1.1, 19.3.1, 19.4.2 | 22.3.2, 22.3.3, 22.4.3 |
| RN32 | Admin solicita reembolso via Stripe quando `paymentStatus === "estorno_pendente"`; sucesso → `"reembolsado"`; falha → mantém `"estorno_pendente"`, 502 | 20.1.1, 20.1.2, 20.2.1, 20.2.2, 21.1.2, 21.3.2 | 22.5.1, 22.5.2, 22.5.3, 22.5.4 |
| RN33 | Novos valores de enum e máquina de estados atualizada | 18.1.1, 18.1.2, 18.2.1, 18.2.2, 21.1.1 | 22.2.1, 22.2.2 |

### Fora de escopo desta rodada (delegado diretamente ao devops-tech-writer a partir da spec)

Os Requisitos de DevOps & Doc da Fase 5 (seção 4 da spec): nenhum segredo novo (reaproveita `STRIPE_SECRET_KEY` já configurado); atualizar o README (raiz) com a documentação da máquina de estados e do fluxo de cancelamento/reembolso, deixando claro que o reembolso é sempre uma ação manual e deliberada do Admin, nunca automática; sem mudança na estratégia de deploy (`workflow_dispatch`, manual, Task 4.5.1 já existente) — esta fase, assim como as demais mudanças em `functions/` desde a Fase 2, só é promovida a produção real mediante decisão explícita do usuário.

### Bloqueios (a levar de volta ao agente clarificador)

Nenhum bloqueio de negócio identificado nesta rodada. A única nuance encontrada durante o planejamento — se a restauração de estoque estendida do Admin (RN30, `aguardando_devolucao→cancelado`) também deveria se aplicar à transição já existente `confirmado→cancelado` do Admin (RN07a, Fase 1) — **não é uma lacuna**: foi resolvida por leitura combinada de RN28 (que fala exclusivamente do Cliente) e RN07a (que a spec não menciona alterar para o Admin nesta fase), preservando deliberadamente a assimetria Cliente/Admin já estabelecida desde a Fase 1. Documentada como Decisão técnica 3 acima, com Tasks 19.4.1/22.4.4 garantindo cobertura de teste explícita para essa nuance, exatamente para que ela não seja confundida com um bug caso alguém note a assimetria durante a implementação ou QA.

Demais decisões (nome/verbo/formato exato do endpoint de reembolso, ponto único de checagem de RN31, código HTTP de precondição de estado, sequenciamento dos módulos, fronteira de replicação para `services/`) são detalhes técnicos de implementação, delegados pela própria spec ao arquiteto-tarefas, e foram resolvidos e documentados na seção "Decisões técnicas registradas nesta rodada" acima.
