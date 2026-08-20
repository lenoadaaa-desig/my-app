import Link from "next/link";
import { notFound } from "next/navigation";
import { UtensilsCrossed, ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/dal";
import * as restaurantService from "@/modules/restaurant/restaurant.service";
import * as adminService from "@/modules/admin/admin.service";
import { listRestaurantsQuerySchema } from "@/modules/admin/admin.schema";
import { toBangkokParts } from "@/lib/datetime";
import { MESSAGES, DAY_OF_WEEK_LABELS_TH, MONTH_SHORT_TH } from "@/constants/messages";
import { RestaurantStatusBadge } from "@/components/restaurant-status-badge";
import { ReviewChecklist } from "./review-checklist";
import { RestaurantReviewActions } from "./review-actions";

function formatDate(instant: Date): string {
  const { year, month, day } = toBangkokParts(instant);
  return `${day} ${MONTH_SHORT_TH[month]} ${year}`;
}

export default async function AdminRestaurantDetailPage({
  params,
  searchParams,
}: PageProps<"/admin/restaurants/[id]">) {
  const profile = await requireRole("admin");
  const { id } = await params;

  const restaurant = await restaurantService.getRestaurantForOwner(id, profile);
  if (!restaurant) {
    notFound();
  }

  const rawFrom = (await searchParams).from;
  const fromParsed = listRestaurantsQuerySchema.safeParse({
    status: Array.isArray(rawFrom) ? rawFrom[0] : rawFrom,
  });
  const backHref = `/admin/restaurants?status=${fromParsed.success ? fromParsed.data.status : "pending"}`;

  const allowedActions = adminService.getAllowedActions(restaurant.status);
  const setting = restaurant.bookingSetting;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 bg-canvas px-4 py-6 sm:px-6">
      <Link
        href={backHref}
        className="flex w-fit items-center gap-1 text-sm text-ink-soft hover:text-ink hover:underline"
      >
        <ChevronLeft className="size-4" />
        {MESSAGES.admin.backToQueue}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-2xl font-semibold text-ink">{restaurant.name}</h1>
          <RestaurantStatusBadge status={restaurant.status} />
        </div>
      </div>

      {restaurant.rejectReason && (
        <div className="flex flex-col gap-1 rounded-xl bg-bad/10 p-4 ring-1 ring-bad/30">
          <p className="text-sm font-medium text-bad">{MESSAGES.admin.previousRejectionTitle}</p>
          <p className="text-sm text-ink">{restaurant.rejectReason}</p>
          <p className="text-xs text-ink-soft">{MESSAGES.admin.previousRejectionHint}</p>
        </div>
      )}

      {restaurant.coverImage?.trim() ? (
        // Arbitrary external URL, no remotePatterns configured for next/image — same as app/restaurants/[id]/page.tsx.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={restaurant.coverImage}
          alt={restaurant.name}
          className="h-48 w-full rounded-xl object-cover"
        />
      ) : (
        <div className="flex h-32 w-full items-center justify-center rounded-xl bg-surface" aria-hidden="true">
          <UtensilsCrossed className="size-10 text-ink-mute" />
        </div>
      )}

      <div className="grid gap-1 rounded-xl bg-raised p-4 text-sm ring-1 ring-gold-dim">
        <p>
          <span className="font-medium text-ink">{MESSAGES.owner.categoryLabel}: </span>
          <span className="text-ink-soft">{restaurant.category}</span>
        </p>
        {restaurant.description && (
          <p>
            <span className="font-medium text-ink">{MESSAGES.owner.descriptionLabel}: </span>
            <span className="text-ink-soft">{restaurant.description}</span>
          </p>
        )}
        {restaurant.address && (
          <p>
            <span className="font-medium text-ink">{MESSAGES.restaurant.addressLabel}: </span>
            <span className="text-ink-soft">{restaurant.address}</span>
          </p>
        )}
        {restaurant.phone && (
          <p>
            <span className="font-medium text-ink">{MESSAGES.restaurant.phoneLabel}: </span>
            <span className="text-ink-soft">{restaurant.phone}</span>
          </p>
        )}
        <p>
          <span className="font-medium text-ink">{MESSAGES.admin.ownerLabel}: </span>
          <span className="text-ink-soft">
            {restaurant.owner.fullName ?? restaurant.owner.email ?? MESSAGES.owner.dashboardNoName}
            {restaurant.owner.email ? ` (${restaurant.owner.email})` : ""}
          </span>
        </p>
        <p>
          <span className="font-medium text-ink">{MESSAGES.admin.columnSubmittedAt}: </span>
          <span className="text-ink-soft">{formatDate(restaurant.createdAt)}</span>
        </p>
      </div>

      <div className="rounded-xl bg-raised ring-1 ring-gold-dim">
        <p className="border-b border-gold-dim px-4 py-3 text-sm font-medium text-ink">
          {MESSAGES.admin.openingHoursTitle}
        </p>
        <dl>
          {restaurant.openingHours.map((hour) => (
            <div
              key={hour.dayOfWeek}
              className="flex items-center justify-between px-4 py-2 text-sm not-last:border-b not-last:border-gold-dim"
            >
              <dt className="text-ink">{DAY_OF_WEEK_LABELS_TH[hour.dayOfWeek]}</dt>
              <dd className={hour.isClosed ? "text-ink-mute" : "text-ink-soft"}>
                {hour.isClosed ? MESSAGES.restaurant.closedLabel : `${hour.openTime} - ${hour.closeTime}`}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="rounded-xl bg-raised ring-1 ring-gold-dim">
        <p className="border-b border-gold-dim px-4 py-3 text-sm font-medium text-ink">
          {MESSAGES.admin.bookingSettingsTitle}
        </p>
        {setting ? (
          <dl>
            {[
              [MESSAGES.admin.slotDurationLabel, `${setting.slotDuration}`],
              [MESSAGES.admin.capacityPerSlotLabel, `${setting.capacityPerSlot}`],
              [MESSAGES.admin.maxPartySizeLabel, `${setting.maxPartySize}`],
              [MESSAGES.admin.advanceDaysLabel, `${setting.advanceDays}`],
              [MESSAGES.admin.minLeadHoursLabel, `${setting.minLeadHours}`],
              [
                MESSAGES.admin.autoConfirmLabel,
                setting.autoConfirm ? MESSAGES.admin.autoConfirmYes : MESSAGES.admin.autoConfirmNo,
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between px-4 py-2 text-sm not-last:border-b not-last:border-gold-dim"
              >
                <dt className="text-ink">{label}</dt>
                <dd className="text-ink-soft">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="px-4 py-3 text-sm text-ink-mute">{MESSAGES.admin.bookingSettingsEmpty}</p>
        )}
      </div>

      <ReviewChecklist />

      <RestaurantReviewActions restaurantId={restaurant.id} allowedActions={allowedActions} />
    </div>
  );
}
