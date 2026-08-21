// Emergency cleanup for Vitest fixture data that leaked into the real dev
// database — normally modules/restaurant/restaurant.service.test.ts and
// modules/booking/booking.service.test.ts clean up after themselves
// (afterAll) and also self-heal at the start of their own next run
// (beforeAll), but a process killed mid-run before either of those points
// still leaves rows behind. This is the manual escape hatch for whatever
// has already leaked, not something wired into the normal test flow.
//
// Deliberately NOT a pretest hook: running this automatically on every
// `npm test` would mean an unattended script deletes rows without anyone
// deciding to, on a database that (right now) also holds real hand-created
// data (e.g. an owner's own test restaurants made by hand in the running
// app, not by Vitest). Report-then-confirm here is the safety net for that.
//
// Run with `npm run db:clean-test`.
import { PrismaClient } from "@prisma/client";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to run: NODE_ENV=production. This script deletes rows and must never run against production.");
  process.exit(1);
}

const prisma = new PrismaClient();

// Matches every marker generation this project has used for Vitest
// fixtures: the original shared "test", and the per-file "test:restaurant"
// / "test:booking" markers (see modules/restaurant/restaurant.service.test.ts
// and modules/booking/booking.service.test.ts) — LIKE 'test%' covers both
// without needing to list every marker by name here.
async function findTestRestaurantIds(): Promise<string[]> {
  const rows = await prisma.restaurant.findMany({
    where: {
      OR: [{ name: { startsWith: "[test]" } }, { category: { startsWith: "test" } }],
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

// Same reasoning as the marker above: matches every fixture email domain
// this project has used (test.local, test-restaurant.local,
// test-booking.local, and any future *.local variant) — a real user's
// email is never a .local domain, so this can't collide with genuine data.
async function findTestProfileIds(): Promise<string[]> {
  const rows = await prisma.profile.findMany({
    where: { email: { endsWith: ".local" } },
    select: { id: true },
  });
  return rows.map((p) => p.id);
}

async function main() {
  const restaurantIds = await findTestRestaurantIds();
  const profileIds = await findTestProfileIds();

  // Bookings tied to either a leaked restaurant or a leaked profile —
  // covers both directions (a leaked restaurant's own bookings, and a
  // leaked customer profile's bookings at some other restaurant, however
  // unlikely) so neither deleteMany below can hit Booking's onDelete:
  // Restrict FK.
  const bookingWhere = { OR: [{ restaurantId: { in: restaurantIds } }, { customerId: { in: profileIds } }] };
  const bookingCount = await prisma.booking.count({ where: bookingWhere });
  const openingHourCount = await prisma.openingHour.count({ where: { restaurantId: { in: restaurantIds } } });
  const bookingSettingCount = await prisma.bookingSetting.count({ where: { restaurantId: { in: restaurantIds } } });

  console.log("จะลบข้อมูลต่อไปนี้:");
  console.log(`  restaurant:       ${restaurantIds.length}`);
  console.log(`  booking:          ${bookingCount}`);
  console.log(`  opening_hours:    ${openingHourCount}`);
  console.log(`  booking_settings: ${bookingSettingCount}`);
  console.log(`  profile (*.local): ${profileIds.length}`);

  if (restaurantIds.length === 0 && profileIds.length === 0) {
    console.log("\nไม่มีอะไรต้องลบ");
    await prisma.$disconnect();
    return;
  }

  const rl = readline.createInterface({ input: stdin, output: stdout });
  const answer = await rl.question('\nพิมพ์ "yes" เพื่อยืนยันลบ (อะไรอื่นเพื่อยกเลิก): ');
  rl.close();

  if (answer.trim().toLowerCase() !== "yes") {
    console.log("ยกเลิก — ไม่มีอะไรถูกลบ");
    await prisma.$disconnect();
    return;
  }

  const deletedBookings = await prisma.booking.deleteMany({ where: bookingWhere });
  // Cascades openingHour / bookingSetting / closures (schema.prisma onDelete: Cascade).
  const deletedRestaurants = await prisma.restaurant.deleteMany({ where: { id: { in: restaurantIds } } });
  const deletedProfiles = await prisma.profile.deleteMany({ where: { id: { in: profileIds } } });

  console.log(
    `\nลบเสร็จแล้ว: restaurant ${deletedRestaurants.count}, booking ${deletedBookings.count}, profile ${deletedProfiles.count}`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
