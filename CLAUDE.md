# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — start the dev server (Turbopack, default port 3000)
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — ESLint (flat config via `eslint-config-next`)

There is no test runner configured in this project.

## ข้อจำกัดเวอร์ชัน

- Prisma 6.x เท่านั้น (6.19.3) ห้ามอัปเป็น 7
  เหตุผล: Prisma 7 ตัด `directUrl` ซึ่งจำเป็นสำหรับ Supabase
  (pooled 6543 ตอน runtime + direct 5432 ตอน migrate)
- ห้ามรัน `npx prisma init` ซ้ำ จะสร้าง skill files ที่ไม่ต้องการ
  (`.claude/skills/`, `.agents/`, `.windsurf/`, `skills-lock.json`, `prisma.config.ts`)
- ห้ามรัน `prisma migrate reset` บนโปรเจกต์นี้
  เพราะจะ `DROP SCHEMA public` ทำให้ GRANT ของ Supabase
  (`anon`/`authenticated`/`service_role`) หายไป
  ถ้าต้องล้าง DB ให้ลบตารางเจาะจงด้วย SQL แทน

## ไฟล์ที่มีอยู่แล้ว ห้ามสร้างซ้ำ

- `proxy.ts` = auth guard ระดับ request (ไม่ใช่ `middleware.ts`)
- `lib/dal.ts` = data access layer มี `server-only` guard
- `lib/supabase/` = `client.ts`, `server.ts`, `admin.ts`

ถ้าต้องแก้พฤติกรรม auth ให้แก้ไฟล์เดิม ห้ามสร้างไฟล์ใหม่ขนานกัน

env มีแหล่งเดียวคือ `.env.local` ห้ามสร้าง `.env` แยก
Prisma CLI อ่าน `.env.local` ไม่ได้ ต้องเรียกผ่าน `npm run db:*`
ที่ผูก `dotenv-cli` ไว้แล้ว ห้ามรัน `npx prisma` ตรง ๆ

## การตัดสินใจสถาปัตยกรรม (ตัดสินแล้ว ห้ามเปลี่ยนโดยไม่ถาม)

1. Prisma สร้างตารางทั้งหมดเองตั้งแต่ต้น (ไม่ใช่ pull ของเดิม)
   DB ว่าง มีแค่ตาราง `instruments` ตัวอย่างจาก Supabase quickstart
   `supabase/schema.sql` ยังไม่เคยถูก apply เข้า DB จริง

2. ยังคงใช้ `@@map` / `@map` ให้ชื่อตาราง/คอลัมน์ใน DB เป็น snake_case
   `supabase/schema.sql` เปลี่ยนสถานะเป็น "แบบร่างอ้างอิง"
   เก็บไว้เฉพาะส่วน RLS policy / trigger / function
   ที่จะ apply ทับหลัง `prisma migrate`
   ต้องลบส่วน CREATE TABLE ออกจาก `schema.sql` (Prisma คุมแทนแล้ว)

3. RLS policies + trigger (เช่น `protect_profile_role`, `protect_restaurant_approval`)
   ที่มีอยู่คงไว้ทั้งหมด แต่เป็นชั้นป้องกันสำหรับทาง Supabase client เท่านั้น
   business logic เรื่องสิทธิ์ต้องอยู่ใน `modules/` เท่านั้น
   ห้ามพึ่ง RLS/trigger เป็นตัวบังคับกฎของแอป
   (Prisma ต่อด้วย postgres role โดยตรง `auth.uid()` จะเป็น null เสมอ
    ⇒ bypass ได้ทั้ง RLS และ trigger พวกนี้เสมอ — กฎจริงต้องบังคับซ้ำใน `modules/`)

4. Role type = `"customer" | "owner" | "admin"`
   ตรงกับ enum `user_role` ใน DB
   source of truth คือตาราง `profiles`
   ห้ามเก็บ role ใน `user_metadata` (client แก้เองได้)

5. ขยาย `lib/dal.ts` ห้ามสร้าง `lib/auth.ts` แยก
   ต้องมีจุดตรวจสิทธิ์จุดเดียวในโปรเจกต์

6. Route: `/dashboard` = หน้ากลางทุก role
          `/owner/*`   = หน้าเจ้าของร้าน
          `/admin/*`   = หน้าแอดมิน

