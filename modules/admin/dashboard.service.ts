import "server-only";

import { RestaurantStatus, BookingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { bangkokToday, formatCalendarDateString } from "@/lib/datetime";

const TREND_DAYS = 30;

// A restaurant/system with only a handful of qualifying bookings shouldn't
// be able to top the no-show leaderboard off one unlucky booking — a
// single-booking restaurant that gets one no-show would otherwise show a
// meaningless "100%" and rank #1. Applied to the overall system rate too,
// not just the per-restaurant leaderboard: the same distortion risk exists
// system-wide right after launch, when total volume is still low.
const MIN_QUALIFYING_BOOKINGS = 10;

// "Showed up" (COMPLETED, CHECKED_IN) vs "didn't" (NO_SHOW) — the rate's
// denominator. Deliberately excludes PENDING/CONFIRMED (haven't reached
// their appointment time yet, so "did they show up" isn't answerable) and
// REJECTED/CANCELLED (called off ahead of time, never had a chance to be a
// no-show in the first place).
const NO_SHOW_QUALIFYING_STATUSES = [BookingStatus.NO_SHOW, BookingStatus.COMPLETED, BookingStatus.CHECKED_IN];

function daysAgo(days: number): Date {
  return new Date(bangkokToday().getTime() - days * 86_400_000);
}

export type OverviewStats = {
  pendingRestaurantCount: number;
  activeRestaurantCount: number;
  todayBookingCount: number;
  totalUserCount: number;
};

export async function getOverviewStats(): Promise<OverviewStats> {
  const today = bangkokToday();
  const [pendingRestaurantCount, activeRestaurantCount, todayBookingCount, totalUserCount] = await Promise.all([
    prisma.restaurant.count({ where: { status: RestaurantStatus.PENDING } }),
    prisma.restaurant.count({ where: { status: RestaurantStatus.APPROVED } }),
    prisma.booking.count({ where: { bookingDate: today } }),
    prisma.profile.count(),
  ]);
  return { pendingRestaurantCount, activeRestaurantCount, todayBookingCount, totalUserCount };
}

export type BookingTrendDay = {
  date: string; // "YYYY-MM-DD"
  total: number;
  byStatus: Partial<Record<BookingStatus, number>>;
};

// Groups at the DB level (Prisma groupBy -> a single GROUP BY query,
// indexed by Booking(bookingDate, status) — see schema.prisma) rather than
// fetching every booking row and counting in JS. The per-day reshape below
// only touches the already-aggregated result (at most 30 days x 7
// statuses = 210 rows), not raw bookings.
export async function getBookingTrend(days = TREND_DAYS): Promise<BookingTrendDay[]> {
  const cutoff = daysAgo(days);
  const groups = await prisma.booking.groupBy({
    by: ["bookingDate", "status"],
    where: { bookingDate: { gte: cutoff } },
    _count: true,
  });

  const byDate = new Map<string, BookingTrendDay>();
  for (const g of groups) {
    const dateKey = formatCalendarDateString(g.bookingDate);
    let entry = byDate.get(dateKey);
    if (!entry) {
      entry = { date: dateKey, total: 0, byStatus: {} };
      byDate.set(dateKey, entry);
    }
    entry.byStatus[g.status] = g._count;
    entry.total += g._count;
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export type NoShowLeaderboardEntry = {
  restaurantId: string;
  name: string;
  rate: number;
  qualifyingCount: number;
  noShowCount: number;
};

export type NoShowStats = {
  overallRate: number | null; // null = fewer than MIN_QUALIFYING_BOOKINGS system-wide
  overallQualifyingCount: number;
  topRestaurants: NoShowLeaderboardEntry[];
};

export async function getNoShowStats(days = TREND_DAYS): Promise<NoShowStats> {
  const cutoff = daysAgo(days);
  // Single groupBy covering both the overall rate and the leaderboard — the
  // ratio itself is a derived value groupBy can't compute server-side, so
  // this small aggregated result (at most a few restaurants x 3 statuses)
  // is merged/sorted in JS, not raw booking rows.
  const groups = await prisma.booking.groupBy({
    by: ["restaurantId", "status"],
    where: { bookingDate: { gte: cutoff }, status: { in: NO_SHOW_QUALIFYING_STATUSES } },
    _count: true,
  });

  const perRestaurant = new Map<string, { noShow: number; total: number }>();
  for (const g of groups) {
    const entry = perRestaurant.get(g.restaurantId) ?? { noShow: 0, total: 0 };
    entry.total += g._count;
    if (g.status === BookingStatus.NO_SHOW) entry.noShow += g._count;
    perRestaurant.set(g.restaurantId, entry);
  }

  let overallNoShow = 0;
  let overallTotal = 0;
  for (const { noShow, total } of perRestaurant.values()) {
    overallNoShow += noShow;
    overallTotal += total;
  }

  const qualifying = Array.from(perRestaurant.entries())
    .map(([restaurantId, { noShow, total }]) => ({ restaurantId, noShow, total, rate: noShow / total }))
    .filter((r) => r.total >= MIN_QUALIFYING_BOOKINGS)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 5);

  const restaurants = await prisma.restaurant.findMany({
    where: { id: { in: qualifying.map((r) => r.restaurantId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(restaurants.map((r) => [r.id, r.name]));

  return {
    overallRate: overallTotal >= MIN_QUALIFYING_BOOKINGS ? overallNoShow / overallTotal : null,
    overallQualifyingCount: overallTotal,
    topRestaurants: qualifying.map((r) => ({
      restaurantId: r.restaurantId,
      name: nameById.get(r.restaurantId) ?? r.restaurantId,
      rate: r.rate,
      qualifyingCount: r.total,
      noShowCount: r.noShow,
    })),
  };
}

export type TopRestaurantByBookings = { restaurantId: string; name: string; count: number };

export async function getTopRestaurantsByBookingCount(
  days = TREND_DAYS,
  limit = 5
): Promise<TopRestaurantByBookings[]> {
  const cutoff = daysAgo(days);
  // Top-N computed by the DB itself (ORDER BY + LIMIT inside groupBy), not
  // by fetching every restaurant's bookings and sorting in JS.
  const groups = await prisma.booking.groupBy({
    by: ["restaurantId"],
    where: { bookingDate: { gte: cutoff } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: limit,
  });

  const restaurants = await prisma.restaurant.findMany({
    where: { id: { in: groups.map((g) => g.restaurantId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(restaurants.map((r) => [r.id, r.name]));

  return groups.map((g) => ({
    restaurantId: g.restaurantId,
    name: nameById.get(g.restaurantId) ?? g.restaurantId,
    count: g._count.id,
  }));
}
