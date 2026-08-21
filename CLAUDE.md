# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## กฎที่ต้องรักษาตลอดโปรเจกต์

- Commit ได้เมื่อจบงานแต่ละ task
- ห้าม `git push` โดยไม่ได้รับอนุญาต ต้องถามก่อนทุกครั้ง
- ห้าม `git rebase`, `git reset --hard`, force push ทุกกรณี
- ห้ามรัน `npm run build` ขณะที่ `npm run dev` กำลังทำงานอยู่
  ทั้งสองคำสั่งเขียน `.next/` คนละชุดแต่ใช้โฟลเดอร์ร่วมกัน
  ทำให้ dev server ที่รันอยู่เสิร์ฟ manifest/RSC payload
  ปนกันคนละรุ่น อาการคือบางส่วนของหน้าแสดงข้อมูลถูก
  อีกส่วนว่างเปล่าโดยไม่มี error ใด ๆ
  เสียเวลาไล่หาบั๊กที่ไม่มีอยู่จริง

  ก่อนรัน build ต้องหยุด dev server ก่อนเสมอ
  ถ้าเจออาการข้อมูลหน้าเว็บไม่ตรงกับ DB ให้สงสัยเรื่องนี้ก่อน
  ลอง `rm -rf .next/dev` แล้วสตาร์ท dev ใหม่

## สถานะงานปัจจุบัน (อัปเดต 16 ส.ค. 2026)

เสร็จแล้ว:
- Task 0-5: backend ครบทั้งระบบ 123 เทสผ่าน
  schema + RLS + auth 3 บทบาท + ร้าน/อนุมัติ
  + slot engine + createBooking (advisory lock)
  + changeBookingStatus (relationship-based permission)
- Task 6: ธีมครีมทอง + หน้าลูกค้า
  /restaurants, /restaurants/[id], /bookings/my,
  /dashboard, navigation ตาม role

ยืนยันด้วยการทดสอบจริงในเบราว์เซอร์แล้ว:
- จองสำเร็จได้รหัส BK-KDUCPB
- ที่นั่งลดจาก 10 เหลือ 7 หลังจอง 3 คน (bookedMap ทำงานถูก)
- responsive 375px ไม่แตก
- isOpenNow จัดการร้านข้ามเที่ยงคืนถูกต้อง

แก้ไปแล้วในรอบล่าสุด:
- __all__ หลุดใน dropdown (Base UI Select.Value
  ไม่ auto-derive label เหมือน Radix ต้องส่ง function)
- placeholder รูปร้าน (ไอคอน UtensilsCrossed)
- console 404 (มาจาก Link prefetch ไป /owner/dashboard
  ที่ยังไม่มี แก้ด้วย prefetch={false} ชั่วคราว)
- line-height ภาษาไทยกับ line-clamp (เพิ่ม leading-relaxed)

กำลังทำ:
- Task 7 หน้าเจ้าของร้าน (ยังไม่เริ่ม)

ถัดไป:
- Task 7 หน้าเจ้าของร้าน (ฟอร์มลงทะเบียน, ตั้งเวลาทำการ,
  แดชบอร์ดจัดการการจองรายวัน)
- Task 8 หน้าแอดมิน
- Task 9 เก็บงาน

ปัญหาค้าง:
- ลิงก์ /owner/dashboard ใน site-nav ใส่ prefetch={false} ไว้
  เมื่อ Task 7 สร้างหน้าจริงแล้วให้เอาออก

ข้อมูลทดสอบ:
- npm run seed:demo สร้างร้าน 3 ร้าน
  id: d3a10000-0000-4000-8000-00000000000{1,2,3}
- owner: leno.adaaa@gmail.com

## Commands

- `npm run dev` — start the dev server (Turbopack, default port 3000)
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — ESLint (flat config via `eslint-config-next`)
- `npm run db:generate` — regenerate the Prisma client
- `npm run db:migrate -- --name <name>` — create + apply a dev migration (never use `prisma db push` — no migration file to track)
- `npm run db:pull` — introspect the live DB (e.g. `-- --print` to compare without overwriting `schema.prisma`)
- `npm run db:studio` / `npm run db:seed`
- `npm test` — run the full test suite once (Vitest, wrapped with `dotenv-cli` reading `.env.local` — most test files hit the live DB directly, so this must load first)
- `npm run test:watch` — Vitest in watch mode
- `npm run test:fast` — only `slot.engine.test.ts` + `booking.state.test.ts` (pure-function tests, no DB) — use while iterating on booking-logic changes; still run the full `npm test` before committing, since it's the only one that actually exercises the DB-backed tests (advisory lock, concurrency, RLS-adjacent paths)

All `db:*` scripts (and `test`/`test:watch`) wrap the underlying CLI with `dotenv-cli` reading `.env.local` — never run `npx prisma` or `npx vitest` directly (see "ข้อจำกัดเวอร์ชัน" below). Running bare `vitest`/`npx vitest run` skips `.env.local` entirely and fails every DB-touching test with `DATABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` missing — not a real regression, just a reminder that the env didn't load.

Test runner: Vitest (Next 16 แนะนำอย่างเป็นทางการ)
รันด้วย npm test — เต็มชุดใช้เวลา ~2 นาที เพราะแตะ DB จริง
ระหว่างแก้ตรรกะ booking ใช้ npm run test:fast แทน (เร็วกว่ามาก
ไม่แตะ DB) แต่ก่อน commit ต้องรัน npm test เต็มชุดเสมอ
slot.engine.ts เป็น pure function
ห้าม import prisma และห้ามเรียก new Date() ข้างใน
ต้องรับ now เข้ามาเป็น parameter เพื่อให้เทสได้

