import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/dal";
import * as dashboardService from "@/modules/admin/dashboard.service";
import { MESSAGES } from "@/constants/messages";
import { formatThaiDayMonthParts } from "@/lib/datetime";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { BookingStatusBadge } from "@/components/booking-status-badge";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: MESSAGES.admin.dashboardOverviewTitle };

// dashboard.service.ts's per-day trend is keyed by a "YYYY-MM-DD" string
// (also used as a stable Map key while building the trend, so it isn't a
// Date there) — parse it into the same {month, day} shape
// formatThaiDayMonthParts expects.
function formatDateKey(dateKey: string): string {
  const [, month, day] = dateKey.split("-").map(Number);
  return formatThaiDayMonthParts({ month: month - 1, day });
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

export default async function AdminDashboardPage() {
  await requireRole("admin");

  const [overview, trend, noShow, topByBookings] = await Promise.all([
    dashboardService.getOverviewStats(),
    dashboardService.getBookingTrend(),
    dashboardService.getNoShowStats(),
    dashboardService.getTopRestaurantsByBookingCount(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 bg-canvas px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-heading text-2xl font-semibold text-ink">{MESSAGES.admin.dashboardOverviewTitle}</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            {MESSAGES.admin.manageUsersTitle}
          </Link>
          <Link href="/admin/restaurants" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            {MESSAGES.admin.manageRestaurantsLink}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link href="/admin/restaurants?status=pending">
          <Card>
            <CardContent className="flex flex-col items-center gap-0.5 py-4 text-center">
              <span className="font-heading text-2xl font-semibold text-ink">{overview.pendingRestaurantCount}</span>
              <span className="text-xs text-ink-soft">{MESSAGES.admin.statPendingRestaurants}</span>
            </CardContent>
          </Card>
        </Link>
        <Card>
          <CardContent className="flex flex-col items-center gap-0.5 py-4 text-center">
            <span className="font-heading text-2xl font-semibold text-ink">{overview.activeRestaurantCount}</span>
            <span className="text-xs text-ink-soft">{MESSAGES.admin.statActiveRestaurants}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-0.5 py-4 text-center">
            <span className="font-heading text-2xl font-semibold text-ink">{overview.todayBookingCount}</span>
            <span className="text-xs text-ink-soft">{MESSAGES.admin.statBookingsToday}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-0.5 py-4 text-center">
            <span className="font-heading text-2xl font-semibold text-ink">{overview.totalUserCount}</span>
            <span className="text-xs text-ink-soft">{MESSAGES.admin.statTotalUsers}</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-2">
          <p className="text-sm font-medium text-ink">{MESSAGES.admin.bookingTrendTitle}</p>
          {trend.length === 0 ? (
            <p className="text-sm text-ink-soft">{MESSAGES.admin.bookingTrendEmpty}</p>
          ) : (
            <div className="max-h-80 overflow-y-auto rounded-lg ring-1 ring-gold-dim">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{MESSAGES.admin.bookingTrendColumnDate}</TableHead>
                    <TableHead>{MESSAGES.admin.bookingTrendColumnTotal}</TableHead>
                    <TableHead>{MESSAGES.admin.bookingTrendColumnBreakdown}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...trend].reverse().map((day) => (
                    <TableRow key={day.date}>
                      <TableCell className="text-ink">{formatDateKey(day.date)}</TableCell>
                      <TableCell className="text-ink-soft">{day.total}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(day.byStatus).map(([status, count]) => (
                            <span key={status} className="inline-flex items-center gap-1">
                              <BookingStatusBadge status={status} />
                              <span className="text-xs text-ink-mute">{count}</span>
                            </span>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm font-medium text-ink">{MESSAGES.admin.noShowTitle}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-sm text-ink-soft">{MESSAGES.admin.noShowOverallLabel}:</span>
            {noShow.overallRate === null ? (
              <span className="text-sm text-ink-mute">{MESSAGES.admin.noShowNotEnoughData}</span>
            ) : (
              <span className="font-heading text-xl font-semibold text-ink">{formatPercent(noShow.overallRate)}</span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-ink">{MESSAGES.admin.noShowTopTitle}</p>
            <p className="text-xs text-ink-mute">{MESSAGES.admin.noShowMinBookingsHint(10)}</p>
            {noShow.topRestaurants.length === 0 ? (
              <p className="text-sm text-ink-soft">{MESSAGES.admin.noShowTopEmpty}</p>
            ) : (
              <div className="rounded-lg ring-1 ring-gold-dim">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{MESSAGES.admin.columnRestaurant}</TableHead>
                      <TableHead>{MESSAGES.admin.columnNoShowRate}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {noShow.topRestaurants.map((r) => (
                      <TableRow key={r.restaurantId}>
                        <TableCell>
                          <Link
                            href={`/admin/restaurants/${r.restaurantId}`}
                            className="font-medium text-ink underline-offset-2 hover:underline"
                          >
                            {r.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-ink-soft">
                          {formatPercent(r.rate)} ({r.noShowCount}/{r.qualifyingCount})
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-2">
          <p className="text-sm font-medium text-ink">{MESSAGES.admin.topRestaurantsTitle}</p>
          {topByBookings.length === 0 ? (
            <p className="text-sm text-ink-soft">{MESSAGES.admin.topRestaurantsEmpty}</p>
          ) : (
            <div className="rounded-lg ring-1 ring-gold-dim">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{MESSAGES.admin.columnRestaurant}</TableHead>
                    <TableHead>{MESSAGES.admin.columnBookingCount}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topByBookings.map((r) => (
                    <TableRow key={r.restaurantId}>
                      <TableCell>
                        <Link
                          href={`/admin/restaurants/${r.restaurantId}`}
                          className="font-medium text-ink underline-offset-2 hover:underline"
                        >
                          {r.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-ink-soft">{r.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
