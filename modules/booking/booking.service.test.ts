import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { BookingStatus, RestaurantStatus, Role as PrismaRole } from "@prisma/client";
import { SEAT_CONSUMING_STATUSES } from "./booking.state";

// .env.local's DATABASE_URL is pinned to connection_limit=1 — correct for
// the app's normal per-request usage, but wrong for a real concurrency
// test: with 1 connection, Prisma Client queues every $transaction one at a
// time *before* it ever reaches Postgres, so the "10 requests at once" test
// below would pass even with the advisory lock deleted — proving nothing.
// Bump it for this test process only, before lib/prisma.ts's singleton
// (`new PrismaClient()`, reading process.env at that moment) is ever
// constructed — done inside beforeAll, via dynamic import, since static
// imports are hoisted above any top-level code in this file and would
// import (and so construct) the singleton first.
let prisma: typeof import("@/lib/prisma").prisma;
let createBooking: typeof import("./booking.service").createBooking;

const createdRestaurantIds: string[] = [];
const createdProfileIds: string[] = [];

beforeAll(async () => {
  const bumpedUrl = new URL(process.env.DATABASE_URL!);
  bumpedUrl.searchParams.set("connection_limit", "12");
  process.env.DATABASE_URL = bumpedUrl.toString();

  ({ prisma } = await import("@/lib/prisma"));
  ({ createBooking } = await import("./booking.service"));
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
  capacityPerSlot?: number;
  maxPartySize?: number;
  autoConfirm?: boolean;
};

async function createTestRestaurant(opts: TestRestaurantOptions = {}) {
  const ownerId = randomUUID();
  await prisma.profile.create({
    data: { id: ownerId, email: `owner-${ownerId}@test.local`, role: PrismaRole.OWNER },
  });
  createdProfileIds.push(ownerId);

  const restaurant = await prisma.restaurant.create({
    data: {
      ownerId,
      name: `[test] restaurant ${ownerId}`,
      category: "test",
      status: opts.status ?? RestaurantStatus.APPROVED,
    },
  });
  createdRestaurantIds.push(restaurant.id);

  // Wide open hours (00:00-23:00) so a slot exists regardless of which real
  // calendar weekday futureDateString(n) lands on.
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
      autoConfirm: opts.autoConfirm ?? false,
    },
  });

  return restaurant;
}

async function createTestCustomer() {
  const id = randomUUID();
  await prisma.profile.create({
    data: { id, email: `customer-${id}@test.local`, role: PrismaRole.CUSTOMER },
  });
  createdProfileIds.push(id);
  return id;
}

