import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { BookingStatus, RestaurantStatus, Role as PrismaRole } from "@prisma/client";

let prisma: typeof import("@/lib/prisma").prisma;
let resubmitRestaurant: typeof import("./restaurant.service").resubmitRestaurant;
let updateOpeningHours: typeof import("./restaurant.service").updateOpeningHours;
let updateBookingSetting: typeof import("./restaurant.service").updateBookingSetting;

// Unique to this file — Vitest runs test files in parallel by default, and
// booking.service.test.ts creates its own "test"-marked restaurants at the
// same time against the same real DB. A shared marker here would let this
// file's self-cleanup below delete rows the other file is mid-test with,
// causing flaky failures that only reproduce when both files happen to
// race (see CLAUDE.md's note on this — found via 27 leaked "[test]
// restaurant" rows reaching the public /restaurants search after a killed
// test run, which is what self-cleanup below fixes for next time).
const TEST_MARKER = "test:restaurant";
const TEST_EMAIL_DOMAIN = "test-restaurant.local";

const createdRestaurantIds: string[] = [];
const createdProfileIds: string[] = [];

beforeAll(async () => {
  ({ prisma } = await import("@/lib/prisma"));
  ({ resubmitRestaurant, updateOpeningHours, updateBookingSetting } = await import("./restaurant.service"));

  // Recovers from a previous run of *this file* being killed (Ctrl+C,
  // timeout, crash) before its own afterAll got to run — afterAll alone
  // only ever cleans up rows the *current* process created, tracked in the
  // in-memory arrays above, so it can never see a previous process's
  // leftovers. Scoped to TEST_MARKER/TEST_EMAIL_DOMAIN (unique to this
  // file) so it can't touch booking.service.test.ts's concurrently-running
  // fixtures.
  const leakedRestaurantIds = (
    await prisma.restaurant.findMany({ where: { category: TEST_MARKER }, select: { id: true } })
  ).map((r) => r.id);
  if (leakedRestaurantIds.length > 0) {
    await prisma.booking.deleteMany({ where: { restaurantId: { in: leakedRestaurantIds } } });
    await prisma.restaurant.deleteMany({ where: { id: { in: leakedRestaurantIds } } });
  }
  await prisma.profile.deleteMany({ where: { email: { endsWith: `@${TEST_EMAIL_DOMAIN}` } } });
});

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { restaurantId: { in: createdRestaurantIds } } });
  // Cascades openingHour / bookingSetting / closures (schema.prisma onDelete: Cascade).
  await prisma.restaurant.deleteMany({ where: { id: { in: createdRestaurantIds } } });
  await prisma.profile.deleteMany({ where: { id: { in: createdProfileIds } } });
  await prisma.$disconnect();
});

function futureDateString(daysAhead: number): string {
  return new Date(Date.now() + daysAhead * 86_400_000).toISOString().slice(0, 10);
}

type TestRestaurantOptions = {
  status?: RestaurantStatus;
  rejectReason?: string;
  capacityPerSlot?: number;
  maxPartySize?: number;
};

async function createTestRestaurant(opts: TestRestaurantOptions = {}) {
  const ownerId = randomUUID();
  await prisma.profile.create({
    data: { id: ownerId, email: `owner-${ownerId}@${TEST_EMAIL_DOMAIN}`, role: PrismaRole.OWNER },
  });
  createdProfileIds.push(ownerId);

  const restaurant = await prisma.restaurant.create({
    data: {
      ownerId,
      name: `[test] restaurant ${ownerId}`,
      category: TEST_MARKER,
      status: opts.status ?? RestaurantStatus.APPROVED,
      rejectReason: opts.rejectReason,
    },
  });
  createdRestaurantIds.push(restaurant.id);

  // Wide open hours (00:00-23:00) by default so a fixed slotTime like
  // "12:00" always falls inside them regardless of which real calendar
  // weekday futureDateString(n) lands on.
  await prisma.openingHour.createMany({
    data: Array.from({ length: 7 }, (_, dayOfWeek) => ({
      restaurantId: restaurant.id,
      dayOfWeek,
      openTime: "00:00",
      closeTime: "23:00",
      isClosed: false,
    })),
  });

  await prisma.bookingSetting.create({
    data: {
      restaurantId: restaurant.id,
      slotDuration: 60,
      capacityPerSlot: opts.capacityPerSlot ?? 10,
      maxPartySize: opts.maxPartySize ?? 8,
      advanceDays: 30,
      minLeadHours: 0,
      autoConfirm: false,
    },
  });

  return restaurant;
}

