# public/ — Página institucional (Firebase Hosting)

Raiz do Firebase Hosting (`firebase.json` > `hosting.public`), servida em [`https://gscandelari-ecommerce-api.web.app`](https://gscandelari-ecommerce-api.web.app) — também o API Gateway (`hosting.rewrites`) para os serviços Orders/Payments.

`index.html` é uma página estática (Tailwind CSS, sem framework), mesmo padrão visual/técnico usado em [gscandelari.com.br](https://gscandelari.com.br): dark mode, Inter, Font Awesome (CDN), i18n pt-BR/EN client-side (`js/i18n.js` + `translations/*.json`).

## Editar e rebuildar o CSS

```bash
cd public
npm install         # uma vez
npm run watch:css   # durante o desenvolvimento (rebuild automático)
npm run build:css   # build final, minificado — commitar css/tailwind.css atualizado
```

`css/tailwind.css` é **gerado** a partir de `css/input.css` + as classes usadas em `index.html` (`tailwind.config.js` > `content`). Não há build step automatizado no deploy — sempre rode `npm run build:css` e commite o resultado antes de `firebase deploy --only hosting`.

Este arquivo, `package.json` e `package-lock.json` **não são deployados** (`firebase.json` > `hosting.ignore`: `**/*.md`, `**/package*.json`) — só existem para o build local. `tailwind.config.js` é deployado (sem problema — não tem segredo nenhum), mesma convenção usada em gscandelari.com.br.
