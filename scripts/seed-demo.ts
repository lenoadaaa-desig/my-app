// Populates believable demo data for manually browsing the customer-facing
// pages (/restaurants, /restaurants/[id], /bookings/my, ...) against the
// real dev database. Not a Vitest fixture — this data is meant to persist
// across sessions, unlike the create-then-delete pattern used in
// modules/booking/booking.service.test.ts.
//
// Run with `npm run seed:demo`. Safe to re-run any time: every row is
// upserted on a fixed id (restaurants, opening hours, booking settings) or
// a fixed booking `code` — re-running updates the same rows instead of
// duplicating them.
//
// Requires react-server export condition (see package.json's "seed:demo"
// script) — every modules/*/*.service.ts file starts with `import
// "server-only"`, which throws unless that condition is set. tsx runs
// outside Next's own server runtime, so this has to be supplied by hand the
// same way Next does internally. See CLAUDE.md's server-only note.
//
// Restaurant creation/approval intentionally bypasses
// restaurantService.createRestaurant / adminService.reviewRestaurant —
// those enforce real product rules (PENDING-only creation, an actual admin
// review audit trail, default opening hours) that a seed script needs to
// route around on purpose to get specific opening hours and an immediate
// APPROVED status. The one exception is role promotion: that goes through
// authService.setUserRole because Profile.role must stay in sync with
// Supabase app_metadata (CLAUDE.md rule 4) — writing the column directly
// would skip that sync silently.

import { PrismaClient, RestaurantStatus, BookingStatus } from "@prisma/client";
import { setUserRole } from "@/modules/auth/auth.service";

const prisma = new PrismaClient();

const OWNER_EMAIL = "leno.adaaa@gmail.com";
const OWNER_ID_PREFIX = "0c47198d";

// Fixed, obviously-fake UUIDs (not gen_random_uuid()) so re-running this
// script upserts the same rows instead of creating new ones every time.
const RESTAURANT_1_ID = "d3a10000-0000-4000-8000-000000000001"; // 10:00-22:00, closed Monday
const RESTAURANT_2_ID = "d3a10000-0000-4000-8000-000000000002"; // 18:00-02:00, crosses midnight
const RESTAURANT_3_ID = "d3a10000-0000-4000-8000-000000000003"; // long name, no coverImage
const DEMO_CUSTOMER_ID = "d3a10000-0000-4000-8000-0000000000c1";

const MONDAY = 1;

type OpeningHourSeed = { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean };

function everyDay(openTime: string, closeTime: string, closedOn: number[] = []): OpeningHourSeed[] {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    openTime: closedOn.includes(dayOfWeek) ? "00:00" : openTime,
    closeTime: closedOn.includes(dayOfWeek) ? "00:00" : closeTime,
    isClosed: closedOn.includes(dayOfWeek),
  }));
}

async function upsertOpeningHours(restaurantId: string, hours: OpeningHourSeed[]) {
  for (const hour of hours) {
    await prisma.openingHour.upsert({
      where: { restaurantId_dayOfWeek: { restaurantId, dayOfWeek: hour.dayOfWeek } },
      update: { openTime: hour.openTime, closeTime: hour.closeTime, isClosed: hour.isClosed },
      create: { restaurantId, ...hour },
    });
  }
}