เทส concurrency ต้อง bump connection_limit ใน process ของเทสเอง
DATABASE_URL ปกติมี connection_limit=1 ซึ่งทำให้ Prisma Client
คิวคำขอที่ฝั่ง client ก่อนถึง DB
-> เทส race จะผ่านแม้ไม่มีล็อกเลย (false pass)
ทุกครั้งที่เขียนเทส concurrency ใหม่ ต้องพิสูจน์ด้วยว่า
ถอดกลไกกันชนออกแล้วเทส fail จริง
(ตัวอย่างจริงที่ `modules/booking/booking.service.test.ts` —
bump `connection_limit` ผ่าน dynamic import ก่อน `lib/prisma.ts`
ถูกสร้าง, และ `createBooking`'s advisory lock ถูกปิดชั่วคราวเพื่อยืนยัน
ว่าเทสจับ overbooking ได้จริงก่อนจะกู้กลับ)

cleanup ที่พึ่ง id ใน array ในหน่วยความจำจะพังทุกครั้งที่ process ถูกฆ่า
กลางคัน (Ctrl+C, timeout, crash) ต้องมี beforeAll ที่ล้างจาก marker คงที่
ด้วยเสมอ ไม่ใช่พึ่ง afterAll อย่างเดียว และ marker ต้องแยกต่อไฟล์ เพราะ
Vitest รันไฟล์เทสแบบขนานเป็นค่าเริ่มต้น — marker เดียวกันข้ามไฟล์ทำให้ไฟล์
ที่เริ่มทีหลังลบข้อมูลของไฟล์ที่กำลังรันอยู่ เทสพังแบบสุ่ม หาสาเหตุยากที่สุด
ในบรรดาบั๊กทั้งหมด (`restaurant.service.test.ts` ใช้ `"test:restaurant"` /
`test-restaurant.local`, `booking.service.test.ts` ใช้ `"test:booking"` /
`test-booking.local`) เคยเกิดจริง: 27 ร้านทดสอบรั่วเข้าหน้าค้นหาสาธารณะ
(`npm test` ถูกขัดจังหวะกลางคัน `afterAll` เลยไม่ได้รัน) กู้คืนด้วย
`npm run db:clean-test` (`scripts/clean-test-data.ts` — รายงานจำนวนที่จะ
ลบแล้วรอพิมพ์ "yes" ก่อนเสมอ ปฏิเสธรันถ้า `NODE_ENV=production`) ตั้งใจไม่ให้
เป็น pretest hook อัตโนมัติ เพราะการลบข้อมูลโดยไม่มีใครสั่งเสี่ยงเกินไป

สคริปต์ทุกตัวใน `scripts/` ที่เขียนข้อมูล (สร้าง/ลบ/แก้) ต้องมี guard
ปฏิเสธรันถ้า `NODE_ENV === "production"` เสมอ ไม่ว่าจะดูปลอดภัยแค่ไหนก็ตาม
— `scripts/seed-demo.ts` สร้าง profile ที่ไม่มี auth user จริงใน Supabase
(ดู "การตัดสินใจสถาปัตยกรรม" ข้อ 3 — ปกติ `Profile.id` ต้องตรงกับ
`auth.users.id` เสมอ) ถ้าเผลอรันบน production จะได้ผู้ใช้ผีที่ล็อกอินไม่ได้
ปนอยู่จริงในฐานข้อมูลจริง `scripts/clean-test-data.ts` (ด้านบน) มี guard นี้
ตั้งแต่สร้าง ส่วน `seed-demo.ts` เพิ่มทีหลัง — เช็คทุกครั้งที่เพิ่มสคริปต์ใหม่
ใน `scripts/`

`server-only` ไม่มีอยู่จริงใน node_modules — Next.js alias ให้เองตอน
build/dev เท่านั้น (ผ่าน "react-server" export condition) Vitest ไม่มี
alias นี้ ต้อง alias เฉพาะใน `vitest.config.ts` ไปที่
`vitest-server-only-stub.ts` เท่านั้น — ห้ามใส่ alias นี้ใน
`next.config.ts` หรือ `tsconfig.json` เด็ดขาด ไม่งั้น guard ตัวจริง
(กันไฟล์อย่าง `lib/supabase/admin.ts` หลุดเข้า client bundle) จะไม่ทำงานอีกเลย

`lib/datetime.ts`:
- `BANGKOK_UTC_OFFSET_MINUTES` เป็นค่าคงที่ +7 ใช้ได้เพราะไทยไม่มี DST
  ถ้าวันหนึ่งรองรับร้านนอกประเทศไทย ต้องรื้อ `lib/datetime.ts` ใหม่ทั้งไฟล์
- `slot.engine.ts`'s `settings`: `capacityPerSlot` / `minLeadHours` / `advanceDays`
  ติดลบ ไม่ทำให้ engine พัง (ไม่ hang, ไม่ throw) แต่ให้ผลลัพธ์ไร้สาระ
  (capacity ติดลบ, lead-time เป็น no-op, advanceDays บล็อกทุกวัน)
  ต้อง validate ค่าพวกนี้ที่ฟอร์มตั้งค่าร้าน (Task 7) — engine เองไม่กัน

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

   **การตัดสินสิทธิ์ต่อ resource ต้องใช้ความสัมพันธ์จริง
   (`customerId` / `ownerId`) ไม่ใช่ `actor.role`
   role ใช้ได้เฉพาะสิทธิ์ระดับระบบ (admin) เท่านั้น
   เพราะ role ในระบบนี้เป็น monotonic — customer เลื่อนเป็น owner
   แล้วกลับไม่ได้ ถ้าใช้ role ตัดสินจะกันคนออกจากสิ่งที่เขาควรทำได้**
   (ตัวอย่างจริงที่เจอ: `changeBookingStatus` เดิม branch ด้วย `actor.role`
   ทำให้ owner ยกเลิก booking ของตัวเอง (ในฐานะลูกค้าไปกินร้านอื่น) ไม่ได้เลย
   แก้เป็น `isBookingOwner`/`isRestaurantOwner` แล้ว union สิทธิ์ — ดู
   `modules/booking/booking.service.ts` เป็นตัวอย่าง pattern ที่ถูกต้อง)

