You are writing a Devvit web application that will be executed on Reddit.com.

## Tech Stack

- **Frontend**: Vue 3 (`<script setup>` SFCs), Tailwind CSS 4, Vite
- **Backend**: Node.js v22 serverless environment (Devvit), Hono
- **Communication**: Plain `fetch` against Hono routes; types shared via `src/shared`

## Layout & Architecture

- `/src/server`: **Backend Code**. This runs in a secure, serverless environment.
  - `index.ts`: Main server entry point (Hono app).
  - `routes/`: Route modules mounted under `/api` and `/internal`.
  - Access `redis`, `reddit`, and `context` here via `@devvit/web/server`.
- `/src/client`: **Frontend Code**. This is executed inside of an iFrame on reddit.com
  - To add an entrypoint, create an HTML file and add it to `devvit.json`
  - Entrypoints:
    - `game.html` (loads `game.ts` → `Game.vue`): The main Vue entry point (Expanded View).
    - `splash.html` (loads `splash.ts` → `Splash.vue`): The initial Vue entry point (Inline View). Keep it fast and keep heavy dependencies inside `game.html`.
- `/src/shared`: **Shared Code**. Code to share between the client and server

## Frontend

### Rules

- Instead of `window.location` or `window.assign`, use `navigateTo` from `@devvit/web/client`
- Prefer `<script setup lang="ts">` and Composition API composables in `src/client/composables/`

### Limitations

- `window.alert`: Use `showToast` or `showForm` from `@devvit/web/client`
- File downloads: Use clipboard API with `showToast` to confirm
- Geolocation, camera, microphone, and notifications web APIs: No alternatives
- Inline script tags inside of `html` files: Use a script tag and separate js/ts file

## Commands

- `npm run type-check`: Check typescript types (uses `vue-tsc`)
- `npm run lint`: Check the linter

## Code Style

- Prefer type aliases over interfaces when writing typescript
- Prefer named exports over default exports (Vue SFCs are an exception — `App.vue` exports default)
- Never cast typescript types

## Global Rules

- You may find code that references blocks or `@devvit/public-api` while building a feature. Do NOT use this code as this project is configured to use Devvit web only.
- Whenever you add an endpoint for a new menu item action, ensure that you've added the corresponding mapping to `devvit.json` so that it is properly registered

Docs: https://developers.reddit.com/docs/llms.txt.