describe("createBooking: normal cases", () => {
  it("books successfully", async () => {
    const restaurant = await createTestRestaurant();
    const customerId = await createTestCustomer();

    const result = await createBooking(customerId, {
      restaurantId: restaurant.id,
      date: futureDateString(2),
      slotTime: "12:00",
      partySize: 2,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe(BookingStatus.PENDING);
    expect(result.data.code).toMatch(/^BK-[2-9A-HJ-KM-NP-Z]{6}$/);
  });

  it("rejects a same-day date string that isn't canonical YYYY-MM-DD, instead of silently deriving a different lock key for the same day", async () => {
    // The advisory lock key is built from `input.date` (booking.service.ts,
    // after parseCalendarDateString has already validated it against
    // `^\d{4}-\d{2}-\d{2}$`) — never from a Date object's .toISOString() /
    // .toString(), which would vary by construction method. A caller who
    // passes e.g. someDate.toISOString() (with a time component) for the
    // same calendar day another caller wrote canonically must be rejected
    // outright here, not silently accepted with a lock key that fails to
    // match the canonical one for the same slot.
    const restaurant = await createTestRestaurant();
    const customerId = await createTestCustomer();
    const canonical = futureDateString(2);

    const result = await createBooking(customerId, {
      restaurantId: restaurant.id,
      date: `${canonical}T00:00:00.000Z`,
      slotTime: "12:00",
      partySize: 2,
    });

    expect(result).toEqual({
      success: false,
      error: { code: "VALIDATION_ERROR", message: expect.any(String) },
    });
  });

  it("rejects a slotTime that isn't a real generated slot", async () => {
    const restaurant = await createTestRestaurant();
    const customerId = await createTestCustomer();

    const result = await createBooking(customerId, {
      restaurantId: restaurant.id,
      date: futureDateString(2),
      slotTime: "13:37", // not aligned to the hourly grid
      partySize: 2,
    });

    expect(result).toEqual({
      success: false,
      error: { code: "VALIDATION_ERROR", message: expect.any(String) },
    });
  });

  it("rejects partySize over the restaurant's maxPartySize", async () => {
    const restaurant = await createTestRestaurant({ maxPartySize: 4 });
    const customerId = await createTestCustomer();

    const result = await createBooking(customerId, {
      restaurantId: restaurant.id,
      date: futureDateString(2),
      slotTime: "12:00",
      partySize: 5,
    });

    expect(result).toEqual({
      success: false,
      error: { code: "VALIDATION_ERROR", message: expect.any(String) },
    });
  });

  it("rejects booking a restaurant that isn't APPROVED", async () => {
    const restaurant = await createTestRestaurant({ status: RestaurantStatus.PENDING });
    const customerId = await createTestCustomer();

    const result = await createBooking(customerId, {
      restaurantId: restaurant.id,
      date: futureDateString(2),
      slotTime: "12:00",
      partySize: 2,
    });

    expect(result).toEqual({
      success: false,
      error: { code: "INVALID_STATE", message: expect.any(String) },
    });
  });

  it("auto-confirms when the restaurant has autoConfirm on", async () => {
    const restaurant = await createTestRestaurant({ autoConfirm: true });
    const customerId = await createTestCustomer();

    const result = await createBooking(customerId, {
      restaurantId: restaurant.id,
      date: futureDateString(2),
      slotTime: "12:00",
      partySize: 2,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe(BookingStatus.CONFIRMED);
  });
});

describe("createBooking: real concurrency", () => {
  it(
    "exactly 1 of 10 simultaneous requests wins a 2-seat slot, 3 rounds, each starting from a genuinely empty slot",
    async () => {
      const restaurant = await createTestRestaurant({ capacityPerSlot: 2, maxPartySize: 2 });
      const customers = await Promise.all(Array.from({ length: 10 }, () => createTestCustomer()));
      const date = futureDateString(3);
      const slotTime = "12:00";

      for (let round = 1; round <= 3; round++) {
        const preExisting = await prisma.booking.aggregate({
          where: {
            restaurantId: restaurant.id,
            bookingDate: new Date(`${date}T00:00:00.000Z`),
            slotTime,
            status: { in: SEAT_CONSUMING_STATUSES },
          },
          _sum: { partySize: true },
        });
        // The case a `SELECT ... FOR UPDATE` on bookings would miss: no rows
        // exist yet to lock, so it wouldn't serialize anything here. The
        // advisory lock doesn't depend on row existence — this is exactly
        // what proves it's actually the thing doing the serializing below.
        expect(preExisting._sum.partySize ?? 0).toBe(0);

        const results = await Promise.all(
          customers.map((customerId) =>
            createBooking(customerId, { restaurantId: restaurant.id, date, slotTime, partySize: 2 })
          )
        );

        const succeeded = results.filter((r) => r.success);
        const slotFull = results.filter((r) => !r.success && r.error.code === "SLOT_FULL");

        expect(succeeded.length, `round ${round}: expected exactly 1 success`).toBe(1);
        expect(slotFull.length, `round ${round}: expected exactly 9 SLOT_FULL`).toBe(9);

        const after = await prisma.booking.aggregate({
          where: {
            restaurantId: restaurant.id,
            bookingDate: new Date(`${date}T00:00:00.000Z`),
            slotTime,
            status: { in: SEAT_CONSUMING_STATUSES },
          },
          _sum: { partySize: true },
        });
        expect(after._sum.partySize ?? 0, `round ${round}: SUM(party_size) must not exceed capacity`).toBeLessThanOrEqual(2);

        // Reset for the next round.
        await prisma.booking.deleteMany({ where: { restaurantId: restaurant.id, bookingDate: new Date(`${date}T00:00:00.000Z`), slotTime } });
      }
    },
    60_000
  );
});
