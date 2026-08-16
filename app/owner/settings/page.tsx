import Link from "next/link";
import { getProfile } from "@/lib/dal";
import * as restaurantService from "@/modules/restaurant/restaurant.service";
import { buttonVariants } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";
import { cn } from "@/lib/utils";
import { OwnerSettingsForm } from "./owner-settings-form";

export default async function OwnerSettingsPage({
  searchParams,
}: PageProps<"/owner/settings">) {
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

  const { restaurantId } = await searchParams;
  const selectedSummary = restaurants.find((r) => r.id === restaurantId) ?? restaurants[0];

  const restaurant = await restaurantService.getRestaurantForOwner(selectedSummary.id, profile);
  if (!restaurant) {
    // Can't actually happen — selectedSummary came from this same owner's
    // own list — but getRestaurantForOwner's return type is nullable, so
    // TypeScript needs the branch covered.
    return null;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-1 flex-col gap-4 bg-canvas px-4 py-6 sm:px-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{MESSAGES.owner.settingsTitle}</h1>

      {restaurants.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-ink">{MESSAGES.owner.selectRestaurantLabel}</p>
          <div className="flex flex-wrap gap-2">
            {restaurants.map((r) => (
              <Link
                key={r.id}
                href={`/owner/settings?restaurantId=${r.id}`}
                className={cn(
                  buttonVariants({ variant: r.id === restaurant.id ? "default" : "outline", size: "sm" })
                )}
              >
                {r.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <OwnerSettingsForm restaurant={restaurant} />
    </div>
  );
}
