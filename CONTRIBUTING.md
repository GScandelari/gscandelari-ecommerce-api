# Contribuindo — gscandelari-ecommerce-api

Este documento define como o repositório é versionado: convenção de commits, estratégia de branches e o processo de Pull Request. Ele implementa o Épico 4.1 (Git & convenções) do `BACKLOG.md`.

## 1. Estratégia de branching — GitHub Flow

Usamos **GitHub Flow**, um fluxo simples de branch única de longa duração:

1. `main` é a branch principal e deve estar **sempre deployável**. Nada é commitado diretamente nela.
2. Para qualquer mudança (feature, fix, chore, doc...), crie uma **branch curta** a partir de `main`:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b <tipo>/<descricao-curta>
   ```
   Exemplos: `feat/produtos-crud`, `fix/status-pedido-cancelado`, `docs/readme-deploy`, `chore/ci-lint`.
3. Faça commits pequenos e frequentes na branch, seguindo a convenção da seção 2.
4. Abra um **Pull Request** para `main` assim que houver algo revisável (PRs de rascunho/`draft` são bem-vindos para feedback antecipado).
5. O PR só pode ser mesclado depois que os checks obrigatórios de CI (lint + testes contra o Emulator Suite — ver `.github/workflows/ci.yml`) passarem.
6. Após o merge, a branch de feature é apagada. `main` permanece sempre no estado que pode, em princípio, ser implantado (ver `README.md` > "Deploy").

> Configuração de branch protection (GitHub) recomendada para `main` (Task 4.1.1/4.1.3, aplicada manualmente nas configurações do repositório GitHub, fora do escopo de arquivos versionados): exigir Pull Request antes de merge, exigir que o check `CI` esteja verde, e desabilitar push direto/force-push em `main`.

## 2. Convenção de commits — Conventional Commits

Todo commit deve seguir [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/):

```
<tipo>(<escopo opcional>): <descrição curta no imperativo>

[corpo opcional explicando o "porquê"]

[rodapé opcional: BREAKING CHANGE, referências a issues, etc.]
```

Tipos utilizados neste projeto:

| Tipo       | Quando usar                                                              |
|------------|---------------------------------------------------------------------------|
| `feat`     | Nova funcionalidade visível (ex: novo endpoint, nova regra de negócio)   |
| `fix`      | Correção de bug                                                          |
| `test`     | Adição/ajuste de testes, sem mudança de código de produção               |
| `docs`     | Mudanças em documentação (README, CONTRIBUTING, comentários relevantes)  |
| `chore`    | Tarefas de manutenção (deps, config de build/lint, CI/CD)                |
| `refactor` | Mudança de código que não altera comportamento externo                  |
| `style`    | Formatação, ponto e vírgula, etc. (sem mudança de lógica)                |
| `perf`     | Melhoria de performance                                                  |

Exemplos:
```
feat(produtos): implementa POST /produtos com validação Zod
fix(pedidos): impede transição enviado->confirmado na maquina de status
test(pedidos): cobre restauracao de estoque em cancelamento pelo cliente
docs(readme): documenta variaveis de ambiente do emulator
chore(ci): adiciona job de lint ao workflow de CI
```

Regras práticas:
- Descrição no imperativo, em minúsculas, sem ponto final.
- Um commit deve representar uma unidade lógica coerente (evite commits "mega" misturando `feat` + `fix` + `docs` não relacionados).
- Referencie a Task do `BACKLOG.md` no corpo do commit ou do PR quando fizer sentido (ex: `Refs Task 2.5.1`).

## 3. Pull Requests

- Título do PR: idealmente segue a mesma convenção do commit principal (ex: `feat(pedidos): endpoints de criação e listagem`).
- Descrição do PR: o que mudou e por quê; quais Tasks/RNs do `BACKLOG.md`/`SPEC.md` o PR endereça; como testar localmente.
- PRs devem ser pequenos e focados sempre que possível (uma Task ou um pequeno grupo de Tasks relacionadas do backlog).
- Nenhum PR deve incluir segredos, credenciais ou arquivos de service account — ver `README.md` > "Variáveis de ambiente e segredos" e o `.gitignore` da raiz.

## 4. Antes de abrir o PR (checklist local)

```bash
cd functions
npm run lint          # quando o setup de lint (Task 1.3.1) estiver disponível
npm run build          # TypeScript compila sem erros
npm run test:emulator  # suíte Jest+Supertest contra o Firebase Emulator Suite
```

Nota sobre o estado atual do repositório (ver `README.md` > "Estado atual do projeto"): a suíte de testes está em estado "vermelho" esperado (TDD) até a implementação do Módulo 2 (Core Business) do `BACKLOG.md`, e o script `lint` ainda não existe até a Task 1.3.1 ser concluída. Isso é esperado nesta fase e não deve bloquear commits de infraestrutura/documentação como este.
