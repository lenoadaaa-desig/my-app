# API Reference

เอกสารนี้สร้างจากการไล่อ่าน `app/api/**/route.ts` ทุกไฟล์จริง และ `lib/api-response.ts` โดยตรง (ไม่ได้อ้างจากผลตรวจความปลอดภัยรอบก่อนหน้า) — วิธี verify อยู่ท้ายไฟล์

## Response format มาตรฐาน

ทุก endpoint ตอบกลับเป็นรูปแบบเดียวกันเสมอ (`lib/api-response.ts`'s `ok`/`fail`):

**สำเร็จ**
```json
{ "success": true, "data": /* ผลลัพธ์ ต่างกันไปตาม endpoint */ }
```

**ผิดพลาด**
```json
{ "success": false, "error": { "code": "SOME_CODE", "message": "ข้อความภาษาไทยสำหรับแสดงผู้ใช้" } }
```

`code` เป็น string ภาษาอังกฤษให้ frontend เช็คแบบ branch ได้ ส่วน `message` เป็นภาษาไทย เอาไปแสดงตรงๆ ได้เลย

ทุก endpoint (ยกเว้นที่ระบุไว้เฉพาะ) อาจตอบ `401 UNAUTHORIZED` (ไม่ได้ login) หรือ `403 FORBIDDEN` (login แล้วแต่ role/ความเป็นเจ้าของไม่ตรง) เพิ่มเติมจากที่ระบุในตารางด้วยเสมอ

## ERROR_CODES ทั้งหมด

| code | HTTP status | ความหมาย |
|---|---|---|
| `UNAUTHORIZED` | 401 | ไม่ได้ login |
| `FORBIDDEN` | 403 | login แล้วแต่ไม่มีสิทธิ์ทำสิ่งนี้ (role หรือ ownership ไม่ตรง) |
| `NOT_FOUND` | 404 | ไม่พบ resource ที่ระบุ (หรือมีอยู่แต่ผู้ใช้นี้ไม่มีสิทธิ์เห็น — ปฏิบัติเหมือนไม่มีอยู่จริงเพื่อไม่ leak ข้อมูล) |
| `VALIDATION_ERROR` | 400 | body/query ไม่ผ่าน zod schema |
| `SLOT_FULL` | 409 | รอบเวลาที่เลือกที่นั่งเต็มแล้ว |
| `INVALID_STATE` | 409 | ขอเปลี่ยนสถานะ booking ที่ไม่ใช่ transition ที่อนุญาตจากสถานะปัจจุบัน |
| `CONFIRMATION_REQUIRED` | 409 | แก้เวลาทำการ/ตั้งค่าร้านกระทบ booking ในอนาคตที่ยังไม่ resolve — ต้องส่งซ้ำพร้อม `confirm: true` |
| `SIGNUP_FAILED` | 500 | สมัครสมาชิกไม่สำเร็จ |
| `ROLE_UPDATE_FAILED` | 500 | เปลี่ยน role ผู้ใช้ไม่สำเร็จ |
| `DELETE_USER_FAILED` | 500 | ลบผู้ใช้ไม่สำเร็จ |
| `RESTAURANT_CREATE_FAILED` | 500 | สร้างร้านไม่สำเร็จ |
| `RESTAURANT_UPDATE_FAILED` | 500 | แก้ไขข้อมูลร้านไม่สำเร็จ |
| `REVIEW_FAILED` | 500 | อนุมัติ/ปฏิเสธ/ระงับร้านไม่สำเร็จ |
| `BOOKING_CODE_GENERATION_FAILED` | 500 | สร้างรหัสจองไม่สำเร็จ (ชนซ้ำเกินจำนวนครั้งที่ retry) |
| `BOOKING_CREATE_FAILED` | 500 | สร้างการจองไม่สำเร็จ |
| `BOOKING_STATUS_UPDATE_FAILED` | 500 | เปลี่ยนสถานะการจองไม่สำเร็จ |
| `RATE_LIMITED` | 429 | จองเกิน 10 ครั้ง/10 นาที (ไม่นับแอดมิน) — `message` มีเวลาที่ต้องรอจริงเป็นนาที |

## REST endpoints

### Restaurants

| Method | Path | ใครเรียกได้ | Request | Response `data` |
|---|---|---|---|---|
| `GET` | `/api/restaurants` | ทุกคน (ไม่ต้อง login) | query: `q?`, `category?`, `page=1`, `pageSize=20` (1-50) — เฉพาะร้านสถานะ `APPROVED` | `{ items: Restaurant[] (พร้อม openingHours), total, page, pageSize, categories: string[] }` |
| `POST` | `/api/restaurants` | ผู้ใช้ที่ login แล้ว ยกเว้น role `admin` (แอดมินอนุมัติร้านเอง จะสมัครร้านเองไม่ได้ — กันผลประโยชน์ทับซ้อน) | body: `{ name, description?, address?, phone?, category, coverImage? }` | `Restaurant` — ถ้าผู้สมัคร role เป็น `customer` จะถูกเลื่อนเป็น `owner` อัตโนมัติ |
| `GET` | `/api/restaurants/[id]` | ทุกคน — แต่เห็นเฉพาะร้าน `APPROVED`; เจ้าของร้านเห็นร้านตัวเองทุกสถานะ; แอดมินเห็นทุกร้านทุกสถานะ (ร้านที่ยังไม่อนุมัติ/ถูกปฏิเสธ ผู้ใช้อื่นจะได้ `NOT_FOUND` แทน ไม่ leak ว่ามีอยู่) | — | `Restaurant & { openingHours: OpeningHour[] }` |
| `PATCH` | `/api/restaurants/[id]` | role `owner` **และ** ต้องเป็นเจ้าของร้านนั้นจริง (`restaurant.ownerId === profile.id`) | body: `updateRestaurantSchema` — เหมือน POST แต่ทุก field optional | `Restaurant` |
| `PUT` | `/api/restaurants/[id]/hours` | role `owner` + เจ้าของร้านนั้น | body: `{ hours: [7 แถว ครบ dayOfWeek 0-6], confirm?: boolean }` — แต่ละแถว `{ dayOfWeek, openTime: "HH:mm", closeTime: "HH:mm", isClosed }` | `OpeningHour[]` — ถ้ากระทบ booking ในอนาคตและไม่ส่ง `confirm: true` จะได้ `CONFIRMATION_REQUIRED` แทน |
| `PUT` | `/api/restaurants/[id]/settings` | role `owner` + เจ้าของร้านนั้น | body: `{ slotDuration, capacityPerSlot, maxPartySize, advanceDays, minLeadHours, autoConfirm, confirm?: boolean }` (`maxPartySize <= capacityPerSlot`) | `BookingSetting` — เหมือนข้างบน อาจได้ `CONFIRMATION_REQUIRED` |
| `POST` | `/api/restaurants/[id]/resubmit` | role `owner` + เจ้าของร้านนั้น | — | `Restaurant` — ส่งร้านที่ถูก `REJECTED` กลับเข้าคิว `PENDING` อีกครั้ง |
| `GET` | `/api/restaurants/[id]/slots` | ทุกคน (ไม่ต้อง login) | query: `date` (`YYYY-MM-DD`, บังคับ) | `Slot[]` — แต่ละอัน `{ time, capacity, booked, available }` |

### Bookings

| Method | Path | ใครเรียกได้ | Request | Response `data` |
|---|---|---|---|---|
| `POST` | `/api/bookings` | ผู้ใช้ที่ login แล้ว (ทุก role — owner ก็จองในฐานะลูกค้าได้) | body: `{ restaurantId (uuid), date, slotTime, partySize, customerNote? }` | `Booking` — จำกัด 10 ครั้ง/10 นาที ต่อ customer (แอดมินยกเว้น) |
| `GET` | `/api/bookings/my` | ผู้ใช้ที่ login แล้ว (ทุก role) | query: `page=1`, `pageSize=20` (1-50) | `{ upcoming: Booking[], history: Booking[], cancelled: Booking[] }` (แต่ละ booking พ่วง `restaurant` แบบย่อ) |
| `PATCH` | `/api/bookings/[id]/cancel` | ผู้ใช้ที่ login แล้ว — แต่ยกเลิกได้จริงเฉพาะ booking ของตัวเอง (เช็คใน service ไม่ใช่ role) | — | `Booking` — บังคับตั้งสถานะเป็น `CANCELLED` |
| `PATCH` | `/api/bookings/[id]/status` | role `owner` หรือ `admin` — แต่ owner ต้องเป็นเจ้าของร้านของ booking นั้นจริง (เช็คความสัมพันธ์ ไม่ใช่ role เฉยๆ — ดู "Project rules" ข้อ 7 ใน `CLAUDE.md`) | body: `{ status: CONFIRMED\|REJECTED\|CANCELLED\|CHECKED_IN\|COMPLETED\|NO_SHOW, reason? }` (`reason` บังคับเมื่อเจ้าของร้านสั่ง `CANCELLED` แทนลูกค้า) | `Booking` |
| `GET` | `/api/owner/bookings` | role `owner` + ต้องเป็นเจ้าของร้าน `restaurantId` ที่ระบุจริง | query: `restaurantId` (uuid, บังคับ), `date?` | `RestaurantBooking[]` (แต่ละอันพ่วงข้อมูลลูกค้า `{ id, fullName, phone, email }`) |

### Admin

| Method | Path | ใครเรียกได้ | Request | Response `data` |
|---|---|---|---|---|
| `GET` | `/api/admin/restaurants` | role `admin` เท่านั้น | query: `status?` (`pending`\|`approved`\|`rejected`\|`suspended`, default `pending`) | `Restaurant[]` (พ่วง `owner: { id, email, fullName }`) |
| `PATCH` | `/api/admin/restaurants/[id]/review` | role `admin` เท่านั้น | body: `{ action: approve\|reject\|suspend, reason? }` (`reason` บังคับเมื่อ `reject`) | `Restaurant` |

## Server actions (ไม่ใช่ REST)

จุดต่อไปนี้เป็น Next.js Server Actions (`"use server"`) ไม่ใช่ API route — เรียกตรงจาก form/component ฝั่ง client แบบ type-safe โดยไม่ต้องเขียน `fetch` เอง ไม่มี URL หรือ HTTP method ให้เรียกจากภายนอก:

| Action | ไฟล์ | ใครเรียกได้ | หน้าที่ |
|---|---|---|---|
| `signup(state, formData)` | `app/signup/actions.ts` | ทุกคน (ไม่ต้อง login) | สมัครสมาชิกใหม่ (`email`, `password`, `name`, `phone`) — ถ้า Supabase คืน session ทันที (Confirm email ปิดอยู่) จะ redirect ไป `/dashboard` เอง ไม่งั้นให้ข้อความไปยืนยันอีเมล |
| `login(state, formData)` | `app/login/actions.ts` | ทุกคน (ไม่ต้อง login) | ล็อกอินด้วย email/password ผ่าน Supabase แล้ว redirect ไป `/dashboard` |
| `logout()` | `app/actions.ts` | ผู้ใช้ที่ login แล้ว | เคลียร์ session แล้ว redirect ไป `/login` |
| `setUserRole(userId, role)` | `app/admin/actions.ts` | role `admin` เท่านั้น (เช็คซ้ำในนี้เอง ไม่ใช่แค่ที่ proxy) | เปลี่ยน role ผู้ใช้อื่น — กันเปลี่ยน role ตัวเองและกันลด role แอดมินคนสุดท้ายที่เหลือในระบบ |
| `deleteUser(userId)` | `app/admin/actions.ts` | role `admin` เท่านั้น | ลบผู้ใช้ทั้ง `profiles` และ `auth.users` — กันแอดมินลบตัวเอง |

ทำเป็น Server Action แทน API route เพราะเป็นการกระทำที่ผูกกับฟอร์ม/ปุ่มเฉพาะหน้าเดียวในแอป (ไม่มีความจำเป็นต้องเรียกจาก client อื่นนอก Next.js เอง) และได้ประโยชน์จาก Next.js's built-in CSRF protection กับ progressive enhancement (form ทำงานได้แม้ JS ยังไม่โหลด) ซึ่ง REST endpoint ธรรมดาไม่มีให้ฟรี

## วิธี verify เอกสารนี้ตรงกับโค้ดจริง

**(1) ทุก endpoint ในตารางมีอยู่จริงในโค้ด** — อ่านทุกไฟล์ทีละไฟล์จาก `find app/api -name "route.ts"` (13 ไฟล์) และคัดลอก method/schema/service call ที่พบลงตารางตรงๆ ไม่มี endpoint ไหนในตารางที่ไม่ได้มาจากการอ่านไฟล์จริง

**(2) ทุก route ในโค้ดอยู่ในเอกสาร ไม่ตกหล่น** — เทียบรายการไฟล์กับตาราง:

```
app/api/admin/restaurants/[id]/review/route.ts   -> PATCH /api/admin/restaurants/[id]/review   ✓
app/api/admin/restaurants/route.ts               -> GET  /api/admin/restaurants                ✓
app/api/bookings/[id]/cancel/route.ts            -> PATCH /api/bookings/[id]/cancel            ✓
app/api/bookings/[id]/status/route.ts            -> PATCH /api/bookings/[id]/status            ✓
app/api/bookings/my/route.ts                     -> GET  /api/bookings/my                       ✓
app/api/bookings/route.ts                        -> POST /api/bookings                          ✓
app/api/owner/bookings/route.ts                  -> GET  /api/owner/bookings                    ✓
app/api/restaurants/[id]/hours/route.ts          -> PUT  /api/restaurants/[id]/hours             ✓
app/api/restaurants/[id]/resubmit/route.ts       -> POST /api/restaurants/[id]/resubmit          ✓
app/api/restaurants/[id]/route.ts                -> GET+PATCH /api/restaurants/[id]              ✓
app/api/restaurants/[id]/settings/route.ts       -> PUT  /api/restaurants/[id]/settings          ✓
app/api/restaurants/[id]/slots/route.ts          -> GET  /api/restaurants/[id]/slots             ✓
app/api/restaurants/route.ts                     -> GET+POST /api/restaurants                    ✓
```

13/13 ไฟล์ ตรงกับตารางครบทุกอัน 1 ต่อ 1 ไม่มีไฟล์ไหนตกหล่นและไม่มีแถวไหนในตารางที่ไม่มีไฟล์รองรับ

**สิ่งที่พบระหว่าง verify ที่ต้องบันทึกไว้**: `modules/admin/admin.schema.ts` มี `listUsersQuerySchema` (สำหรับค้นหา/กรองผู้ใช้ตาม role) แต่**ไม่มี API route ไหนใช้ schema นี้เลย** — หน้า `/admin` ดึงรายชื่อผู้ใช้ผ่าน Server Component เรียก service ตรง ๆ ไม่ได้ผ่าน REST endpoint จึงไม่มีแถวคู่กันในตาราง REST endpoints ด้านบน (ถูกต้องแล้ว ไม่ใช่ endpoint ที่ตกหล่น — แค่ไม่ใช่ REST)
