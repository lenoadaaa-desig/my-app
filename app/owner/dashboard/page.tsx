import Link from "next/link";
import { RestaurantStatus } from "@prisma/client";
import { getProfile } from "@/lib/dal";
import * as restaurantService from "@/modules/restaurant/restaurant.service";
import * as bookingService from "@/modules/booking/booking.service";
import { bangkokToday, formatCalendarDateString } from "@/lib/datetime";
import { buttonVariants } from "@/components/ui/button";
import { RestaurantStatusBadge } from "@/components/restaurant-status-badge";
import { MESSAGES } from "@/constants/messages";
import { cn } from "@/lib/utils";
import { DashboardView } from "./dashboard-view";

export default async function OwnerDashboardPage({
  searchParams,
}: PageProps<"/owner/dashboard">) {
  const profile = await getProfile();
  const restaurants = await restaurantService.listRestaurantsByOwner(profile.id);

  if (restaurants.length === 0) {
    return (
      <div className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center gap-3 bg-canvas px-4 py-16 text-center">
        <p className="font-medium text-ink">{MESSAGES.owner.noRestaurantsYet}</p>
        <Link href="/owner/register" className={cn(buttonVariants())}>
          {MESSAGES.owner.registerNow}
        </Link>
      </div>
    );
  }

  const { restaurantId, date: rawDate } = await searchParams;
  const selected = restaurants.find((r) => r.id === restaurantId) ?? restaurants[0];
  // Next's generic searchParams type allows a repeated query key to arrive
  // as string[] — normalize to a single value before this is used as a
  // typed `string` anywhere below (service calls, the DashboardView prop).
  const dateParam = Array.isArray(rawDate) ? rawDate[0] : rawDate;
  // "Today" defaults per Bangkok wall-clock (bangkokToday), same definition
  // the booking engine itself uses everywhere else — never the visitor's or
  // server's local timezone.
  const date = dateParam ?? formatCalendarDateString(bangkokToday());

  // createBooking rejects any restaurant that isn't APPROVED (see
  // modules/booking/booking.service.ts), but getAvailableSlots itself
  // doesn't know or care about approval status — it only reasons about
  // opening hours/capacity/existing bookings. Left unchecked here, a
  // REJECTED/PENDING/SUSPENDED restaurant would show real-looking open
  // slots ("21:00 เหลือ 40 ที่") that no customer can actually book,
  // making the owner think the restaurant is live and wait for
  // reservations that will never come. Skip the fetch entirely rather than
  // fetch-then-hide — it's meaningless data for this restaurant right now.
  const isApproved = selected.status === RestaurantStatus.APPROVED;

  const [bookingsResult, slotsResult] = await Promise.all([
    bookingService.getRestaurantBookings(selected.id, profile.id, date),
    // Reuses the exact same service function GET /api/restaurants/[id]/slots
    // itself calls, rather than this server component fetching its own API
    // route over HTTP — same pattern every other owner/customer page in
    // this project already follows.
    isApproved
      ? bookingService.getAvailableSlots(selected.id, date, profile)
      : Promise.resolve({ success: true as const, data: [] }),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-1 flex-col gap-4 bg-canvas px-4 py-6 sm:px-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{MESSAGES.owner.dashboardTitle}</h1>

      {restaurants.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-ink">{MESSAGES.owner.selectRestaurantLabel}</p>
          <div className="flex flex-wrap gap-2">
            {restaurants.map((r) => (
              <Link
                key={r.id}
                href={`/owner/dashboard?restaurantId=${r.id}&date=${date}`}
                className={cn(
                  buttonVariants({ variant: r.id === selected.id ? "default" : "outline", size: "sm" }),
                  // buttonVariants' base class sets whitespace-nowrap + shrink-0
                  // with no width cap, so a long restaurant name renders at its
                  // full single-line content width — inside a flex-wrap row
                  // that only wraps whole *items* to a new row, not text within
                  // one, an unbounded item like this forces the entire page
                  // wider than the viewport. An explicit max-width gives the
                  // browser something to truncate against, and min-w-0
                  // overrides the flex item's default min-width:auto (which
                  // would otherwise keep it at its content width regardless
                  // of max-width). buttonVariants' own `justify-center`
                  // centers this link's children — fine for short labels,
                  // but combined with truncate's overflow:hidden on a name
                  // wider than max-width, the browser clips *both* ends of
                  // the centered text instead of just the end (confirmed:
                  // was rendering "มคลองบางกอกน้อยสไตล์ครอบครัวสำหรับง", a
                  // slice from the middle of the real name, not the start).
                  // `justify-start` on the truncated span fixes the anchor
                  // to the left so only the end gets cut, like normal text
                  // truncation. line-clamp-1 isn't an option here (see
                  // components/restaurant-card.tsx's own note) — it switches
                  // display to -webkit-box, which would break this link's
                  // own flex layout.
                  "min-w-0 max-w-48 justify-start gap-1.5 sm:max-w-64"
                )}
              >
                <span className="truncate">{r.name}</span>
                {r.status !== RestaurantStatus.APPROVED && (
                  <RestaurantStatusBadge status={r.status} />
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* key resets DashboardView's own local UI state (actingId, the reason
          dialog, actionError) when the restaurant or date actually changes
          — a search-param-only navigation on this same path does NOT
          remount by default (see CLAUDE.md), so without this an error
          banner or an open dialog from the previous restaurant/date could
          still be showing after switching. The core data itself no longer
          needs this: DashboardView reads initialBookings straight from
          props every render instead of copying it into state. */}
      <DashboardView
        key={`${selected.id}-${date}`}
        restaurantId={selected.id}
        date={date}
        isApproved={isApproved}
        initialBookings={bookingsResult.success ? bookingsResult.data : []}
        initialBookingsError={bookingsResult.success ? null : bookingsResult.error.message}
        slots={slotsResult.success ? slotsResult.data : []}
      />
    </div>
  );
}
