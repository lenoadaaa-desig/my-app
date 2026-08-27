# TableNow

TableNow เป็นเว็บแอประบบจองโต๊ะร้านอาหาร รองรับ 3 บทบาท — ลูกค้าค้นหาร้านและจองโต๊ะ, เจ้าของร้านสมัครร้านและจัดการการจองของตัวเอง, แอดมินอนุมัติร้านและดูแลผู้ใช้ทั้งระบบ สร้างด้วย Next.js App Router, Prisma และ Supabase (auth + hosting)

## ฟีเจอร์หลัก

**ลูกค้า**
- ค้นหา/กรองร้านอาหารตามหมวดหมู่ (`/restaurants`)
- ดูรายละเอียดร้าน เลือกวันและรอบเวลาที่ว่าง แล้วจองโต๊ะ (`/restaurants/[id]`)
- ดูประวัติการจองของตัวเอง ยกเลิกการจองได้ภายใน deadline ที่กำหนด (`/bookings/my`)

**เจ้าของร้าน**
- สมัครร้านใหม่ รอแอดมินอนุมัติ (`/owner/register`, `/owner/status`)
- ตั้งเวลาทำการ, จำนวนที่นั่งต่อรอบ, ขนาดกลุ่มสูงสุด — พร้อมเตือนก่อนบันทึกถ้ากระทบการจองเดิม (`/owner/settings`)
- แดชบอร์ดจัดการการจองรายวันของร้านตัวเอง (`/owner/dashboard`)

**แอดมิน**
- อนุมัติ/ปฏิเสธร้านที่สมัครเข้ามา (`/admin/restaurants`)
- ค้นหา จัดการ role และลบผู้ใช้ในระบบ (`/admin`)

ทุกบทบาทแชร์หน้า `/dashboard` เป็นหน้ากลางหลัง login

## Tech stack

| | เวอร์ชันที่ pin ไว้ |
|---|---|
| Next.js (App Router, Turbopack) | `16.3.0` |
| React / React DOM | `19.2.8` |
| Prisma / `@prisma/client` | `6.19.3` (**ห้ามอัปเป็น 7** — ดู "ข้อควรระวัง") |
| Supabase (`@supabase/ssr` + `@supabase/supabase-js`) | `^0.12.4` / `^2.112.3` |
| Zod | `^4.4.3` |
| Tailwind CSS | `v4` (config ผ่าน CSS ล้วน ไม่มี `tailwind.config.ts`) |
| shadcn/ui บน Base UI primitives (`@base-ui/react`) | `^4.16.2` |
| Vitest | `^4.1.10` |

ดูเวอร์ชันทั้งหมดใน `package.json`

## เริ่มต้นใช้งาน (ตั้งแต่ clone จนเปิดเว็บได้)

### 1. ติดตั้ง dependencies

```bash
git clone <repo-url>
cd my-app
npm install
```

### 2. ตั้งค่า environment variables

คัดลอก `.env.example` เป็น `.env.local` แล้วกรอกค่าจริงจาก Supabase Dashboard (Project Settings → API / Database):

```bash
cp .env.example .env.local
```

ตัวแปรที่ต้องตั้ง (ชื่อเท่านั้น ดูตัวอย่างรูปแบบใน `.env.example`):

| ตัวแปร | ใช้ที่ไหน |
|---|---|
| `DATABASE_URL` | Prisma runtime — pooled connection (PgBouncer, port 6543) |
| `DIRECT_URL` | Prisma migrate — direct connection (port 5432) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase client ฝั่ง browser และ server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client ฝั่ง browser และ server |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase/admin.ts` — สร้าง/ลบ auth user, เปลี่ยน role (**ห้าม commit ห้ามส่งให้ client**) |

env มีแหล่งเดียวคือ `.env.local` — ห้ามสร้าง `.env` แยก Prisma CLI อ่าน `.env.local` เองไม่ได้ ทุกคำสั่งที่แตะ DB ต้องผ่าน `npm run db:*` (ผูก `dotenv-cli` ไว้ให้แล้ว) ห้ามรัน `npx prisma`/`npx vitest` ตรง ๆ

### 3. ตั้งค่าฐานข้อมูล — ต้องทำตามลำดับนี้เท่านั้น

**3.1 Apply migrations** (สร้างตาราง/enum ทั้งหมดที่ Prisma คุม):

```bash
npx dotenv -e .env.local -- prisma migrate deploy
```

**3.2 Apply RLS policies + triggers** (สิ่งที่ Prisma คุมไม่ได้ — ถ้าข้ามขั้นนี้ ทุกตารางจะ deny-all แม้แต่ `SELECT`):

```bash
psql "$DIRECT_URL" -f supabase/rls-and-triggers.sql
```

(หรือรัน SQL ในไฟล์นี้ผ่าน Supabase SQL Editor แทนก็ได้)

**3.3 Seed ข้อมูลตัวอย่าง** (ทำหลังสองขั้นตอนบนเท่านั้น):

```bash
npm run seed:demo
```

สร้างร้านตัวอย่าง 3 ร้านพร้อม opening hours/booking settings ให้พร้อมทดสอบทันที

### 4. รัน dev server

```bash
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000)

