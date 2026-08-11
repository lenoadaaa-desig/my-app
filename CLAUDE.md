# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — start the dev server (Turbopack, default port 3000)
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — ESLint (flat config via `eslint-config-next`)

There is no test runner configured in this project.

## Architecture

This is a Next.js App Router project (`next@16.3.0`, React 19) currently at the default `create-next-app` scaffold — no custom routes, components, or libraries have been added yet.

- `app/layout.tsx` — root layout; loads the Geist Sans/Mono fonts via `next/font/google` and applies them as CSS variables on `<html>`.
- `app/page.tsx` — the `/` route.
- `app/globals.css` — global styles, Tailwind CSS v4 (loaded via `@tailwindcss/postcss`, no `tailwind.config.*` file — v4 is configured through CSS).
- Path alias `@/*` maps to the repo root (`tsconfig.json`).

**Before writing any code, read the relevant guide under `node_modules/next/dist/docs/`** — this project pins a Next.js version newer than the assistant's training data, and APIs/conventions may differ from what you expect. See `AGENTS.md` for details.