7. `proxy.ts` คือ auth guard (ไม่ใช่ `middleware.ts`)
   เช็คแค่ login แล้วหรือยัง ไม่เช็ค role
   ความปลอดภัยจริงอยู่ที่ `requireRole` ใน `lib/dal.ts`

## ปัญหาค้างที่ยังไม่แก้

- Role type ใน `lib/dal.ts` ยังเป็น `"user" | "admin"` ไม่ตรง enum จริง
- `admin-user-table.tsx` dropdown ยังเป็น user/admin
- role check กระจายอยู่ 2 จุด (`app/admin/page.tsx`, `app/admin/actions.ts`)
- `.env.local` ยังขาด `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- ยังไม่ยืนยันว่า `supabase/schema.sql` ถูก apply ลง DB จริงหรือยัง
- ตาราง `reservations` ยังไม่มีฟิลด์ `slot_time`, `party_size`
  และยังไม่มีตาราง `opening_hours`, `booking_settings`, `closures`
- `Profile` ไม่มี FK ไป `auth.users` ต้องมีฟังก์ชันลบ user
  ที่ลบทั้ง `auth.users` และ `profiles` พร้อมกัน (ทำใน Task 2)
- `updated_at` อัปเดตเฉพาะเมื่อแก้ผ่าน Prisma
  แก้ผ่าน SQL ตรง ๆ จะไม่ขยับ

## งานถัดไป

ขั้น A: หลังผมเติม env ครบ ให้ `prisma db pull` เพื่อดูว่า DB จริงมีอะไร

## Architecture

TableNow — an online restaurant table-booking / queue system. Next.js App Router project (`next@16.3.0`, React 19) with Supabase-backed auth, a role-gated admin area, and shadcn/ui for components.

- `app/layout.tsx` — root layout; loads Geist Sans/Mono via `next/font/google` and renders `SiteHeader`.
- `app/globals.css` — Tailwind CSS v4 (via `@tailwindcss/postcss`, no `tailwind.config.*` — v4 is configured through CSS).
- Path alias `@/*` maps to the repo root (`tsconfig.json`).

**Target architecture** (see "Project rules" below) moves app data access from direct Supabase table calls onto Prisma + a `modules/` service layer, and expands the role model from two roles to three (`CUSTOMER`, `OWNER`, `ADMIN`). This is not yet reflected in the code described in the rest of this section — treat the sections below as the current implementation, and the rules section as the direction new work should take it.

### Auth (Supabase SSR via `@supabase/ssr`)

- `lib/supabase/client.ts` / `lib/supabase/server.ts` — browser vs. server Supabase clients; the server client reads/writes auth cookies via `next/headers`.
- `proxy.ts` (root) + `lib/supabase/proxy.ts` — Next 16 renamed `middleware.ts` to `proxy.ts` (`node_modules/next/dist/docs/.../file-conventions/proxy.md`). `updateSession()` refreshes the session on every request and redirects unauthenticated users away from `/dashboard` and `/admin`, and authenticated users away from `/login`/`/signup`. It only checks *authentication*, not role — update `PROTECTED_PREFIXES`/`AUTH_PATHS` here when adding new gated routes.
- `lib/dal.ts` — data-access layer; `getUser()` (cached, nullable) and `getProfile()` (cached, redirects to `/login` if no profile row) are the entry points for the current user and their role. Prefer these over calling Supabase directly for user/role lookups. **Currently `Role = "user" | "admin"`** — the project rules below call for `CUSTOMER | OWNER | ADMIN`; migrating this type and the `profiles.role` values is pending work, not yet done.
- Server actions: `app/actions.ts` (`logout`), `app/login/actions.ts` (`login`), `app/signup/actions.ts` (`signup`), `app/admin/actions.ts` (`setUserRole`). `setUserRole` re-checks `getProfile().role === "admin"` itself — role authorization for admin mutations happens at the action, not the proxy.

### Database

`supabase/schema.sql` is currently the hand-maintained source of truth for `public.profiles` (mirrors `auth.users`, adds `role`), an `is_admin()` `security definer` helper (avoids RLS self-recursion), RLS policies, and a trigger that inserts a profile row on signup. There is no self-service role-change path; promoting the first admin requires the manual `update` statement commented at the bottom of the file. Requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `.env.local`).

Per the project rules below, this is being migrated to **Prisma-owned schema** — `supabase/` SQL becomes limited to RLS policies and database functions only, with `prisma/schema.prisma` as the actual source of truth for table shape. Prisma is not yet installed (not in `package.json`); there is no `prisma/` directory yet.

### UI components

shadcn/ui is configured via `components.json`: style `base-nova` on Base UI primitives (`@base-ui/react`, not Radix), icon library `lucide-react`, path aliases `@/components`, `@/components/ui`, `@/lib`, `@/hooks`. Installed primitives live in `components/ui/*` (add more with `npx shadcn@latest add <name>`). `components/icons/icon-placeholder.tsx` is a local component, not a registry item — shadcn's own block templates use `<IconPlaceholder lucide="IconName" />` as a build-time marker the CLI swaps for a real `lucide-react` import; this project implements that same contract at runtime so pasted block snippets work without manual editing.

`@headlessui/react` and `@heroicons/react` are also installed, used by pages built from Tailwind Plus / Tailwind UI templates (which ship Headless UI + Heroicons, not Base UI/lucide) rather than from the shadcn registry. Both primitive/icon stacks coexist — match whichever a given page or pasted snippet already uses rather than converting it to the other.

## Target folder structure

No `src/` — top-level dirs under `my-app/`. `modules/`, `types/`, `constants/`, and `prisma/` don't exist yet and should be created as this work lands.

```
app/           pages + API routes
components/    ui/ (shadcn) + app-specific components
lib/           prisma.ts, supabase/, api-response.ts, datetime.ts
modules/       business logic, one subtree per feature   ← to be created
types/                                                    ← to be created
constants/                                                ← to be created
prisma/        schema.prisma, seed.ts                     ← to be created
supabase/      SQL migrations for RLS / db functions only
```

Import everything via the `@/` alias, e.g. `@/lib/prisma`, `@/modules/booking/booking.service`.

## Project rules

These govern all new work in this repo, independent of what's already implemented:

1. **Prisma owns the schema.** Never change tables via the Supabase Dashboard. `supabase/migrations/` is for RLS policies and database functions only.
2. **Prisma only touches the `public` schema.** Never add a model or migration that reaches into Supabase's `auth` schema.
3. `Profile.id` is a UUID and must equal `auth.users.id`.
4. **`Profile.role` is the source of truth for role**, synced to `app_metadata`. Never use `user_metadata` for role — it's client-writable.
5. RLS is enabled on every table in `public`, with no policies defined by default (deny-all for the anon key) unless a policy is explicitly added.
6. **Business logic lives only in `modules/`.** An API route should just: parse the request → check authorization → call the service → return the response.
7. **Every endpoint checks both role and ownership, server-side.** Checking role alone is not sufficient — verify the caller actually owns the resource:
   ```ts
   ❌ if (profile.role === 'OWNER') update(id)
   ✅ const r = await getRestaurant(id)
      if (r.ownerId !== profile.id) throw forbidden()
   ```
8. One response shape everywhere:
   ```
   { success: true, data }
   { success: false, error: { code, message } }
   ```
   `code` is an English string for the frontend to branch on; `message` is Thai, shown to the user.
9. **All Thai user-facing text lives in `constants/messages.ts`.** Never hardcode Thai strings in components.
10. **UI is shadcn/ui first.** If a component is missing, run `npx shadcn@latest add <name>` rather than hand-rolling a Button/Input/Dialog.
11. **Do only the task asked, not ahead of it.** If you notice follow-up work worth doing, say so and wait rather than doing it unprompted.

## Prohibited

- Importing `lib/supabase/admin.ts` into a client component.
- Calling supabase-js from the client to read/write app data — client-side supabase-js is for `signUp` / `signIn` / `signOut` / `getSession` only.
- Trusting a role value sent from the client, ever — always re-derive it server-side.
- Committing `.env.local`.

**Before writing any code, read the relevant guide under `node_modules/next/dist/docs/`** — this project pins a Next.js version newer than the assistant's training data, and APIs/conventions may differ from what you expect. See `AGENTS.md` for details.
