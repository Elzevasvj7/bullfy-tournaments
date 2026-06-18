---
name: lovable-migration
description: Migrate completed Bullfy Tournaments work from this Next.js app into the Lovable Vite/React Router app under lovavle-source. Use when the user says to migrate a finished module, screen, component, header, chat, arena, tournament feature, or similar work to Lovable/Vite.
---

# Lovable Migration

Use this skill when the user asks to move completed work from the Next.js app into `lovavle-source`, the Lovable Vite app.

## Repos

- Source app: project root, Next.js App Router.
- Target app: `lovavle-source`, Vite + React Router.
- Target tournament routes live under `lovavle-source/src/pages/tournament`.
- Target routing is declared in `lovavle-source/src/App.tsx`.

## Migration Workflow

1. Identify the source feature.
   - Read the changed Next files for the requested module.
   - Include dependent components, services, types, assets, CSS variables, and package dependencies.
   - Do not copy unrelated Next-only files.

2. Map Next concepts to Vite.
   - `next/link` -> `Link` from `react-router-dom`.
   - `next/image` -> regular `img` or local asset import.
   - App Router pages -> React Router page components.
   - `params`/server route params -> `useParams`.
   - Server components and async page data -> client-side hooks, local mocks, or existing Lovable service patterns.
   - API routes under `app/api` are not portable as-is; move logic into services or Supabase functions depending on existing target patterns.
   - `@/` imports should match the target Vite alias.

3. Preserve target conventions.
   - Prefer existing Lovable tournament layout, route names, auth guards, services, stores, shadcn components, and styling conventions.
   - Integrate into existing files under `lovavle-source/src/pages/tournament` instead of creating parallel app shells unless the user asks for an isolated demo.
   - Keep Tailwind v3 compatibility in target; do not assume Tailwind v4-only syntax.

4. Assets and CSS.
   - Copy only needed public assets into `lovavle-source/public` or `lovavle-source/src/assets` following target usage.
   - Port shared CSS variables/classes from `app/globals.css` into `lovavle-source/src/index.css` only when required.
   - Avoid duplicating global styles if equivalent target tokens already exist.

5. Dependencies.
   - Compare root `package.json` with `lovavle-source/package.json`.
   - Add missing dependencies only to `lovavle-source/package.json` with the target package manager already used there.
   - Watch version mismatches. The target currently uses React 18 and `@react-three/fiber` 8, while the source app may use React 19 and newer R3F.

6. Validate.
   - Run target lint/build/test as appropriate from `lovavle-source`.
   - For visual/frontend work, run or use the Vite dev server and verify the migrated route with browser automation or screenshots when available.
   - Report any behavior intentionally stubbed because the source used Next-only server behavior.

## Common Target Routes

- Lobby: `/tournament`
- Ranking: `/tournament/rankings`
- Wallet: `/tournament/wallet`
- Create: `/tournament/create`
- Detail: `/tournament/t/:slug`
- Live: `/tournament/t/:slug/live`
- Arena: `/tournament/t/:slug/arena`
- Clans: `/tournament/clans`
- Versus: `/tournament/versus`

## User Shortcut

When the user says phrases like:

- "Terminamos chat, migralo a lovable"
- "migra el header a Lovable"
- "pasa la arena al repo Lovable"

Execute the workflow directly. Ask a question only if the destination route or target behavior is genuinely ambiguous.