// today + N calendar days, "YYYY-MM-DD" — recomputed every run (not a fixed
// date) so the demo bookings never drift into the past. Booking rows below
// are upserted by `code`, not by date, so a later run just moves the same
// demo booking forward to the new target date instead of leaving an orphan
// behind for whatever date it happened to land on last time.
function daysFromNow(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function main() {
  // === 1. Owner: promote the existing profile via authService.setUserRole
  // (never write .role directly — that would skip the app_metadata sync). ===
  const owner = await prisma.profile.findFirst({ where: { email: OWNER_EMAIL } });
  if (!owner) {
    throw new Error(
      `No profile found for ${OWNER_EMAIL}. Log in with this account at least once first — ` +
        "profiles are created by app/signup/actions.ts on signup, not by this script."
    );
  }
  if (!owner.id.startsWith(OWNER_ID_PREFIX)) {
    throw new Error(
      `Profile for ${OWNER_EMAIL} has id ${owner.id}, expected it to start with ${OWNER_ID_PREFIX}. ` +
        "Refusing to proceed against what might be the wrong account."
    );
  }

  if (owner.role === "CUSTOMER") {
    const result = await setUserRole(owner.id, "owner");
    if (!result.success) {
      throw new Error(`setUserRole failed: ${result.error.message}`);
    }
    console.log(`Promoted ${OWNER_EMAIL} to owner.`);
  } else {
    console.log(`${OWNER_EMAIL} is already ${owner.role.toLowerCase()}, skipping promotion.`);
  }

  // === 2. Demo customer profile — a booking needs a customerId distinct
  // from the restaurant owner. Has no matching Supabase auth user (never
  // logs in), which is normally against CLAUDE.md rule 3 (Profile.id must
  // equal an auth.users id) — acceptable here only because this row exists
  // purely as an FK target for demo Booking rows, never for real auth. ===
  await prisma.profile.upsert({
    where: { id: DEMO_CUSTOMER_ID },
    update: {},
    create: {
      id: DEMO_CUSTOMER_ID,
      email: "demo-customer@example.com",
      role: "CUSTOMER",
      fullName: "ลูกค้าตัวอย่าง",
    },
  });

  // === 3. Restaurants ===
  await prisma.restaurant.upsert({
    where: { id: RESTAURANT_1_ID },
    update: {
      name: "ร้านอาหารไทยบ้านสวน",
      description: "อาหารไทยรสชาติต้นตำรับ บรรยากาศร่มรื่นแบบบ้านสวน",
      address: "123 ถนนสุขุมวิท กรุงเทพฯ",
      phone: "021234567",
      category: "อาหารไทย",
      coverImage: "https://images.unsplash.com/photo-1552566626-52f8b828add9",
      status: RestaurantStatus.APPROVED,
    },
    create: {
      id: RESTAURANT_1_ID,
      ownerId: owner.id,
      name: "ร้านอาหารไทยบ้านสวน",
      description: "อาหารไทยรสชาติต้นตำรับ บรรยากาศร่มรื่นแบบบ้านสวน",
      address: "123 ถนนสุขุมวิท กรุงเทพฯ",
      phone: "021234567",
      category: "อาหารไทย",
      coverImage: "https://images.unsplash.com/photo-1552566626-52f8b828add9",
      status: RestaurantStatus.APPROVED,
    },
  });
  await upsertOpeningHours(RESTAURANT_1_ID, everyDay("10:00", "22:00", [MONDAY]));
  await prisma.bookingSetting.upsert({
    where: { restaurantId: RESTAURANT_1_ID },
    update: { slotDuration: 60, capacityPerSlot: 10, maxPartySize: 8, advanceDays: 30, minLeadHours: 2, autoConfirm: false },
    create: {
      restaurantId: RESTAURANT_1_ID,
      slotDuration: 60,
      capacityPerSlot: 10,
      maxPartySize: 8,
      advanceDays: 30,
      minLeadHours: 2,
      autoConfirm: false,
    },
  });

  await prisma.restaurant.upsert({
    where: { id: RESTAURANT_2_ID },
    update: {
      name: "ร้านบาร์ริมคลอง",
      description: "บาร์และอาหารทานเล่นยามค่ำคืน เปิดยันดึก",
      address: "456 ถนนเจริญกรุง กรุงเทพฯ",
      phone: "029876543",
      category: "บาร์ & ผับ",
      coverImage: "https://images.unsplash.com/photo-1470337458703-46ad1756a187",
      status: RestaurantStatus.APPROVED,
    },
    create: {
      id: RESTAURANT_2_ID,
      ownerId: owner.id,
      name: "ร้านบาร์ริมคลอง",
      description: "บาร์และอาหารทานเล่นยามค่ำคืน เปิดยันดึก",
      address: "456 ถนนเจริญกรุง กรุงเทพฯ",
      phone: "029876543",
      category: "บาร์ & ผับ",
      coverImage: "https://images.unsplash.com/photo-1470337458703-46ad1756a187",
      status: RestaurantStatus.APPROVED,
    },
  });
  // Crosses midnight — every day, no weekly closure, to keep the focus on
  // the crossing behavior alone (slot.engine.ts's crossesMidnight path).
  await upsertOpeningHours(RESTAURANT_2_ID, everyDay("18:00", "02:00"));
  await prisma.bookingSetting.upsert({
    where: { restaurantId: RESTAURANT_2_ID },
    update: { slotDuration: 60, capacityPerSlot: 6, maxPartySize: 6, advanceDays: 30, minLeadHours: 1, autoConfirm: true },
    create: {
      restaurantId: RESTAURANT_2_ID,
      slotDuration: 60,
      capacityPerSlot: 6,
      maxPartySize: 6,
      advanceDays: 30,
      minLeadHours: 1,
      autoConfirm: true,
    },
  });

  await prisma.restaurant.upsert({
    where: { id: RESTAURANT_3_ID },
    update: {
      name: "ร้านอาหารทะเลสดใหม่ทุกวันริมคลองบางกอกน้อยสไตล์ครอบครัวสำหรับงานเลี้ยงและมื้อพิเศษทุกโอกาส",
      description: "อาหารทะเลสดจากเรือประมงทุกเช้า",
      address: "789 ถนนบางกอกน้อย กรุงเทพฯ",
      phone: "022345678",
      category: "อาหารทะเล",
      coverImage: null, // deliberately no cover image — tests the fallback UI
      status: RestaurantStatus.APPROVED,
    },
    create: {
      id: RESTAURANT_3_ID,
      ownerId: owner.id,
      name: "ร้านอาหารทะเลสดใหม่ทุกวันริมคลองบางกอกน้อยสไตล์ครอบครัวสำหรับงานเลี้ยงและมื้อพิเศษทุกโอกาส",
      description: "อาหารทะเลสดจากเรือประมงทุกเช้า",
      address: "789 ถนนบางกอกน้อย กรุงเทพฯ",
      phone: "022345678",
      category: "อาหารทะเล",
      coverImage: null,
      status: RestaurantStatus.APPROVED,
    },
  });
  await upsertOpeningHours(RESTAURANT_3_ID, everyDay("10:00", "22:00"));
  await prisma.bookingSetting.upsert({
    where: { restaurantId: RESTAURANT_3_ID },
    update: { slotDuration: 90, capacityPerSlot: 12, maxPartySize: 10, advanceDays: 45, minLeadHours: 3, autoConfirm: false },
    create: {
      restaurantId: RESTAURANT_3_ID,
      slotDuration: 90,
      capacityPerSlot: 12,
      maxPartySize: 10,
      advanceDays: 45,
      minLeadHours: 3,
      autoConfirm: false,
    },
  });

  // === 4. Demo bookings on restaurant 1, 3 days out — comfortably past
  // minLeadHours (2h) and advanceDays (30) regardless of when this script
  // runs. capacityPerSlot is 10:
  //   19:00 -> one CONFIRMED booking for 10 fills the slot exactly (available
  //            = 0), showing the "เต็ม" badge.
  //   20:00 -> one CONFIRMED booking for 8 leaves 2 seats (available = 2),
  //            so any party size > 2 shows the "insufficient for party"
  //            disabled state on /restaurants/[id]. ===
  const bookingDate = daysFromNow(3);

  await prisma.booking.upsert({
    where: { code: "BK-DEMO01" },
    update: { bookingDate: new Date(`${bookingDate}T00:00:00.000Z`), slotTime: "19:00", partySize: 10, status: BookingStatus.CONFIRMED },
    create: {
      restaurantId: RESTAURANT_1_ID,
      customerId: DEMO_CUSTOMER_ID,
      bookingDate: new Date(`${bookingDate}T00:00:00.000Z`),
      slotTime: "19:00",
      partySize: 10,
      code: "BK-DEMO01",
      status: BookingStatus.CONFIRMED,
    },
  });

  await prisma.booking.upsert({
    where: { code: "BK-DEMO02" },
    update: { bookingDate: new Date(`${bookingDate}T00:00:00.000Z`), slotTime: "20:00", partySize: 8, status: BookingStatus.CONFIRMED },
    create: {
      restaurantId: RESTAURANT_1_ID,
      customerId: DEMO_CUSTOMER_ID,
      bookingDate: new Date(`${bookingDate}T00:00:00.000Z`),
      slotTime: "20:00",
      partySize: 8,
      code: "BK-DEMO02",
      status: BookingStatus.CONFIRMED,
    },
  });

  console.log("\nSeed complete. Restaurant ids:");
  console.log(`  ${RESTAURANT_1_ID}  ร้านอาหารไทยบ้านสวน (10:00-22:00, closed Mon)`);
  console.log(`  ${RESTAURANT_2_ID}  ร้านบาร์ริมคลอง (18:00-02:00, crosses midnight)`);
  console.log(`  ${RESTAURANT_3_ID}  ร้านอาหารทะเล... (long name, no cover image)`);
  console.log("\nOpen directly:");
  console.log(`  http://localhost:3000/restaurants/${RESTAURANT_1_ID}`);
  console.log(`  http://localhost:3000/restaurants/${RESTAURANT_2_ID}`);
  console.log(`  http://localhost:3000/restaurants/${RESTAURANT_3_ID}`);
  console.log(`\nDemo bookings on restaurant 1 for ${bookingDate}: 19:00 full (10/10), 20:00 low (8/10, 2 left).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
