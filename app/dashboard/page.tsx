import Link from "next/link";
import { getProfile } from "@/lib/dal";
import * as bookingService from "@/modules/booking/booking.service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { BookingCard } from "@/components/booking-card";
import { MESSAGES, ROLE_LABELS_TH } from "@/constants/messages";
import { cn } from "@/lib/utils";

const DASHBOARD_UPCOMING_COUNT = 3;

export default async function DashboardPage() {
  const profile = await getProfile();
  const { upcoming } = await bookingService.getMyBookings(profile.id, { pageSize: DASHBOARD_UPCOMING_COUNT });

  return (
    <div className="mx-auto flex max-w-2xl flex-1 flex-col gap-6 bg-canvas px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-heading text-xl font-semibold text-ink">{MESSAGES.dashboard.greeting(profile.email ?? "")}</h1>
          <Badge variant="secondary" className="mt-1">
            {ROLE_LABELS_TH[profile.role] ?? profile.role}
          </Badge>
        </div>
        <Link href="/restaurants" className={cn(buttonVariants({ size: "lg" }))}>
          {MESSAGES.nav.searchRestaurants}
        </Link>
      </div>

      {profile.role === "owner" && (
        <Link
          href="/owner/dashboard"
          className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
        >
          {MESSAGES.dashboard.manageMyRestaurants}
        </Link>
      )}

      {profile.role === "admin" && (
        <Link href="/admin" className={cn(buttonVariants({ variant: "outline" }), "w-fit")}>
          {MESSAGES.nav.adminPanel}
        </Link>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-base font-semibold text-ink">
            {MESSAGES.booking.upcomingBookingsTitle}
          </h2>
          {upcoming.length > 0 && (
            <Link href="/bookings/my" className="text-sm font-medium text-gold hover:underline">
              {MESSAGES.booking.viewAllBookings}
            </Link>
          )}
        </div>

        {upcoming.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
              <p className="font-medium text-ink">{MESSAGES.booking.emptyUpcoming}</p>
              <p className="text-sm text-ink-soft">{MESSAGES.booking.emptyBookingsHint}</p>
              <Link href="/restaurants" className={cn(buttonVariants({ variant: "outline" }), "mt-2")}>
                {MESSAGES.nav.searchRestaurants}
              </Link>
            </CardContent>
          </Card>
        ) : (
          upcoming.map((booking) => <BookingCard key={booking.id} booking={booking} />)
        )}
      </div>
    </div>
  );
}
