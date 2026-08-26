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
// Task 9 phase 1: this script used to delete only `profiles` rows, never
// the matching Supabase `auth.users` row — Prisma can't reach the `auth`
// schema (Project rule 2), so that side always has to go through the
// Supabase Admin API separately. Leaving an orphaned auth.users row behind
// means it can still log in; on its next request, lib/dal.ts's
// ensureProfile() (called when a logged-in user has no profile row) quietly
// recreates a fresh profile for it — the "deleted" test account is back.
// See CLAUDE.md's "ข้อจำกัดที่ทราบแล้ว" for the (likely) real incident this
// caused: a generateLink() call for an email with no existing auth user
// silently creates one on the spot (type flips to "signup"), rather than
// erroring — an orphan with no profile the moment that call returns, no
// login or verifyOtp required to produce it. This script now sweeps auth
// users two ways: paired (has a profile row being deleted here) and orphan
// (email matches the test pattern but no profile row exists at all, so it
// could never be found by scanning `profiles` in the first place).
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to run: NODE_ENV=production. This script deletes rows and must never run against production.");
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY is missing from .env.local — needed to delete the matching auth.users rows. " +
      "Get it from Supabase Dashboard > Project Settings > API Keys > service_role."
  );
  process.exit(1);
}

const prisma = new PrismaClient();
// Constructed inline rather than importing lib/supabase/admin.ts — that
// file has a top-level `import "server-only"` guard that only resolves
// correctly under Next's/Vitest's own module aliasing (see CLAUDE.md), not
// under a plain `tsx` script invocation like this one.
const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Matches every marker generation this project has used for Vitest
// fixtures: the original shared "test", and the per-file "test:restaurant"
// / "test:booking" markers (see modules/restaurant/restaurant.service.test.ts
// and modules/booking/booking.service.test.ts) — LIKE 'test%' covers both
// without needing to list every marker by name here.
async function findTestRestaurants() {
  return prisma.restaurant.findMany({
    where: { OR: [{ name: { startsWith: "[test]" } }, { category: { startsWith: "test" } }] },
    select: { id: true, name: true },
  });
}

// Same reasoning as the marker above: matches every fixture email domain
// this project has used (test.local, test-restaurant.local,
// test-booking.local, and any future *.local variant) — a real user's
// email is never a .local domain, so this can't collide with genuine data.
async function findTestProfiles() {
  return prisma.profile.findMany({
    where: { email: { endsWith: ".local" } },
    select: { id: true, email: true },
  });
}

type TestProfile = Awaited<ReturnType<typeof findTestProfiles>>[number];

/**
 * A *.local profile is only safe to delete here if every restaurant it owns
 * is also in this run's restaurant-deletion set — otherwise deleting it
 * would violate Restaurant.ownerId's onDelete: Restrict the moment this
 * script tries, for a restaurant this run was never going to touch. This
 * is a different (narrower) check than authService.deleteUser's — that one
 * refuses to delete a user who owns *any* restaurant at all, because it's a
 * single-user admin-panel action with nothing else being deleted alongside
 * it. This script's whole purpose is deleting *.local test owners together
 * with their *.local-scoped test restaurants in the same sweep, so owning
 * one of those is expected and fine.
 */
async function partitionDeletableProfiles(profiles: TestProfile[], testRestaurantIds: string[]) {
  const deletable: TestProfile[] = [];
  const blocked: { profile: TestProfile; reason: string }[] = [];

  for (const profile of profiles) {
    const ownedOutsideTestSet = await prisma.restaurant.findMany({
      where: { ownerId: profile.id, id: { notIn: testRestaurantIds } },
      select: { name: true },
    });
    if (ownedOutsideTestSet.length > 0) {
      blocked.push({
        profile,
        reason: `owns ${ownedOutsideTestSet.length} restaurant(s) not marked as test data (name doesn't start with "[test]", category doesn't start with "test"): ${ownedOutsideTestSet.map((r) => r.name).join(", ")}`,
      });
    } else {
      deletable.push(profile);
    }
  }

  return { deletable, blocked };
}

async function findTestBookings(restaurantIds: string[], profileIds: string[]) {
  return prisma.booking.findMany({
    where: { OR: [{ restaurantId: { in: restaurantIds } }, { customerId: { in: profileIds } }] },
    select: {
      id: true,
      code: true,
      restaurant: { select: { name: true } },
      customer: { select: { email: true } },
    },
  });
}

/** Every *.local auth user Supabase actually knows about, id -> user. */
async function listTestAuthUsersById(): Promise<Map<string, { id: string; email: string | null }>> {
  // perPage generous enough to cover this project's whole user base in one
  // page — this is a dev-only cleanup script for a small test project, not
  // a paginated production listing.
  const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    throw new Error(`listUsers failed: ${error.message}`);
  }
  const byId = new Map<string, { id: string; email: string | null }>();
  for (const user of data.users) {
    if (user.email?.endsWith(".local")) {
      byId.set(user.id, { id: user.id, email: user.email });
    }
  }
  return byId;
}

