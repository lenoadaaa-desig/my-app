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

Next.js App Router project (`next@16.3.0`, React 19) with Supabase-backed auth, a role-gated admin area, and shadcn/ui for components.

- `app/layout.tsx` — root layout; loads Geist Sans/Mono via `next/font/google` and renders `SiteHeader`.
- `app/globals.css` — Tailwind CSS v4 (via `@tailwindcss/postcss`, no `tailwind.config.*` — v4 is configured through CSS).
- Path alias `@/*` maps to the repo root (`tsconfig.json`).

### Auth (Supabase SSR via `@supabase/ssr`)

- `lib/supabase/client.ts` / `lib/supabase/server.ts` — browser vs. server Supabase clients; the server client reads/writes auth cookies via `next/headers`.
- `proxy.ts` (root) + `lib/supabase/proxy.ts` — Next 16 renamed `middleware.ts` to `proxy.ts` (`node_modules/next/dist/docs/.../file-conventions/proxy.md`). `updateSession()` refreshes the session on every request and redirects unauthenticated users away from `/dashboard` and `/admin`, and authenticated users away from `/login`/`/signup`. It only checks *authentication*, not role — update `PROTECTED_PREFIXES`/`AUTH_PATHS` here when adding new gated routes.
- `lib/dal.ts` — data-access layer; `getUser()` (cached, nullable) and `getProfile()` (cached, redirects to `/login` if no profile row) are the entry points for the current user and their `role: "user" | "admin"`. Prefer these over calling Supabase directly for user/role lookups.
- Server actions: `app/actions.ts` (`logout`), `app/login/actions.ts` (`login`), `app/signup/actions.ts` (`signup`), `app/admin/actions.ts` (`setUserRole`). `setUserRole` re-checks `getProfile().role === "admin"` itself — role authorization for admin mutations happens at the action, not the proxy.

### Database

`supabase/schema.sql` is the hand-maintained source of truth — there is no migration tool, so run it manually in the Supabase SQL editor. It defines `public.profiles` (mirrors `auth.users`, adds `role`), an `is_admin()` `security definer` helper (avoids RLS self-recursion), RLS policies, and a trigger that inserts a profile row on signup. There is no self-service role-change path; promoting the first admin requires the manual `update` statement commented at the bottom of the file. Requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `.env.local`).

### UI components

shadcn/ui is configured via `components.json`: style `base-nova` on Base UI primitives (`@base-ui/react`, not Radix), icon library `lucide-react`, path aliases `@/components`, `@/components/ui`, `@/lib`, `@/hooks`. Installed primitives live in `components/ui/*` (add more with `npx shadcn@latest add <name>`). `components/icons/icon-placeholder.tsx` is a local component, not a registry item — shadcn's own block templates use `<IconPlaceholder lucide="IconName" />` as a build-time marker the CLI swaps for a real `lucide-react` import; this project implements that same contract at runtime so pasted block snippets work without manual editing.

`@headlessui/react` and `@heroicons/react` are also installed, used by pages built from Tailwind Plus / Tailwind UI templates (which ship Headless UI + Heroicons, not Base UI/lucide) rather than from the shadcn registry. Both primitive/icon stacks coexist — match whichever a given page or pasted snippet already uses rather than converting it to the other.

**Before writing any code, read the relevant guide under `node_modules/next/dist/docs/`** — this project pins a Next.js version newer than the assistant's training data, and APIs/conventions may differ from what you expect. See `AGENTS.md` for details.
