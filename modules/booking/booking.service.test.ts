import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { BookingStatus, RestaurantStatus, Role as PrismaRole } from "@prisma/client";
import { toBangkokParts, minutesToTimeString } from "@/lib/datetime";
import { SEAT_CONSUMING_STATUSES, ALLOWED_BOOKING_TRANSITIONS } from "./booking.state";

// Structural, not nominal — matches lib/dal.ts's Profile shape without a
// runtime import (see the connection_limit note below: any static import
// touching @/lib/dal would transitively import @/lib/prisma too early).
type TestActor = { id: string; email: string | null; role: "customer" | "owner" | "admin" };

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
let changeBookingStatus: typeof import("./booking.service").changeBookingStatus;
let getMyBookings: typeof import("./booking.service").getMyBookings;
let getRestaurantBookings: typeof import("./booking.service").getRestaurantBookings;

const createdRestaurantIds: string[] = [];
const createdProfileIds: string[] = [];

beforeAll(async () => {
  const bumpedUrl = new URL(process.env.DATABASE_URL!);
  bumpedUrl.searchParams.set("connection_limit", "12");
  process.env.DATABASE_URL = bumpedUrl.toString();

  ({ prisma } = await import("@/lib/prisma"));
  ({ createBooking, changeBookingStatus, getMyBookings, getRestaurantBookings } = await import("./booking.service"));
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
  minLeadHours?: number;
  openingHour?: { openTime: string; closeTime: string };
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

  // Wide open hours (00:00-23:00) by default so a slot exists regardless of
  // which real calendar weekday futureDateString(n) lands on.
  await prisma.openingHour.createMany({
    data: Array.from({ length: 7 }, (_, dayOfWeek) => ({
      restaurantId: restaurant.id,
      dayOfWeek,
      openTime: opts.openingHour?.openTime ?? "00:00",
      closeTime: opts.openingHour?.closeTime ?? "23:00",
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
      minLeadHours: opts.minLeadHours ?? 0,
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

async function createTestAdmin() {
  const id = randomUUID();
  await prisma.profile.create({
    data: { id, email: `admin-${id}@test.local`, role: PrismaRole.ADMIN },
  });
  createdProfileIds.push(id);
  return id;
}

function randomBookingCode(): string {
  // Doesn't need to follow production's charset (BOOKING_CODE_CHARS in
  // booking.service.ts) — this bypasses generateBookingCode entirely, it
  // only needs to satisfy the `code` column's unique constraint.
  return `BK${randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

// Inserts a booking directly at an arbitrary status, bypassing createBooking
// — needed to set up changeBookingStatus tests starting from statuses
// createBooking itself can never produce (REJECTED, CANCELLED, CHECKED_IN,
// COMPLETED, NO_SHOW).
async function createTestBooking(
  restaurantId: string,
  customerId: string,
  opts: { status: BookingStatus; date?: string; slotTime?: string; partySize?: number }
) {
  return prisma.booking.create({
    data: {
      restaurantId,
      customerId,
      bookingDate: new Date(`${opts.date ?? futureDateString(2)}T00:00:00.000Z`),
      slotTime: opts.slotTime ?? "12:00",
      partySize: opts.partySize ?? 2,
      code: randomBookingCode(),
      status: opts.status,
    },
  });
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

  // Role is the *highest* privilege a profile holds, not an exclusive
  // account type — an owner is still a person who can go eat somewhere
  // else. createBooking itself never looked at role (only needs a valid
  // customerId), so these lock that in against the route-gate bug (POST
  // /api/bookings previously used requireRoleOrThrow("customer"), which
  // would reject any owner outright before ever reaching this function).
  it("an owner can book at a restaurant they don't own", async () => {
    const ownRestaurant = await createTestRestaurant();
    const otherRestaurant = await createTestRestaurant();

    const result = await createBooking(ownRestaurant.ownerId, {
      restaurantId: otherRestaurant.id,
      date: futureDateString(2),
      slotTime: "12:00",
      partySize: 2,
    });

    expect(result.success).toBe(true);
  });

  it("an owner can book at their own restaurant", async () => {
    const restaurant = await createTestRestaurant();

    const result = await createBooking(restaurant.ownerId, {
      restaurantId: restaurant.id,
      date: futureDateString(2),
      slotTime: "12:00",
      partySize: 2,
    });

    expect(result.success).toBe(true);
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

describe("changeBookingStatus: transition matrix", () => {
  it(
    "enforces ALLOWED_BOOKING_TRANSITIONS exactly, for every (source, target) pair, via a real admin actor",
    async () => {
      // Admin has no role-level target restriction (CUSTOMER_/OWNER_ALLOWED_TARGET_STATUSES
      // don't apply to it), so admin-as-actor isolates just the state-machine
      // check (3) from the role/ownership checks (1, 2) — the same thing
      // booking.state.test.ts already verifies about the static data
      // structure, this verifies changeBookingStatus actually enforces it.
      const restaurant = await createTestRestaurant();
      const customerId = await createTestCustomer();
      const adminId = await createTestAdmin();
      const admin: TestActor = { id: adminId, email: null, role: "admin" };

      const allStatuses = Object.values(BookingStatus);
      let dateOffset = 40;

      const cases = await Promise.all(
        allStatuses.flatMap((source) =>
          allStatuses.map(async (target) => {
            const date = futureDateString(dateOffset++);
            const booking = await createTestBooking(restaurant.id, customerId, { status: source, date });
            const result = await changeBookingStatus(booking.id, admin, target);
            return { source, target, result };
          })
        )
      );

      for (const { source, target, result } of cases) {
        const shouldSucceed = ALLOWED_BOOKING_TRANSITIONS[source].includes(target);
        if (shouldSucceed) {
          expect(result.success, `${source} -> ${target} should be allowed`).toBe(true);
        } else {
          expect(result.success, `${source} -> ${target} should be rejected`).toBe(false);
          if (!result.success) {
            expect(result.error.code, `${source} -> ${target} should be INVALID_STATE`).toBe("INVALID_STATE");
          }
        }
      }
    },
    120_000
  );
});

describe("changeBookingStatus: permissions", () => {
  it("customer requesting CONFIRMED on their own booking is FORBIDDEN", async () => {
    const restaurant = await createTestRestaurant();
    const customerId = await createTestCustomer();
    const booking = await createTestBooking(restaurant.id, customerId, { status: BookingStatus.PENDING });
    const customer: TestActor = { id: customerId, email: null, role: "customer" };

    const result = await changeBookingStatus(booking.id, customer, BookingStatus.CONFIRMED);

    expect(result).toEqual({ success: false, error: { code: "FORBIDDEN", message: expect.any(String) } });
  });

  it("owner of restaurant A cannot manage a booking belonging to restaurant B", async () => {
    const restaurantA = await createTestRestaurant();
    const restaurantB = await createTestRestaurant();
    const customerId = await createTestCustomer();
    const bookingOnB = await createTestBooking(restaurantB.id, customerId, { status: BookingStatus.PENDING });
    const ownerA: TestActor = { id: restaurantA.ownerId, email: null, role: "owner" };

    const result = await changeBookingStatus(bookingOnB.id, ownerA, BookingStatus.CONFIRMED);

    expect(result).toEqual({ success: false, error: { code: "FORBIDDEN", message: expect.any(String) } });
  });

  it("customer cannot cancel someone else's booking", async () => {
    const restaurant = await createTestRestaurant();
    const ownerCustomerId = await createTestCustomer();
    const otherCustomerId = await createTestCustomer();
    const booking = await createTestBooking(restaurant.id, ownerCustomerId, { status: BookingStatus.PENDING });
    const otherCustomer: TestActor = { id: otherCustomerId, email: null, role: "customer" };

    const result = await changeBookingStatus(booking.id, otherCustomer, BookingStatus.CANCELLED);

    expect(result).toEqual({ success: false, error: { code: "FORBIDDEN", message: expect.any(String) } });
  });

  it("customer cancelling within minLeadHours of the slot gets INVALID_STATE", async () => {
    const restaurant = await createTestRestaurant({ minLeadHours: 4 });
    const customerId = await createTestCustomer();

    // 1 hour from the real "now", derived via toBangkokParts so this is
    // correct regardless of the test machine's local timezone and doesn't
    // hit the cross-midnight ambiguity noted in changeBookingStatus (this
    // constructs the fixture from a real instant, not by hand-adding
    // minutes-since-midnight past 1439).
    const nearInstant = new Date(Date.now() + 60 * 60 * 1000);
    const parts = toBangkokParts(nearInstant);
    const bookingDate = new Date(Date.UTC(parts.year, parts.month, parts.day));
    const slotTime = minutesToTimeString(parts.minutesSinceMidnight);

    const booking = await prisma.booking.create({
      data: {
        restaurantId: restaurant.id,
        customerId,
        bookingDate,
        slotTime,
        partySize: 2,
        code: randomBookingCode(),
        status: BookingStatus.PENDING,
      },
    });
    const customer: TestActor = { id: customerId, email: null, role: "customer" };

    const result = await changeBookingStatus(booking.id, customer, BookingStatus.CANCELLED);

    expect(result).toEqual({ success: false, error: { code: "INVALID_STATE", message: expect.any(String) } });
  });

  it("minLeadHours deadline uses the slot's real instant for a cross-midnight opening window, not the wrapped time read literally", async () => {
    // Restaurant open 18:00-02:00 — "01:00" is a wrapped overflow slot that
    // really belongs to the day *after* bookingDate (slot.engine.ts rule 7).
    // The naive (buggy) reading of D's own "01:00" is always exactly 24h
    // earlier than the correct reading (D+1's real 01:00) — same time of
    // day, one calendar day back — regardless of what time it is right
    // now. With bookingDate = today+2, the worst case (test running right
    // before local midnight) still keeps the correct reading's gap-from-now
    // above ~49h and the naive one's below ~27h; minLeadHours=36 sits
    // cleanly between both bounds either way, so this doesn't flake
    // depending on when the suite runs:
    //   - correct (real instant, D+1 01:00): ~49-51h from now -> allowed
    //   - naive (misread as D's own 01:00):   ~25-27h from now -> blocked
    const restaurant = await createTestRestaurant({
      minLeadHours: 36,
      openingHour: { openTime: "18:00", closeTime: "02:00" },
    });
    const customerId = await createTestCustomer();

    const todayParts = toBangkokParts(new Date());
    const bookingDate = new Date(Date.UTC(todayParts.year, todayParts.month, todayParts.day + 2)); // D: 2 days from today
    const slotTime = "01:00"; // wrapped — real instant is D+1's 01:00, ~3 days from today

    const booking = await prisma.booking.create({
      data: {
        restaurantId: restaurant.id,
        customerId,
        bookingDate,
        slotTime,
        partySize: 2,
        code: randomBookingCode(),
        status: BookingStatus.PENDING,
      },
    });
    const customer: TestActor = { id: customerId, email: null, role: "customer" };

    const result = await changeBookingStatus(booking.id, customer, BookingStatus.CANCELLED);

    expect(result.success, "should be allowed — real instant is ~2 days out, well past the 36h deadline").toBe(true);
  });
});

describe("changeBookingStatus: relationship-based permissions (not actor.role)", () => {
  it("an owner who booked at someone else's restaurant can cancel their own booking (previously broken by role-based gating)", async () => {
    const ownRestaurant = await createTestRestaurant();
    const otherRestaurant = await createTestRestaurant();

    const created = await createBooking(ownRestaurant.ownerId, {
      restaurantId: otherRestaurant.id,
      date: futureDateString(20),
      slotTime: "12:00",
      partySize: 2,
    });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const actor: TestActor = { id: ownRestaurant.ownerId, email: null, role: "owner" };
    const result = await changeBookingStatus(created.data.id, actor, BookingStatus.CANCELLED);

    expect(result.success).toBe(true);
  });

  it("an owner who booked at their own restaurant holds both permission sets — union, not either/or", async () => {
    const restaurant = await createTestRestaurant();
    const actor: TestActor = { id: restaurant.ownerId, email: null, role: "owner" };

    const bookingForOwnerAction = await createBooking(restaurant.ownerId, {
      restaurantId: restaurant.id,
      date: futureDateString(21),
      slotTime: "12:00",
      partySize: 2,
    });
    const bookingForCustomerAction = await createBooking(restaurant.ownerId, {
      restaurantId: restaurant.id,
      date: futureDateString(22),
      slotTime: "12:00",
      partySize: 2,
    });
    expect(bookingForOwnerAction.success).toBe(true);
    expect(bookingForCustomerAction.success).toBe(true);
    if (!bookingForOwnerAction.success || !bookingForCustomerAction.success) return;

    // Via the restaurant-owner permission set, on their own booking.
    const confirmResult = await changeBookingStatus(bookingForOwnerAction.data.id, actor, BookingStatus.CONFIRMED);
    expect(confirmResult.success, "restaurant-owner permission set should apply").toBe(true);

    // Via the booking-customer permission set, on a different booking of
    // theirs at the same restaurant — proves both sets are live at once for
    // the same actor, not whichever one gets checked first.
    const cancelResult = await changeBookingStatus(bookingForCustomerAction.data.id, actor, BookingStatus.CANCELLED);
    expect(cancelResult.success, "booking-customer permission set should also apply").toBe(true);
  });

  it(
    "a person with zero relationship to the booking gets FORBIDDEN for every target status, even with an elevated (owner) role elsewhere",
    async () => {
      const restaurant = await createTestRestaurant();
      const customerId = await createTestCustomer();
      const booking = await createTestBooking(restaurant.id, customerId, { status: BookingStatus.PENDING });

      // Owner of a *different*, unrelated restaurant — an elevated role with
      // zero relationship to this specific booking. Proves relationship, not
      // role, is what decides.
      const unrelatedRestaurant = await createTestRestaurant();
      const stranger: TestActor = { id: unrelatedRestaurant.ownerId, email: null, role: "owner" };

      for (const target of Object.values(BookingStatus)) {
        const result = await changeBookingStatus(booking.id, stranger, target);
        expect(result.success, `stranger requesting ${target} should be FORBIDDEN`).toBe(false);
        if (!result.success) {
          expect(result.error.code, `stranger requesting ${target}`).toBe("FORBIDDEN");
        }
      }
    },
    20_000
  );

  it("admin can act on a booking it has zero relationship to", async () => {
    const restaurant = await createTestRestaurant();
    const customerId = await createTestCustomer();
    const booking = await createTestBooking(restaurant.id, customerId, { status: BookingStatus.PENDING });
    const adminId = await createTestAdmin();
    const admin: TestActor = { id: adminId, email: null, role: "admin" };

    const result = await changeBookingStatus(booking.id, admin, BookingStatus.CONFIRMED);

    expect(result.success).toBe(true);
  });
});

describe("changeBookingStatus: cancel-vs-create race", () => {
  it(
    "A cancelling and B creating on a full 2-seat slot, racing, never overbooks — 3 rounds",
    async () => {
      const restaurant = await createTestRestaurant({ capacityPerSlot: 2, maxPartySize: 2 });
      const customerA = await createTestCustomer();
      const customerB = await createTestCustomer();
      const date = futureDateString(4);
      const slotTime = "12:00";
      const actorA: TestActor = { id: customerA, email: null, role: "customer" };

      for (let round = 1; round <= 3; round++) {
        const bookingA = await createTestBooking(restaurant.id, customerA, {
          status: BookingStatus.PENDING,
          date,
          slotTime,
          partySize: 2,
        });

        const [cancelResult, createResult] = await Promise.all([
          changeBookingStatus(bookingA.id, actorA, BookingStatus.CANCELLED),
          createBooking(customerB, { restaurantId: restaurant.id, date, slotTime, partySize: 2 }),
        ]);

        // Cancelling never depends on capacity — it must always succeed
        // regardless of how the race with B resolves.
        expect(cancelResult.success, `round ${round}: A's cancel must always succeed`).toBe(true);

        // Only 2 outcomes are acceptable: B loses the race (SLOT_FULL) or B
        // wins it (success) — anything else (e.g. B succeeding via some
        // other error, or the cancel itself failing) is a bug.
        const bOutcomeValid =
          createResult.success || (!createResult.success && createResult.error.code === "SLOT_FULL");
        expect(bOutcomeValid, `round ${round}: B must either succeed or get SLOT_FULL, nothing else`).toBe(true);

        const after = await prisma.booking.aggregate({
          where: {
            restaurantId: restaurant.id,
            bookingDate: new Date(`${date}T00:00:00.000Z`),
            slotTime,
            status: { in: SEAT_CONSUMING_STATUSES },
          },
          _sum: { partySize: true },
        });
        expect(
          after._sum.partySize ?? 0,
          `round ${round}: SUM(party_size) must not exceed capacity`
        ).toBeLessThanOrEqual(2);

        await prisma.booking.deleteMany({
          where: { restaurantId: restaurant.id, bookingDate: new Date(`${date}T00:00:00.000Z`), slotTime },
        });
      }
    },
    60_000
  );
});

// The literal 1-canceller-vs-1-creator scenario above turned out to be
// race-safe even with changeBookingStatus's advisory lock disabled (see the
// phase report) — a cancel never reads capacity, so it can't cause a
// creator's own internally-consistent read-then-decide to be wrong, no
// matter how the two interleave. This variant actually depends on the lock:
// 1 cancel frees exactly 2 seats, and *15 concurrent creators* all try to
// take them — that reintroduces the create-vs-create race the lock exists
// for (phase 1), just gated behind a cancel instead of an empty slot. Fewer
// concurrent creators (tried 2, then 6) didn't reliably reproduce a failure
// even with both locks disabled — the preceding cancel naturally staggers
// creators' reads just enough that low concurrency rarely lands two of them
// in the danger window together. 15 did, reliably, once verified (see the
// phase report for the disabled-lock run that produced 2 and 4 winners).
describe("changeBookingStatus: cancel freeing seats concurrent creators race for", () => {
  it(
    "at most 1 of 15 concurrent creators wins the 2 seats A's cancel frees — 3 rounds",
    async () => {
      const restaurant = await createTestRestaurant({ capacityPerSlot: 2, maxPartySize: 2 });
      const customerA = await createTestCustomer();
      const otherCustomers = await Promise.all(Array.from({ length: 15 }, () => createTestCustomer()));
      const date = futureDateString(5);
      const slotTime = "12:00";
      const actorA: TestActor = { id: customerA, email: null, role: "customer" };

      for (let round = 1; round <= 3; round++) {
        const bookingA = await createTestBooking(restaurant.id, customerA, {
          status: BookingStatus.PENDING,
          date,
          slotTime,
          partySize: 2,
        });

        const [cancelResult, ...createResults] = await Promise.all([
          changeBookingStatus(bookingA.id, actorA, BookingStatus.CANCELLED),
          ...otherCustomers.map((customerId) =>
            createBooking(customerId, { restaurantId: restaurant.id, date, slotTime, partySize: 2 })
          ),
        ]);

        expect(cancelResult.success, `round ${round}: A's cancel must always succeed`).toBe(true);

        const winners = createResults.filter((r) => r.success);
        expect(winners.length, `round ${round}: at most 1 of 15 concurrent creators may win the 2 freed seats`).toBeLessThanOrEqual(1);

        const after = await prisma.booking.aggregate({
          where: {
            restaurantId: restaurant.id,
            bookingDate: new Date(`${date}T00:00:00.000Z`),
            slotTime,
            status: { in: SEAT_CONSUMING_STATUSES },
          },
          _sum: { partySize: true },
        });
        expect(
          after._sum.partySize ?? 0,
          `round ${round}: SUM(party_size) must not exceed capacity`
        ).toBeLessThanOrEqual(2);

        await prisma.booking.deleteMany({
          where: { restaurantId: restaurant.id, bookingDate: new Date(`${date}T00:00:00.000Z`), slotTime },
        });
      }
    },
    60_000
  );
});

describe("getMyBookings", () => {
  it("splits all 7 BookingStatus values into upcoming/history/cancelled correctly", async () => {
    const restaurant = await createTestRestaurant();
    const customerId = await createTestCustomer();

    const statuses = Object.values(BookingStatus);
    let dateOffset = 60;
    for (const status of statuses) {
      await createTestBooking(restaurant.id, customerId, { status, date: futureDateString(dateOffset++) });
    }

    const result = await getMyBookings(customerId);

    const flattened = [...result.upcoming, ...result.history, ...result.cancelled].map((b) => b.status).sort();

    expect(result.upcoming.map((b) => b.status).sort()).toEqual(
      [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN].sort()
    );
    expect(result.history.map((b) => b.status).sort()).toEqual(
      [BookingStatus.COMPLETED, BookingStatus.NO_SHOW].sort()
    );
    expect(result.cancelled.map((b) => b.status).sort()).toEqual(
      [BookingStatus.CANCELLED, BookingStatus.REJECTED].sort()
    );
    // Every status landed in exactly one bucket — no overlap, nothing missing.
    expect(flattened).toEqual(statuses.slice().sort());
  });
});

describe("getRestaurantBookings", () => {
  it("owner of a different restaurant gets FORBIDDEN", async () => {
    const restaurantA = await createTestRestaurant();
    const restaurantB = await createTestRestaurant();

    const result = await getRestaurantBookings(restaurantA.id, restaurantB.ownerId);

    expect(result).toEqual({ success: false, error: { code: "FORBIDDEN", message: expect.any(String) } });
  });

  it("returns the restaurant's own bookings sorted by slotTime", async () => {
    const restaurant = await createTestRestaurant();
    const customerId = await createTestCustomer();
    const date = futureDateString(70);

    // Inserted out of order on purpose.
    await createTestBooking(restaurant.id, customerId, { status: BookingStatus.PENDING, date, slotTime: "15:00" });
    await createTestBooking(restaurant.id, customerId, { status: BookingStatus.PENDING, date, slotTime: "09:00" });
    await createTestBooking(restaurant.id, customerId, { status: BookingStatus.PENDING, date, slotTime: "12:00" });

    const result = await getRestaurantBookings(restaurant.id, restaurant.ownerId, date);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.map((b) => b.slotTime)).toEqual(["09:00", "12:00", "15:00"]);
  });
});

describe("changeBookingStatus: statusReason persistence", () => {
  it("stores the reason on REJECTED", async () => {
    const restaurant = await createTestRestaurant();
    const customerId = await createTestCustomer();
    const booking = await createTestBooking(restaurant.id, customerId, { status: BookingStatus.PENDING });
    const owner: TestActor = { id: restaurant.ownerId, email: null, role: "owner" };

    const result = await changeBookingStatus(booking.id, owner, BookingStatus.REJECTED, "โต๊ะเต็มแล้วช่วงนั้น");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.statusReason).toBe("โต๊ะเต็มแล้วช่วงนั้น");
  });

  it("stores the reason on customer CANCELLED", async () => {
    const restaurant = await createTestRestaurant();
    const customerId = await createTestCustomer();
    const booking = await createTestBooking(restaurant.id, customerId, {
      status: BookingStatus.PENDING,
      date: futureDateString(10),
    });
    const customer: TestActor = { id: customerId, email: null, role: "customer" };

    const result = await changeBookingStatus(booking.id, customer, BookingStatus.CANCELLED, "เปลี่ยนแผน");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.statusReason).toBe("เปลี่ยนแผน");
  });

  it("does not store a reason on a transition that isn't REJECTED/CANCELLED", async () => {
    const restaurant = await createTestRestaurant();
    const customerId = await createTestCustomer();
    const booking = await createTestBooking(restaurant.id, customerId, { status: BookingStatus.PENDING });
    const owner: TestActor = { id: restaurant.ownerId, email: null, role: "owner" };

    const result = await changeBookingStatus(booking.id, owner, BookingStatus.CONFIRMED, "this should be ignored");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.statusReason).toBeNull();
  });
});