async function createTestCustomer() {
  const id = randomUUID();
  await prisma.profile.create({
    data: { id, email: `customer-${id}@${TEST_EMAIL_DOMAIN}`, role: PrismaRole.CUSTOMER },
  });
  createdProfileIds.push(id);
  return id;
}

function randomBookingCode(): string {
  return `BK${randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

async function createFutureBooking(
  restaurantId: string,
  customerId: string,
  opts: { date?: string; slotTime?: string; partySize?: number; status?: BookingStatus } = {}
) {
  return prisma.booking.create({
    data: {
      restaurantId,
      customerId,
      bookingDate: new Date(`${opts.date ?? futureDateString(3)}T00:00:00.000Z`),
      slotTime: opts.slotTime ?? "12:00",
      partySize: opts.partySize ?? 2,
      code: randomBookingCode(),
      status: opts.status ?? BookingStatus.PENDING,
    },
  });
}

// A full 7-row valid hours array (00:00-23:00, all open) — tests mutate a
// copy of this rather than repeating the 7-row shape each time.
function fullOpenHours() {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    openTime: "00:00",
    closeTime: "23:00",
    isClosed: false,
  }));
}

describe("resubmitRestaurant", () => {
  it("REJECTED -> PENDING succeeds, keeps rejectReason, clears reviewedAt/reviewedById", async () => {
    const adminId = randomUUID();
    await prisma.profile.create({ data: { id: adminId, email: `admin-${adminId}@${TEST_EMAIL_DOMAIN}`, role: PrismaRole.ADMIN } });
    createdProfileIds.push(adminId);

    const restaurant = await createTestRestaurant({ status: RestaurantStatus.REJECTED, rejectReason: "ข้อมูลไม่ครบ" });
    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { reviewedAt: new Date(), reviewedById: adminId },
    });

    const result = await resubmitRestaurant(restaurant.id, restaurant.ownerId);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe(RestaurantStatus.PENDING);
    expect(result.data.rejectReason).toBe("ข้อมูลไม่ครบ");
    expect(result.data.reviewedAt).toBeNull();
    expect(result.data.reviewedById).toBeNull();
  });

  it("APPROVED -> resubmit is INVALID_STATE", async () => {
    const restaurant = await createTestRestaurant({ status: RestaurantStatus.APPROVED });

    const result = await resubmitRestaurant(restaurant.id, restaurant.ownerId);

    expect(result).toEqual({ success: false, error: { code: "INVALID_STATE", message: expect.any(String) } });
  });

  it("SUSPENDED -> resubmit is INVALID_STATE", async () => {
    const restaurant = await createTestRestaurant({ status: RestaurantStatus.SUSPENDED, rejectReason: "ผิดกฎ" });

    const result = await resubmitRestaurant(restaurant.id, restaurant.ownerId);

    expect(result).toEqual({ success: false, error: { code: "INVALID_STATE", message: expect.any(String) } });
  });

  it("PENDING -> resubmit is INVALID_STATE", async () => {
    const restaurant = await createTestRestaurant({ status: RestaurantStatus.PENDING });

    const result = await resubmitRestaurant(restaurant.id, restaurant.ownerId);

    expect(result).toEqual({ success: false, error: { code: "INVALID_STATE", message: expect.any(String) } });
  });

  it("owner of a different restaurant gets FORBIDDEN", async () => {
    const restaurant = await createTestRestaurant({ status: RestaurantStatus.REJECTED, rejectReason: "x" });
    const otherOwner = await createTestRestaurant();

    const result = await resubmitRestaurant(restaurant.id, otherOwner.ownerId);

    expect(result).toEqual({ success: false, error: { code: "FORBIDDEN", message: expect.any(String) } });
  });
});

describe("updateOpeningHours", () => {
  it("owner of a different restaurant gets FORBIDDEN", async () => {
    const restaurant = await createTestRestaurant();
    const otherOwner = await createTestRestaurant();

    const result = await updateOpeningHours(restaurant.id, otherOwner.ownerId, fullOpenHours(), true);

    expect(result).toEqual({ success: false, error: { code: "FORBIDDEN", message: expect.any(String) } });
  });

  it("saves with no future bookings in the way, without needing confirm", async () => {
    const restaurant = await createTestRestaurant();
    const hours = fullOpenHours().map((h) => ({ ...h, openTime: "09:00", closeTime: "21:00" }));

    const result = await updateOpeningHours(restaurant.id, restaurant.ownerId, hours, false);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.every((h) => h.openTime === "09:00" && h.closeTime === "21:00")).toBe(true);
  });

  it("narrowing hours to exclude an existing future booking requires confirmation, then succeeds with confirm: true", async () => {
    const restaurant = await createTestRestaurant();
    const customerId = await createTestCustomer();
    // Booking at 12:00 — new hours below (14:00-21:00) would leave it outside.
    await createFutureBooking(restaurant.id, customerId, { slotTime: "12:00" });

    const narrowedHours = fullOpenHours().map((h) => ({ ...h, openTime: "14:00", closeTime: "21:00" }));

    const withoutConfirm = await updateOpeningHours(restaurant.id, restaurant.ownerId, narrowedHours, false);
    expect(withoutConfirm).toEqual({
      success: false,
      error: { code: "CONFIRMATION_REQUIRED", message: expect.any(String) },
    });

    const withConfirm = await updateOpeningHours(restaurant.id, restaurant.ownerId, narrowedHours, true);
    expect(withConfirm.success).toBe(true);
    if (!withConfirm.success) return;
    expect(withConfirm.data.every((h) => h.openTime === "14:00")).toBe(true);

    // The conflicting booking itself is untouched — never auto-cancelled.
    const stillThere = await prisma.booking.findMany({ where: { restaurantId: restaurant.id, customerId } });
    expect(stillThere).toHaveLength(1);
    expect(stillThere[0].status).toBe(BookingStatus.PENDING);
  });

  it("marking a day closed that has an existing future booking on it requires confirmation", async () => {
    const restaurant = await createTestRestaurant();
    const customerId = await createTestCustomer();
    const booking = await createFutureBooking(restaurant.id, customerId, { slotTime: "12:00" });
    const bookedDayOfWeek = new Date(booking.bookingDate).getUTCDay();

    const hoursWithClosedDay = fullOpenHours().map((h) =>
      h.dayOfWeek === bookedDayOfWeek ? { ...h, isClosed: true } : h
    );

    const result = await updateOpeningHours(restaurant.id, restaurant.ownerId, hoursWithClosedDay, false);

    expect(result).toEqual({ success: false, error: { code: "CONFIRMATION_REQUIRED", message: expect.any(String) } });
  });

  it("a resolved (CANCELLED) booking outside the new hours does not require confirmation", async () => {
    const restaurant = await createTestRestaurant();
    const customerId = await createTestCustomer();
    await createFutureBooking(restaurant.id, customerId, { slotTime: "12:00", status: BookingStatus.CANCELLED });

    const narrowedHours = fullOpenHours().map((h) => ({ ...h, openTime: "14:00", closeTime: "21:00" }));

    const result = await updateOpeningHours(restaurant.id, restaurant.ownerId, narrowedHours, false);

    expect(result.success).toBe(true);
  });
});

describe("updateBookingSetting", () => {
  const baseSettings = {
    slotDuration: 60,
    capacityPerSlot: 10,
    maxPartySize: 8,
    advanceDays: 30,
    minLeadHours: 0,
    autoConfirm: false,
  };

  it("owner of a different restaurant gets FORBIDDEN", async () => {
    const restaurant = await createTestRestaurant();
    const otherOwner = await createTestRestaurant();

    const result = await updateBookingSetting(restaurant.id, otherOwner.ownerId, baseSettings, true);

    expect(result).toEqual({ success: false, error: { code: "FORBIDDEN", message: expect.any(String) } });
  });

  it("saves with no future bookings in the way, without needing confirm", async () => {
    const restaurant = await createTestRestaurant();

    const result = await updateBookingSetting(restaurant.id, restaurant.ownerId, { ...baseSettings, capacityPerSlot: 20 }, false);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.capacityPerSlot).toBe(20);
  });

  it("reducing capacityPerSlot below an already-booked slot's total requires confirmation, then succeeds with confirm: true", async () => {
    const restaurant = await createTestRestaurant({ capacityPerSlot: 10 });
    const customerA = await createTestCustomer();
    const customerB = await createTestCustomer();
    const date = futureDateString(3);
    await createFutureBooking(restaurant.id, customerA, { date, slotTime: "12:00", partySize: 5 });
    await createFutureBooking(restaurant.id, customerB, { date, slotTime: "12:00", partySize: 3 });
    // Booked total at this slot is 8 — new capacity of 5 is below that.

    const withoutConfirm = await updateBookingSetting(
      restaurant.id,
      restaurant.ownerId,
      { ...baseSettings, capacityPerSlot: 5, maxPartySize: 5 },
      false
    );
    expect(withoutConfirm).toEqual({
      success: false,
      error: { code: "CONFIRMATION_REQUIRED", message: expect.any(String) },
    });

    const withConfirm = await updateBookingSetting(
      restaurant.id,
      restaurant.ownerId,
      { ...baseSettings, capacityPerSlot: 5, maxPartySize: 5 },
      true
    );
    expect(withConfirm.success).toBe(true);
    if (!withConfirm.success) return;
    expect(withConfirm.data.capacityPerSlot).toBe(5);

    // Neither existing booking is auto-cancelled or resized.
    const bookings = await prisma.booking.findMany({ where: { restaurantId: restaurant.id } });
    expect(bookings.map((b) => b.partySize).sort()).toEqual([3, 5]);
    expect(bookings.every((b) => b.status === BookingStatus.PENDING)).toBe(true);
  });

  it("reducing maxPartySize below an existing booking's own partySize requires confirmation", async () => {
    const restaurant = await createTestRestaurant({ capacityPerSlot: 20, maxPartySize: 8 });
    const customerId = await createTestCustomer();
    await createFutureBooking(restaurant.id, customerId, { partySize: 6 });

    const result = await updateBookingSetting(restaurant.id, restaurant.ownerId, { ...baseSettings, capacityPerSlot: 20, maxPartySize: 4 }, false);

    expect(result).toEqual({ success: false, error: { code: "CONFIRMATION_REQUIRED", message: expect.any(String) } });
  });

  it("a resolved (COMPLETED) booking over the new capacity does not require confirmation", async () => {
    const restaurant = await createTestRestaurant({ capacityPerSlot: 10 });
    const customerId = await createTestCustomer();
    await createFutureBooking(restaurant.id, customerId, { partySize: 8, status: BookingStatus.COMPLETED });

    const result = await updateBookingSetting(restaurant.id, restaurant.ownerId, { ...baseSettings, capacityPerSlot: 2, maxPartySize: 2 }, false);

    expect(result.success).toBe(true);
  });
});