## npm scripts ทั้งหมด

| คำสั่ง | ใช้ตอนไหน |
|---|---|
| `npm run dev` | รัน dev server (Turbopack, port 3000) |
| `npm run build` | production build — **ห้ามรันขณะ `npm run dev` กำลังทำงานอยู่** (ดู "ข้อควรระวัง") |
| `npm run start` | เสิร์ฟ production build ที่ build ไว้แล้ว |
| `npm run lint` | ESLint (flat config ผ่าน `eslint-config-next`) |
| `npm run db:generate` | regenerate Prisma client หลังแก้ `schema.prisma` |
| `npm run db:migrate -- --name <name>` | สร้าง dev migration ใหม่ (interactive — ใช้ตอนพัฒนาบนเครื่องตัวเอง) |
| `npm run db:push` | มีอยู่ใน `package.json` แต่**ห้ามใช้ในโปรเจกต์นี้** — จะ sync schema ตรงโดยข้ามการสร้างไฟล์ migration ทำให้ `prisma/migrations/` ไม่ตรงกับ schema จริงอีกต่อไป ใช้ `db:migrate` เสมอ |
| `npm run db:pull` | introspect DB จริง (`-- --print` เพื่อเทียบโดยไม่ทับ `schema.prisma`) |
| `npm run db:studio` | เปิด Prisma Studio ดู/แก้ข้อมูลผ่าน GUI |
| `npm run seed:demo` | สร้างร้านตัวอย่าง 3 ร้าน (ดูขั้นตอนที่ 3.3 ด้านบน) — มี guard ปฏิเสธรันถ้า `NODE_ENV=production` |
| `npm run db:clean-test` | ลบข้อมูลทดสอบที่ใช้ marker `test:`/`.local` ทั้งหมด — แสดง dry-run แล้วรอพิมพ์ "yes" ก่อนลบเสมอ ไม่ใช่ pretest hook อัตโนมัติ **ห้ามรันบน production** |
| `npm test` | รันเทสทั้งชุด (Vitest) — แตะ DB จริง ใช้เวลา ~2 นาที รันก่อน commit เสมอ |
| `npm run test:watch` | Vitest แบบ watch mode |
| `npm run test:fast` | รันเฉพาะ `slot.engine.test.ts` + `booking.state.test.ts` (pure function, ไม่แตะ DB) — ใช้ระหว่างแก้ตรรกะ booking เพื่อความเร็ว ไม่ใช่ตัวแทน `npm test` เต็มชุด |

## สิ่งที่จะทำให้พัง — ห้ามทำ

- **ห้ามอัป Prisma เป็น 7** — Prisma 7 ตัด `directUrl` ซึ่งจำเป็นสำหรับ Supabase (pooled 6543 ตอน runtime + direct 5432 ตอน migrate)
- **ห้ามรัน `prisma migrate reset`** — จะ `DROP SCHEMA public` ทำให้ GRANT ของ Supabase (`anon`/`authenticated`/`service_role`) หายไปทั้งหมด ถ้าต้องล้าง DB ให้ลบตารางเจาะจงด้วย SQL แทน
- **ห้ามรัน `npm run build` ขณะ `npm run dev` กำลังทำงานอยู่** — ทั้งสองคำสั่งเขียน `.next/` คนละชุดแต่ใช้โฟลเดอร์ร่วมกัน ทำให้ dev server เสิร์ฟ manifest/RSC payload ปนกันคนละรุ่น (บางส่วนของหน้าแสดงถูก บางส่วนว่างเปล่าโดยไม่มี error) หยุด dev server ก่อนเสมอแล้วค่อย build
- **ห้ามรัน `npm run seed:demo` หรือ `npm run db:clean-test` บน production** — ทั้งสองมี guard ปฏิเสธถ้า `NODE_ENV=production` แล้ว แต่อย่าพยายามเลี่ยง guard นี้เด็ดขาด
- **ห้ามรัน `npx prisma init` ซ้ำ** — จะสร้างไฟล์/โฟลเดอร์ที่ไม่ต้องการ (`.claude/skills/`, `.agents/`, `prisma.config.ts` ฯลฯ)