async function main() {
  const testRestaurants = await findTestRestaurants();
  const testRestaurantIds = testRestaurants.map((r) => r.id);

  const allTestProfiles = await findTestProfiles();
  const { deletable: profilesToDelete, blocked: profilesBlocked } = await partitionDeletableProfiles(
    allTestProfiles,
    testRestaurantIds
  );
  const profileIdsToDelete = profilesToDelete.map((p) => p.id);

  const testBookings = await findTestBookings(testRestaurantIds, profileIdsToDelete);
  const bookingIds = testBookings.map((b) => b.id);

  const openingHourCount = await prisma.openingHour.count({ where: { restaurantId: { in: testRestaurantIds } } });
  const bookingSettingCount = await prisma.bookingSetting.count({ where: { restaurantId: { in: testRestaurantIds } } });

  const testAuthUsersById = await listTestAuthUsersById();
  // Cross-referenced against *every* profile in the whole table, not just
  // the *.local ones — an auth user is only a true orphan if no profile
  // row exists for it at all (any email), matching Project rule 3
  // (Profile.id === auth.users.id).
  const allProfileIds = new Set((await prisma.profile.findMany({ select: { id: true } })).map((p) => p.id));

  const pairedAuthUsers: { id: string; email: string | null }[] = [];
  const missingAuthUserForProfile: TestProfile[] = [];
  for (const profile of profilesToDelete) {
    const authUser = testAuthUsersById.get(profile.id);
    if (authUser) {
      pairedAuthUsers.push(authUser);
    } else {
      missingAuthUserForProfile.push(profile);
    }
  }

  const orphanAuthUsers = [...testAuthUsersById.values()].filter((u) => !allProfileIds.has(u.id));

  console.log("=== จะลบข้อมูลต่อไปนี้ (dry run) ===\n");

  console.log(`Restaurant (${testRestaurants.length}):`);
  for (const r of testRestaurants) console.log(`  - ${r.name}  (${r.id})`);

  console.log(`\nProfile (${profilesToDelete.length}):`);
  for (const p of profilesToDelete) console.log(`  - ${p.email}  (${p.id})`);

  console.log(`\nBooking (${testBookings.length}):`);
  for (const b of testBookings) {
    console.log(`  - ${b.code}  ร้าน: ${b.restaurant.name}  ลูกค้า: ${b.customer.email ?? "(ไม่มีอีเมล)"}`);
  }

  console.log(`\nopening_hours (cascade กับร้านด้านบน): ${openingHourCount}`);
  console.log(`booking_settings (cascade กับร้านด้านบน): ${bookingSettingCount}`);

  console.log(`\nauth.users — paired กับ profile ที่จะลบด้านบน (${pairedAuthUsers.length}):`);
  for (const u of pairedAuthUsers) console.log(`  - ${u.email}  (${u.id})`);

  console.log(
    `\nauth.users — orphan, ไม่มี profile คู่กันเลย (${orphanAuthUsers.length}) ⚠️ อันตรายกว่ารายการอื่น — ลบตรงจาก auth โดยไม่มี FK ใดๆ ป้องกัน:`
  );
  for (const u of orphanAuthUsers) console.log(`  - ${u.email}  (${u.id})`);

  if (missingAuthUserForProfile.length > 0) {
    console.log(`\nProfile ที่จะลบแต่ไม่พบ auth user คู่กันเลย (${missingAuthUserForProfile.length}) — จะลบแค่ฝั่ง profiles:`);
    for (const p of missingAuthUserForProfile) console.log(`  - ${p.email}  (${p.id})`);
  }

  if (profilesBlocked.length > 0) {
    console.log(`\n⚠️ Profile ที่พบว่าเข้าเงื่อนไข *.local แต่ข้ามไป ลบไม่ได้ (${profilesBlocked.length}):`);
    for (const { profile, reason } of profilesBlocked) {
      console.log(`  - ${profile.email}  (${profile.id}): ${reason}`);
    }
  }

  const nothingToDelete =
    testRestaurants.length === 0 &&
    profilesToDelete.length === 0 &&
    testBookings.length === 0 &&
    orphanAuthUsers.length === 0;

  if (nothingToDelete) {
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

  const deletedBookings = await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
  // Cascades openingHour / bookingSetting / closures (schema.prisma onDelete: Cascade).
  const deletedRestaurants = await prisma.restaurant.deleteMany({ where: { id: { in: testRestaurantIds } } });
  const deletedProfiles = await prisma.profile.deleteMany({ where: { id: { in: profileIdsToDelete } } });

  console.log(
    `\nลบฝั่ง Prisma เสร็จแล้ว: booking ${deletedBookings.count}, restaurant ${deletedRestaurants.count}, profile ${deletedProfiles.count}`
  );

  console.log("\n=== ลบฝั่ง auth.users ===");
  let authDeleteFailures = 0;
  for (const u of [...pairedAuthUsers, ...orphanAuthUsers]) {
    const { error } = await adminClient.auth.admin.deleteUser(u.id);
    if (error) {
      authDeleteFailures++;
      console.error(`  ✗ ${u.email} (${u.id}): FAILED — ${error.message}`);
    } else {
      console.log(`  ✓ ${u.email} (${u.id}): ลบแล้ว`);
    }
  }

  console.log("\n=== สรุป ===");
  console.log(`ลบสำเร็จ: profile ${deletedProfiles.count}, restaurant ${deletedRestaurants.count}, booking ${deletedBookings.count}`);
  console.log(`auth.users ลบสำเร็จ: ${pairedAuthUsers.length + orphanAuthUsers.length - authDeleteFailures} / ${pairedAuthUsers.length + orphanAuthUsers.length}`);
  if (authDeleteFailures > 0) {
    console.log(`⚠️ auth.users ลบไม่สำเร็จ ${authDeleteFailures} รายการ — ดู FAILED ด้านบน ต้องแก้ด้วยมือ`);
  }
  if (profilesBlocked.length > 0) {
    console.log(`ข้ามไป (ลบไม่ได้): profile ${profilesBlocked.length} รายการ — ดูเหตุผลด้านบน`);
  }
  if (missingAuthUserForProfile.length > 0) {
    console.log(`profile ${missingAuthUserForProfile.length} รายการไม่มี auth user คู่กันตั้งแต่ต้น (ลบแค่ profiles ก็ครบแล้ว)`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
