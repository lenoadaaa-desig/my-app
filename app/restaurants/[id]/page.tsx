import Link from "next/link";
import { getProfileOrNull } from "@/lib/dal";
import * as restaurantService from "@/modules/restaurant/restaurant.service";
import { bangkokToday, calendarDayOfWeek } from "@/lib/datetime";
import { MESSAGES, DAY_OF_WEEK_LABELS_TH } from "@/constants/messages";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BookingBox } from "./booking-box";

export default async function RestaurantDetailPage({
  params,
}: PageProps<"/restaurants/[id]">) {
  const { id } = await params;

  const viewer = await getProfileOrNull();
  const restaurant = await restaurantService.getRestaurantById(id, viewer);

  if (!restaurant) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-canvas px-4 py-16 text-center">
        <p className="text-lg font-medium text-ink">{MESSAGES.restaurant.notFound}</p>
        <Link href="/restaurants" className={cn(buttonVariants({ variant: "outline" }))}>
          {MESSAGES.restaurant.backToList}
        </Link>
      </div>
    );
  }

  const todayDayOfWeek = calendarDayOfWeek(bangkokToday());

  return (
    <div className="flex-1 bg-canvas">
      {restaurant.coverImage ? (
        // Arbitrary external URL, no remotePatterns configured for next/image yet.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={restaurant.coverImage}
          alt={restaurant.name}
          className="h-48 w-full object-cover sm:h-64"
        />
      ) : (
        <div className="h-32 w-full bg-surface sm:h-40" aria-hidden="true" />
      )}

      <div className="mx-auto grid max-w-3xl gap-6 px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold text-ink">{restaurant.name}</h1>
            <Badge variant="secondary">{restaurant.category}</Badge>
          </div>
          {restaurant.description && (
            <p className="text-sm text-ink-soft">{restaurant.description}</p>
          )}
        </div>

        <div className="grid gap-1 text-sm text-ink-soft">
          {restaurant.address && (
            <p>
              <span className="font-medium text-ink">{MESSAGES.restaurant.addressLabel}: </span>
              {restaurant.address}
            </p>
          )}
          {restaurant.phone && (
            <p>
              <span className="font-medium text-ink">{MESSAGES.restaurant.phoneLabel}: </span>
              {restaurant.phone}
            </p>
          )}
        </div>

        <div>
          <h2 className="mb-2 font-heading text-base font-semibold text-ink">
            {MESSAGES.restaurant.openingHoursTitle}
          </h2>
          <dl className="overflow-hidden rounded-xl ring-1 ring-gold-dim">
            {restaurant.openingHours.map((hour) => (
              <div
                key={hour.dayOfWeek}
                className={`flex items-center justify-between px-4 py-2 text-sm not-last:border-b not-last:border-gold-dim ${
                  hour.dayOfWeek === todayDayOfWeek ? "bg-surface" : "bg-raised"
                }`}
              >
                <dt className="text-ink">{DAY_OF_WEEK_LABELS_TH[hour.dayOfWeek]}</dt>
                <dd className={hour.isClosed ? "text-ink-mute" : "text-ink-soft"}>
                  {hour.isClosed
                    ? MESSAGES.restaurant.closedLabel
                    : `${hour.openTime} - ${hour.closeTime}`}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <BookingBox
          restaurantId={restaurant.id}
          restaurantStatus={restaurant.status}
          openingHours={restaurant.openingHours}
          isLoggedIn={viewer !== null}
        />
      </div>
    </div>
  );
}
