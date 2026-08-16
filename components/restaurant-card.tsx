import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MESSAGES } from "@/constants/messages";
import { calendarDayOfWeek, bangkokToday } from "@/lib/datetime";
import { isOpenNow } from "@/modules/booking/slot.engine";

export type RestaurantCardData = {
  id: string;
  name: string;
  category: string;
  address: string | null;
  coverImage: string | null;
  openingHours: { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }[];
};

export function RestaurantCard({ restaurant }: { restaurant: RestaurantCardData }) {
  const todayDayOfWeek = calendarDayOfWeek(bangkokToday());
  const yesterdayDayOfWeek = (todayDayOfWeek + 6) % 7;
  const todayRow = restaurant.openingHours.find((h) => h.dayOfWeek === todayDayOfWeek);
  const yesterdayRow = restaurant.openingHours.find((h) => h.dayOfWeek === yesterdayDayOfWeek);
  const openNow =
    !!todayRow && !!yesterdayRow ? isOpenNow(todayRow, yesterdayRow, new Date()) : false;

  return (
    <Link
      href={`/restaurants/${restaurant.id}`}
      className="flex flex-col overflow-hidden rounded-xl bg-raised ring-1 ring-gold-dim transition-colors hover:ring-gold"
    >
      {/* Image area always reserves the same h-32, whether it holds a real
          photo or the icon placeholder, so cards without a coverImage stay
          exactly as tall as ones with one in the grid. .trim() guards
          against an empty (not just null) string ever reaching <img src>. */}
      {restaurant.coverImage?.trim() ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary external URL, see app/restaurants/[id]/page.tsx
        <img src={restaurant.coverImage} alt={restaurant.name} className="h-32 w-full object-cover" />
      ) : (
        <div className="flex h-32 w-full items-center justify-center bg-surface" aria-hidden="true">
          <UtensilsCrossed className="size-8 text-ink-mute" />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-start justify-between gap-2">
          {/* Thai vowel/tone marks stack above and below the base
              character and need more vertical room per line than Latin
              text — leading-relaxed keeps them from looking clipped where
              line-clamp forces the 2-line box to a fixed height. */}
          <p className="line-clamp-2 leading-relaxed font-medium text-ink">{restaurant.name}</p>
          <Badge
            className={openNow ? "shrink-0 bg-ok/10 text-ok" : "shrink-0 bg-ink-mute/10 text-ink-mute"}
          >
            {openNow ? MESSAGES.restaurant.openNowLabel : MESSAGES.restaurant.closedNowLabel}
          </Badge>
        </div>
        <Badge variant="secondary" className="w-fit">
          {restaurant.category}
        </Badge>
        {restaurant.address && (
          <p className="line-clamp-1 leading-relaxed text-sm text-ink-soft">{restaurant.address}</p>
        )}
      </div>
    </Link>
  );
}