5. ขยาย `lib/dal.ts` ห้ามสร้าง `lib/auth.ts` แยก
   ต้องมีจุดตรวจสิทธิ์จุดเดียวในโปรเจกต์

6. Route: `/dashboard` = หน้ากลางทุก role
          `/owner/*`   = หน้าเจ้าของร้าน
          `/admin/*`   = หน้าแอดมิน

7. `proxy.ts` คือ auth guard (ไม่ใช่ `middleware.ts`)
   เช็คแค่ login แล้วหรือยัง ไม่เช็ค role
   ความปลอดภัยจริงอยู่ที่ `requireRole` ใน `lib/dal.ts`

   proxy.ts ต้องเช็ค request.method === 'GET' ก่อน redirect
   เพราะ Server Action ยิง POST กลับไปที่ URL เดิม
   ถ้า proxy ดัก POST แล้ว redirect ธรรมดา
   client จะได้ response ที่ไม่มี header x-action-redirect
   -> An unexpected response was received from the server
   proxy เป็นแค่ UX guard ตอน navigate ไม่ใช่ตัวบังคับสิทธิ์
   (บั๊กจริงที่เจอ: ผู้ใช้ที่ login ค้างอยู่แล้วกด submit ที่ `/signup`
   — proxy เห็น `user` มีค่าแล้ว redirect POST ของ signup action
   ทิ้งไปที่ `/dashboard` ทันที ก่อน action จะได้รันเลยด้วยซ้ำ
   ดู `lib/supabase/proxy.ts`'s `isNavigation` guard)

8. กันจองเกินที่นั่งด้วย `pg_advisory_xact_lock` (2-key) เท่านั้น
   ห้ามใช้ `pg_advisory_lock` (session-scoped)
   เหตุผล: `DATABASE_URL` วิ่งผ่าน Supabase PgBouncer แบบ transaction pooling
   ซึ่งสลับ physical connection ทุก transaction ไม่ใช่ทุก session
   ถ้าใช้ lock แบบ session-scoped, unlock อาจไปออกที่ connection คนละตัว
   กับตอน lock — Postgres ปลด session lock ได้เฉพาะบน connection เดิมที่ถือมันไว้
   เท่านั้น เท่ากับ lock ค้างถาวรจนกว่า connection นั้นจะหลุด
   (สุดท้ายรอบที่มันคุมจะ "เต็ม" ค้างตลอดไป)
   `_xact_` variant ปลดเองตอน COMMIT/ROLLBACK บน connection เดียวกัน จึงไม่ค้าง
   ดูโค้ดจริงที่ `modules/booking/booking.service.ts` (`createBooking`
   และ `changeBookingStatus` — สอง function ต้องคำนวณ lock key ตรงกันเป๊ะ
   สำหรับ booking เดียวกัน ใช้ helper `bookingLockKey` ร่วมกัน ห้าม inline
   string ซ้ำที่จุดใดจุดหนึ่งเฉย ๆ เพราะจะเสี่ยง key ไม่ตรงกันแล้ว lock ไม่ล็อกจริง)
   พอถือ advisory lock แล้ว ห้ามใส่ `FOR UPDATE` ซ้อนบน `bookings` อีก —
   lock ตัวเดียวคุม writer ทุกตัวของ slot นั้นอยู่แล้ว

9. **ธีมสี = ครีมทอง พื้นสว่างเท่านั้น ปิด dark mode โดยตั้งใจ ไม่ใช่ลืมทำ**
   โทเคนสีทั้งหมดกำหนดที่ `app/globals.css` (`@theme inline` + `:root`
   — Tailwind v4, ไม่มี `tailwind.config.ts`) แล้ว remap ทับตัวแปรของ
   shadcn เดิม (`--background`/`--primary`/`--border`/...) ไปที่โทเคนใหม่
   เพื่อให้คอมโพเนนต์ shadcn ที่มีอยู่ (`Button`, `Input`, `Card`, `Badge`)
   ได้ธีมใหม่ทันทีโดยไม่ต้องแก้โค้ดคอมโพเนนต์เอง:

   พื้นผิว: `canvas` `surface` `raised`
   ตัวอักษร: `ink` `ink-soft` `ink-mute` (ห้ามใช้สีดำสนิทกับตัวอักษร)
   แบรนด์: `gold` `gold-dim` `sun` `sky` `tangerine`
   สถานะ: `ok` `warn` `bad` (ความหมายตายตัว ห้ามเปลี่ยนเป็นโทนทอง)

   ห้าม hardcode hex ในคอมโพเนนต์ — ใช้ class เช่น `bg-canvas`
   `text-ink-soft` `border-gold-dim` `text-ok` เสมอ

   `@custom-variant dark (&:is(.dark *));` ยังอยู่ใน `globals.css` โดยตั้งใจ
   (ไม่ใช่ค้าง) — มันผูก `dark:` ไว้กับ class `.dark` เท่านั้น ไม่ใช่
   `prefers-color-scheme` และไม่มีจุดไหนในแอปเติม `.dark` ให้ `<html>` เลย
   ผลคือ `dark:*` utility (ที่ยังเหลืออยู่ในคอมโพเนนต์ shadcn เดิมอย่าง
   `button.tsx`/`input.tsx`/`badge.tsx`) จะไม่มีวันทำงาน ไม่ว่า OS ผู้ใช้จะ
   ตั้งเป็น dark theme หรือไม่ก็ตาม — บล็อก `.dark { ... }` ตัวแปรสีเดิม (เทา
   ล้วน) ถูกลบออกจาก `globals.css` แล้วเพราะเป็น dead code ที่ไม่มีทาง
   reachable ได้อีก ถ้าจะเปิด dark mode จริงในอนาคตต้องออกแบบชุดสีมืดใหม่
   ทั้งชุดที่ยังคุมความหมายของสถานะ (ok/warn/bad) ไว้เหมือนเดิม ไม่ใช่แค่
   เอาบล็อกเก่ากลับมา

   `BOOKING_STATUS_LABELS_TH` (`constants/messages.ts`) ใช้ทั้งฝั่ง backend
   (ข้อความ error) และต้องมีสีคู่กันฝั่ง UI — แยกเป็นคนละ map
   (`BOOKING_STATUS_COLORS`) ไม่รวมเข้าด้วยกัน เพราะ `booking.service.ts`
   import `BOOKING_STATUS_LABELS_TH` มาใช้เป็น string ตรง ๆ ใน
   `invalidTransition(...)` อยู่แล้ว ถ้าเปลี่ยนรูปร่างเป็น object จะพังจุดนั้น

10. **Confirm email**: signup flow ตัดสินจากผลลัพธ์ signUp ว่าได้ session ไหม
    ไม่ใช่จาก config ทำให้ทำงานถูกทั้งตอน Confirm email
    เปิดและปิด ไม่ต้องแก้โค้ดตอน deploy
    (`authService.signUp` คืน `hasSession: data.session !== null` จากผลลัพธ์
    `supabase.auth.signUp()` จริงของคำขอนั้น — ไม่ได้เดาจาก env/project setting
    `app/signup/actions.ts` เช็คค่านี้: ได้ session -> `redirect("/dashboard")`
    ทันที (นอก try/catch เสมอ เพราะ redirect ทำงานด้วยการ throw
    `NEXT_REDIRECT`), ไม่ได้ session -> โชว์ข้อความให้ไปยืนยันอีเมล
    ปัจจุบัน (2026-08-16) โปรเจกต์นี้ปิด Confirm email ไว้ที่ Supabase
    Dashboard สมัครเสร็จจะได้ session ทันทีและ redirect ไป dashboard เลย)

11. **แก้เวลาทำการ/ลดที่นั่งที่กระทบการจองเดิม — เตือนแล้วให้บันทึกต่อได้
    ไม่บล็อกและไม่ยกเลิกอัตโนมัติ** (Task 7 เฟส 1 รอบ 2 — ผู้ใช้ตัดสิน)
    `PUT /api/restaurants/[id]/hours` และ `PUT /api/restaurants/[id]/settings`
    ก่อนบันทึกจริงจะเช็คก่อนว่าการจองในอนาคตที่ยังไม่ resolve
    (`SEAT_CONSUMING_STATUSES`: PENDING/CONFIRMED/CHECKED_IN) รายการไหนจะ
    ขัดกับค่าใหม่บ้าง — เวลาทำการใหม่ทำให้ slotTime เดิมตกนอกช่วงเปิด
    (หรือวันนั้นเพิ่งถูกปิด), หรือผลรวม partySize ต่อรอบเกิน
    capacityPerSlot ใหม่, หรือ partySize ของรายการใดเกิน maxPartySize ใหม่
    ถ้าเจอและ request ไม่ได้ส่ง `confirm: true` มา จะไม่บันทึกอะไรเลย
    ตอบกลับ error code `CONFIRMATION_REQUIRED` (409) พร้อมจำนวนรายการที่
    กระทบในข้อความ ฝั่ง client (ดู `app/owner/settings/owner-settings-form.tsx`)
    ต้องเปิด dialog ให้เจ้าของร้านยืนยันแล้วส่งซ้ำพร้อม `confirm: true`
    ถึงจะบันทึกจริง ไม่ว่ากรณีไหนการจองเดิมจะไม่ถูกยกเลิกหรือแก้ไขเอง
    เหตุผล: เจ้าของร้านมีสิทธิ์ตัดสินใจเรื่องร้านตัวเอง ระบบมีหน้าที่แค่
    เตือนให้รู้ตัวก่อนพลาด ไม่ใช่ตัดสินใจแทนหรือไปแตะข้อมูลการจองที่ลูกค้า
    ทำไว้แล้วเฉยๆ ดู `countBookingsConflictingWithHours`/
    `countBookingsConflictingWithSettings` ใน
    `modules/restaurant/restaurant.service.ts`

    ตัวเลขในคำเตือน CONFIRMATION_REQUIRED เป็น snapshot
    ตอนตรวจครั้งแรก ไม่นับใหม่ตอน confirm
    ตั้งใจให้เป็นแบบนี้ เพราะการนับใหม่แล้วเตือนซ้ำ
    จะวนไม่รู้จบถ้ามีคนจองเข้ามาเรื่อย ๆ
    ตัวเลขนี้เป็นข้อมูลประกอบการตัดสินใจ ไม่ใช่ตัวบล็อก
    ไม่มีความเสียหายต่อข้อมูล การจองเดิมไม่ถูกแตะต้อง

12. **CANCELLED เกิดได้จาก 2 ทาง: ลูกค้ายกเลิกเอง หรือเจ้าของร้านยกเลิกแทน
    (ลูกค้าโทรมาแจ้ง)** แยกได้จาก statusReason ที่บังคับใส่เฉพาะฝั่ง
    เจ้าของร้าน ถ้าวันหนึ่งต้องการสถิติแยกชัดเจน ต้องเพิ่มคอลัมน์
    cancelledBy ผ่าน migration (Task 7 เฟส 2 รอบ 2 — ผู้ใช้ตัดสิน)
    `OWNER_ALLOWED_TARGET_STATUSES` (`modules/booking/booking.state.ts`)
    มี CANCELLED อยู่ด้วยแล้ว — `changeBookingStatus`
    (`modules/booking/booking.service.ts`) บังคับ `reason` เมื่อ CANCELLED
    ถูกสั่งโดย `isRestaurantOwner && !isBookingOwner` เท่านั้น (เจ้าของร้าน
    ที่ไม่ใช่เจ้าของ booking เอง) — ไม่ใช่แค่ "ไม่ใช่เจ้าของ booking" เฉยๆ
    เพราะ owner ที่จองร้านตัวเองก็เป็นทั้งสองอย่างพร้อมกัน กรณีนั้นยังนับเป็น
    self-cancel เหมือนเดิม (reason optional) และแอดมินก็ไม่ถูกบังคับด้วย
    (แอดมินมีสิทธิ์ไม่ผูกกับความสัมพันธ์อยู่แล้ว ไม่ได้ถูกสั่งให้ต้องใส่
    reason เพิ่ม) deadline `minLeadHours` ผูกกับ `isBookingOwner` เท่านั้น
    (ไม่ใช่ role) จึงใช้กับแค่ลูกค้ายกเลิกเอง เจ้าของร้าน/แอดมินยกเลิกแทน
    ไม่ติด deadline นี้อยู่แล้วโดยไม่ต้องแก้อะไร

13. ห้ามใช้ `useState(propจาก server)` แล้วหวังว่าจะ sync เอง
    ตอน client-side navigation Next.js ไม่ remount component
    ค่า state จะค้างเป็นชุดเก่าโดยไม่มี error
    ให้ใช้ prop ตรง ๆ หรือ key prop ให้ remount แทน
    (พบจริงที่ `/owner/dashboard` — เปลี่ยนร้าน/วันที่ผ่าน `?restaurantId=`
    /`?date=` เป็น search-param-only navigation บน path เดิม ไม่ remount
    component ตัวเลขสรุปค้างเป็นของร้าน/วันที่ก่อนหน้า ยืนยันด้วย Next 16
    docs เอง — `router.bfcacheId` "stays the same for ... search-param- or
    hash-only navigations" และแนะนำ "prefer resetting state explicitly ...
    or deriving a key from your data" ไม่ใช่พึ่ง `bfcacheId`
    แก้แล้วที่ `app/owner/dashboard/dashboard-view.tsx` (อ่าน
    `initialBookings` prop ตรง ๆ ไม่มี `useState` คัดลอกอีก, action ที่แก้ไข
    ข้อมูลจริงเรียก `router.refresh()` แทนการ patch state เอง) และ
    `app/owner/settings/page.tsx` (`<OwnerSettingsForm key={restaurant.id}>`
    — หน้านี้ฟอร์มมีการแก้ไขจริงฝั่ง client เลยต้องใช้ key ให้ remount แทน
    การอ่าน prop ตรง ๆ อย่างเดียว)
    ที่ตรวจแล้วไม่ติดปัญหานี้: `/restaurants` (client-owned filter+fetch
    ทั้งหน้า ไม่มี state คัดลอกจาก prop เลย), `/bookings/my` (ไม่มี query
    param ที่เปลี่ยนได้ระหว่างอยู่หน้าเดิม แท็บเป็น client UI state ล้วน),
    `/owner/status` (ไม่มี client component ไหนคัดลอกข้อมูลร้านลง state)

    `app/restaurants/[id]/booking-box.tsx` ก็มี `useState`/`useEffect` ที่ไม่
    list `restaurantId` ใน dependency คล้ายรูปแบบเดียวกัน แต่**ทดสอบจริงแล้ว
    ปลอดภัย** (ไม่ใช่แค่วิเคราะห์เฉยๆ): เปิด `/restaurants` กดลิงก์เข้าร้าน 1
    (เปิด 10:00-22:00 capacity 10) เลือกวันพรุ่งนี้เห็นรอบ 10:00-21:00
    "เหลือ 10 ที่" ครบ แล้วกดลิงก์ "ค้นหาร้าน" กลับไปหน้า `/restaurants`
    กดลิงก์เข้าร้าน 2 (เปิด 18:00-02:00 capacity 6) — รอบเวลาที่ขึ้นเปลี่ยน
    เป็นของร้าน 2 จริงทันที (23:00-01:00 "เหลือ 6 ที่" ไม่ใช่ค้างของร้าน 1)
    กด back 2 ครั้งกลับไปร้าน 1 เห็นข้อมูลร้าน 1 ถูกต้อง (รีเซ็ตกลับเป็น
    "วันนี้" ด้วย ไม่ค้างที่วันพรุ่งนี้ที่เคยเลือกไว้ — mount ใหม่จริง) กด
    forward 2 ครั้งกลับไปร้าน 2 เห็นข้อมูลร้าน 2 ถูกต้องเหมือนเดิม
    เหตุผลที่ต่างจาก `/owner/dashboard`: `[id]` เป็น dynamic route segment
    (ส่วนหนึ่งของ path) ไม่ใช่ search param — Next.js remount component ใหม่
    เมื่อค่า segment เปลี่ยน (ต่างจาก search-param-only navigation บน path
    เดิมที่ไม่ remount) จึงไม่มีทาง state ค้างข้ามร้านได้ — ไม่ต้องแก้

14. **กันกดซ้ำต้องใช้ `useRef` ไม่ใช่ `useState`** เพราะ state อัปเดต
    หลัง re-render เท่านั้น — สอง click event ที่เกิดในทิกเดียวกัน (native
    `.click()` สองครั้งติดกัน ไม่ใช่แค่คลิกเร็ว ๆ ด้วยนิ้ว) ทั้งคู่จะยังอ่านค่า
    state ตัวเก่าจาก closure ก่อน re-render ทัน ทำให้ `if (saving) return;`
    (หรือชื่อตัวแปรอะไรก็ตามที่เป็น `useState`) ปล่อยผ่านทั้งสอง handler
    ต้องเช็ค+ตั้งค่า `useRef` (sync ทันที ไม่รอ re-render) แทน หรือควบคู่กับ
    state (state ยังไว้ใช้ disable ปุ่มใน UI ได้ปกติ)

    พิสูจน์ด้วย Playwright: `element.evaluate(el => { el.click(); el.click(); })`
    ยิง native click สองครั้งในทิกเดียวกันจริง ๆ — **การคลิกเร็ว ๆ ผ่าน UI
    ปกติ หรือ Playwright `.click()` สองครั้งแยกกัน (เช่น
    `Promise.all([locator.click(), locator.click({force:true})])`) จับบั๊กนี้
    ไม่ได้** เพราะ actionability-wait ของ `.click()` ปกติกินเวลานานพอให้
    request แรก round-trip เสร็จและรีเซ็ต guard ก่อนคลิกที่สองจะไปถึงจริง
    ต้องใช้ native `.click()` สองครั้งในการเรียกเดียว (หรือเทียบเท่า) เท่านั้น

    เจอจริงที่ปุ่ม "ยืนยันการจอง" (`app/restaurants/[id]/booking-box.tsx`)
    — กดซ้ำในทิกเดียวสร้าง booking จริง 2 รายการแยกกันใน DB (customer/ร้าน/
    วันที่/รอบเวลาเดียวกัน ห่างกัน ~700ms คนละ `id`/`code`) ไม่ใช่แค่ UI โชว์ผิด
    เพราะ `pg_advisory_xact_lock` กันแค่จองเกินที่นั่งรวม ไม่ได้กันคนเดียวกัน
    ส่งซ้ำ 2 คำขอ แก้แล้วด้วย `submittingRef` ทดสอบซ้ำหลังแก้ยืนยันเหลือ
    1 request/1 booking จริง

    แก้ไปแล้วทุกจุดที่กันกดซ้ำด้วย state ในโปรเจกต์ (ไล่ grep ทั้งโปรเจกต์
    แล้ว): `app/restaurants/[id]/booking-box.tsx`,
    `app/owner/dashboard/dashboard-view.tsx`,
    `app/owner/settings/owner-settings-form.tsx` (ทั้ง 3 แท็บ),
    `app/owner/register/register-form.tsx`,
    `app/bookings/my/my-bookings-view.tsx`,
    `app/owner/status/resubmit-button.tsx`,
    `app/admin/admin-user-table.tsx` (ใช้ `useTransition` เดิม ไม่มี guard
    เลยนอกจาก `disabled={isPending}` — เพิ่ม ref guard ให้ด้วยเพื่อความ
    สม่ำเสมอ), `app/admin/restaurants/[id]/review-actions.tsx` (จุดที่เจอ
    บั๊กนี้ครั้งแรก)

15. **วันที่ในหน้าแอดมิน (`/admin/restaurants`, `/admin/restaurants/[id]`)
    แสดงเป็น ค.ศ. ไม่ใช่ พ.ศ.** ทั้งที่ข้อความไทยอื่นในแอปเป็นภาษาไทยทั้งหมด
    — ตั้งใจ ไม่ใช่ลืมแปลง เพราะ DB (`createdAt`/`reviewedAt`) และ seed data
    เก็บ/อ้างอิงเป็น ค.ศ. ล้วน ถ้าจอแสดง พ.ศ. (เช่น 2569) แต่ Prisma Studio/
    log/DB query โชว์ ค.ศ. (2026) จะสับสนตอน debug ว่าตัวเลขไหนตรงกับแถวไหน
    หน้าจออื่นในแอป (booking date) ไม่เคยโชว์ปีเลยจึงไม่มีบรรทัดฐานให้ขัดแย้ง

## ปัญหาค้างที่ยังไม่แก้

_(ตรวจกับโค้ด/DB จริงล่าสุด 2026-08-18 — ของเดิมทั้ง 6 รายการแก้ไปแล้ว
หรือย้ายไปหมวด "ข้อจำกัดที่ทราบแล้ว" ด้านล่าง รายการที่เหลืออยู่ตอนนี้
เป็นข้อเท็จจริงใหม่ที่พบระหว่างตรวจรอบนี้)_

- `authService.deleteUser` (`modules/auth/auth.service.ts`) ลบทั้ง `profiles`
  (ผ่าน Prisma) และ `auth.users` (ผ่าน `adminClient.auth.admin.deleteUser`)
  พร้อมกันแล้ว แต่ยังไม่มี route/action ไหนเรียกใช้จริง
  (grep ทั้ง `app/` เจอแค่จุด import `auth.service` สองที่ ไม่มีจุดเรียก
  `deleteUser`) — ต้องต่อเข้ากับหน้าแอดมิน (Task 8) ถ้าจะให้ลบ user ได้จริง

ทุกครั้งที่แก้ปัญหาในลิสต์นี้ ต้องลบรายการออกทันที
เอกสารที่ผิดอันตรายกว่าไม่มีเอกสาร
เพราะทำให้ไปแก้ปัญหาที่ไม่มีอยู่จริง

## ข้อจำกัดที่ทราบแล้ว

- `Profile` ไม่มี FK ไป `auth.users` — ตั้งใจแบบนี้ถาวร ไม่ใช่ของค้างที่จะมาแก้
  ทีหลัง เพราะ Project rules ข้อ 2 ห้าม Prisma แตะ schema `auth` ของ Supabase
  เด็ดขาด ผลคือการลบ user ต้องลบสองที่แยกกันเสมอผ่านโค้ดแอป (ดูฟังก์ชัน
  `deleteUser` ในหมวด "ปัญหาค้างที่ยังไม่แก้" ด้านบน) ไม่มีทางใช้
  `ON DELETE CASCADE` ระดับ DB ได้
- `updated_at` อัปเดตเฉพาะเมื่อแก้ผ่าน Prisma — `@updatedAt` ใน
  `prisma/schema.prisma` เป็นกลไกฝั่ง Prisma client (คำนวณค่าแล้วส่งเป็นส่วน
  หนึ่งของ UPDATE statement) ไม่ใช่ DB trigger ยืนยันแล้วว่า DB จริงไม่มี
  trigger/function ใดแตะคอลัมน์นี้เลย แก้ผ่าน SQL ตรง ๆ (เช่น Supabase SQL
  Editor) จะไม่ขยับค่านี้ ถ้าต้องการรับประกันระดับ DB ต้องเพิ่ม trigger เอง
  ใน `supabase/rls-and-triggers.sql`
- backend ไม่กันการจองซ้ำของ customer เดียวกัน ในร้าน/วัน/รอบเดียวกัน —
  ตั้งใจ เพราะกลุ่มใหญ่เกิน maxPartySize อาจต้องแยกจองหลายโต๊ะในรอบเดียวกัน
  ซึ่งเป็นการใช้งานที่ถูกต้อง การกดซ้ำโดยไม่ตั้งใจกันด้วย ref guard ฝั่ง
  client แล้ว (การตัดสินใจสถาปัตยกรรม ข้อ 14) ถ้าวันหนึ่งอยากกัน ให้ใช้ pattern
  CONFIRMATION_REQUIRED เตือนแล้วให้ยืนยันซ้ำ ไม่ใช่บล็อกเงียบ ๆ

## Architecture

TableNow — an online restaurant table-booking / queue system. Next.js App Router project (`next@16.3.0`, React 19) with Supabase-backed auth, a role-gated admin area, and shadcn/ui for components.

- `app/layout.tsx` — root layout; loads Geist Sans/Mono via `next/font/google` and renders `SiteHeader`.
- `app/globals.css` — Tailwind CSS v4 (via `@tailwindcss/postcss`, no `tailwind.config.*` — v4 is configured through CSS).
- Path alias `@/*` maps to the repo root (`tsconfig.json`).

**Target architecture** (see "Project rules" below) moves app data access from direct Supabase table calls onto Prisma + a `modules/` service layer, and expands the role model from two roles to three (`CUSTOMER`, `OWNER`, `ADMIN`). The database side of this is done — Prisma owns the schema (see "Database" below) and the DB enum already has all three roles — but the application code hasn't caught up: `modules/` is still empty, `lib/dal.ts` still uses the old 2-role type and reads `profiles` via the Supabase client rather than Prisma. Treat the rest of this section as the current implementation, and the rules section as the direction new work should take it.

### Auth (Supabase SSR via `@supabase/ssr`)

- `lib/supabase/client.ts` / `lib/supabase/server.ts` — browser vs. server Supabase clients; the server client reads/writes auth cookies via `next/headers`.
- `proxy.ts` (root) + `lib/supabase/proxy.ts` — Next 16 renamed `middleware.ts` to `proxy.ts` (`node_modules/next/dist/docs/.../file-conventions/proxy.md`). `updateSession()` refreshes the session on every request and redirects unauthenticated users away from `/dashboard` and `/admin`, and authenticated users away from `/login`/`/signup`. It only checks *authentication*, not role — update `PROTECTED_PREFIXES`/`AUTH_PATHS` here when adding new gated routes.
- `lib/dal.ts` — data-access layer; `getUser()` (cached, nullable) and `getProfile()` (cached, redirects to `/login` if no profile row) are the entry points for the current user and their role. Prefer these over calling Supabase directly for user/role lookups. **Currently `Role = "user" | "admin"`** — the project rules below call for `CUSTOMER | OWNER | ADMIN`; migrating this type and the `profiles.role` values is pending work, not yet done.
- Server actions: `app/actions.ts` (`logout`), `app/login/actions.ts` (`login`), `app/signup/actions.ts` (`signup`), `app/admin/actions.ts` (`setUserRole`). `setUserRole` re-checks `getProfile().role === "admin"` itself — role authorization for admin mutations happens at the action, not the proxy.

### Database

Prisma owns the schema. `prisma/schema.prisma` defines 3 enums (`Role`→`user_role`, `RestaurantStatus`→`restaurant_status`, `BookingStatus`→`booking_status`) and 6 models (`Profile`→`profiles`, `Restaurant`→`restaurants`, `Booking`→`bookings`, `OpeningHour`→`opening_hours`, `BookingSetting`→`booking_settings`, `Closure`→`closures`), all mapped to snake_case tables/columns via `@@map`/`@map`. Migrations `prisma/migrations/20260812103854_init` and `20260815145650_add_booking_status_reason` (`Booking.statusReason`) are applied to the live DB.

`supabase/rls-and-triggers.sql` holds what Prisma can't express: SELECT-only RLS policies (see the file's header comment for why writes are deliberately not covered — all writes go through API routes + Prisma, which bypasses RLS), the `auth_user_role()` security-definer helper, and the `protect_profile_role`/`protect_restaurant_approval` triggers. Re-apply it in full (Supabase SQL Editor or `psql "$DIRECT_URL" -f supabase/rls-and-triggers.sql`) after any migration that changes table shape. **As of the last migration it had been written but not yet applied** — until it is, every table has RLS enabled with zero policies (Supabase's project default), i.e. deny-all even for `SELECT`.

Auth needs `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`; Prisma needs `DATABASE_URL` (pooled) / `DIRECT_URL` (direct) — all four are in `.env.local`. `SUPABASE_SERVICE_ROLE_KEY` is still missing, needed for `lib/supabase/admin.ts` and the not-yet-written profile-creation/deletion code (see "ปัญหาค้างที่ยังไม่แก้").

### UI components

shadcn/ui is configured via `components.json`: style `base-nova` on Base UI primitives (`@base-ui/react`, not Radix), icon library `lucide-react`, path aliases `@/components`, `@/components/ui`, `@/lib`, `@/hooks`. Installed primitives live in `components/ui/*` (add more with `npx shadcn@latest add <name>`). `components/icons/icon-placeholder.tsx` is a local component, not a registry item — shadcn's own block templates use `<IconPlaceholder lucide="IconName" />` as a build-time marker the CLI swaps for a real `lucide-react` import; this project implements that same contract at runtime so pasted block snippets work without manual editing.

`@headlessui/react` and `@heroicons/react` are also installed, used by pages built from Tailwind Plus / Tailwind UI templates (which ship Headless UI + Heroicons, not Base UI/lucide) rather than from the shadcn registry. Both primitive/icon stacks coexist — match whichever a given page or pasted snippet already uses rather than converting it to the other.

The cream/gold semantic color palette (`canvas`/`surface`/`raised`, `ink`/`ink-soft`/`ink-mute`, `gold`/`gold-dim`/`sun`/`sky`/`tangerine`, `ok`/`warn`/`bad`) lives entirely in `app/globals.css` — see "การตัดสินใจสถาปัตยกรรม" item 9. Never hardcode a hex value in a component; use the `bg-*`/`text-*`/`border-*` utilities Tailwind generates from those tokens.

ห้าม render ลิงก์ผ่าน Button component ของ Base UI
ถ้าต้องการลิงก์ที่หน้าตาเป็นปุ่ม ให้ใช้
`<Link className={cn(buttonVariants({...}))}>` แทน
(ตามเอกสาร `node_modules/@base-ui/react/docs/react/components/button.md`)
— `nativeButton={false}` ใช้ได้เฉพาะ tag ที่ไม่ใช่ link (เช่น `<div>`)
เอกสารบอกตรง ๆ ว่า `<a>`/`<Link>` มี semantics ของตัวเองอยู่แล้ว
ห้ามส่งผ่าน `render` prop ของ `Button` เด็ดขาด ไม่ว่าจะตั้ง `nativeButton`
เป็นอะไรก็ตาม (บั๊กจริงที่เจอ: `<Button render={<Link .../>}>` ทำให้ Base UI
ขึ้น console error "expected a native \<button\> because nativeButton is
true" — แก้แล้วทุกจุดในโปรเจกต์ ดู `components/ui/button.tsx`'s
`buttonVariants` export เป็นตัวอย่าง)

Base UI's `Select.Value` แสดงค่า raw `value` ตรง ๆ ไม่ auto-derive label
จาก `SelectItem` ที่ตรงกันให้เหมือน Radix — ทุกครั้งที่ใช้ `Select` ต้องส่ง
function เป็น children ของ `SelectValue` เพื่อ map ค่า -> label ภาษาไทยเอง
(`{(value: string) => labelFor(value)}`) ไม่งั้นพอเลือกแล้วปิด ช่องจะโชว์
key ภายใน (เช่น `"__all__"`, `"blurry_photo"`) แทนข้อความไทยที่ตัวเลือกนั้น
แสดงตอนกางอยู่ บั๊กนี้เกิดซ้ำ 2 ครั้งแล้ว — `__all__` ที่ตัวกรองหมวดหมู่ใน
`app/restaurants/page.tsx` (แก้ตั้งแต่ Task 6) และ `blurry_photo` ที่ dialog
ปฏิเสธร้านใน `app/admin/restaurants/[id]/review-actions.tsx` (Task 8)
จุดที่ใช้ `Select` ทั้งโปรเจกต์ (grep `SelectValue` แล้ว) มี 3 จุด — อีกจุด
คือตัวกรองสถานะใน `app/admin/restaurants/status-filter.tsx` ซึ่งมี mapping
ถูกต้องอยู่แล้วตั้งแต่สร้าง

## Target folder structure

No `src/`. `modules/`, `types/`, `constants/` exist but are still empty — no business-logic files have been written yet.

```
app/           pages + API routes
components/    ui/ (shadcn) + app-specific components
lib/           prisma.ts, supabase/, api-response.ts, dal.ts, utils.ts
modules/       business logic, one subtree per feature   ← empty, not yet used
types/                                                    ← empty, not yet used
constants/                                                ← empty, not yet used
prisma/        schema.prisma, migrations/20260812103854_init
supabase/      rls-and-triggers.sql — RLS policies / security-definer functions / triggers only
```

Import everything via the `@/` alias, e.g. `@/lib/prisma`, `@/modules/booking/booking.service`.

## Project rules

These govern all new work in this repo, independent of what's already implemented:

1. **Prisma owns the schema.** Never change tables via the Supabase Dashboard. `supabase/rls-and-triggers.sql` is for RLS policies and database functions only.
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
