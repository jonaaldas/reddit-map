## Devvit Vue Starter

A Vue port of the Devvit React starter — build web applications on Reddit's developer platform.

- [Devvit](https://developers.reddit.com/): A way to build and deploy immersive games on Reddit
- [Vite](https://vite.dev/): For compiling the webView
- [Vue 3](https://vuejs.org/): For UI (`<script setup>` SFCs)
- [Hono](https://hono.dev/): For backend logic
- [Tailwind](https://tailwindcss.com/): For styles
- [TypeScript](https://www.typescriptlang.org/): For type safety

## Getting Started

> Make sure you have Node 22 downloaded on your machine before running!

1. `npm install`
2. `npm run login` — log into Devvit
3. `npm run dev` — runs `devvit playtest`

## Fetch Domains

The following external domains are requested for this app:

- `api.openai.com` — Calls OpenAI's chat completions API to extract named restaurant/venue mentions from each Reddit post and comment, returning the venue name plus lat/lng inside the configured city's bounding box. Used during the rescan / live-trigger backfill of pins. This domain is on the Devvit global fetch allowlist.
- `nominatim.openstreetmap.org` — Geocoder. When a moderator types a city name in the app's "Map cities" setting (paragraph field), the server calls Nominatim once per line to resolve the free-text query to a center coordinate and bounding box, then caches the result in Redis until the setting text changes. Required because no Devvit capability or approved AI provider returns reliable city bounding boxes.
- `tile.openstreetmap.org` — Map tile raster source. The Leaflet map renders 256×256 OSM tile PNGs proxied through the app server with aggressive `Cache-Control` (24h immutable) so each tile is fetched at most once per browser per day. Usage stays well under OSM's tile policy thresholds; the proxy sends a custom `User-Agent` identifying the app.

## Terms and Privacy

Both documents are linked from the app details form on developers.reddit.com.

## Commands

- `npm run dev`: Starts a development server where you can develop your application live on Reddit.
- `npm run build`: Builds your client and server projects
- `npm run deploy`: Uploads a new version of your app
- `npm run launch`: Publishes your app for review
- `npm run login`: Logs your CLI into Reddit
- `npm run type-check`: Type-checks (`vue-tsc`) the project
- `npm run lint`: Lints `src/**/*.{ts,vue}`
