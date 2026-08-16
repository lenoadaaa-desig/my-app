import Link from "next/link";
import { CheckCircle2, XCircle, Clock, Ban } from "lucide-react";
import { getProfile } from "@/lib/dal";
import * as restaurantService from "@/modules/restaurant/restaurant.service";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MESSAGES, RESTAURANT_STATUS_LABELS_TH } from "@/constants/messages";
import { cn } from "@/lib/utils";
import { ResubmitButton } from "./resubmit-button";

function StatusStepper({ status }: { status: string }) {
  const resolved = status !== "PENDING";
  const resultOk = status === "APPROVED";

  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-1 items-center gap-2">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gold text-raised">
          <CheckCircle2 className="size-4" />
        </div>
        <div className="h-0.5 flex-1 bg-gold" />
      </div>
      <div className="flex flex-1 items-center gap-2">
        <div
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full",
            resolved ? "bg-gold text-raised" : "bg-warn/10 text-warn"
          )}
        >
          {resolved ? <CheckCircle2 className="size-4" /> : <Clock className="size-4" />}
        </div>
        <div className={cn("h-0.5 flex-1", resolved ? "bg-gold" : "bg-gold-dim")} />
      </div>
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full",
            !resolved
              ? "bg-surface text-ink-mute"
              : resultOk
                ? "bg-ok/10 text-ok"
                : "bg-bad/10 text-bad"
          )}
        >
          {!resolved ? (
            <span className="text-xs font-medium">3</span>
          ) : resultOk ? (
            <CheckCircle2 className="size-4" />
          ) : status === "SUSPENDED" ? (
            <Ban className="size-4" />
          ) : (
            <XCircle className="size-4" />
          )}
        </div>
      </div>
    </div>
  );
}

export default async function OwnerStatusPage({
  searchParams,
}: PageProps<"/owner/status">) {
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
  const selected =
    restaurants.find((r) => r.id === restaurantId) ?? restaurants[0];

  return (
    <div className="mx-auto flex max-w-lg flex-1 flex-col gap-4 bg-canvas px-4 py-6 sm:px-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{MESSAGES.owner.statusTitle}</h1>

      {restaurants.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-ink">{MESSAGES.owner.selectRestaurantLabel}</p>
          <div className="flex flex-wrap gap-2">
            {restaurants.map((r) => (
              <Link
                key={r.id}
                href={`/owner/status?restaurantId=${r.id}`}
                className={cn(
                  buttonVariants({ variant: r.id === selected.id ? "default" : "outline", size: "sm" })
                )}
              >
                {r.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-ink">{selected.name}</p>
            <Badge variant="secondary">{RESTAURANT_STATUS_LABELS_TH[selected.status]}</Badge>
          </div>

          <StatusStepper status={selected.status} />
          <div className="flex justify-between text-xs text-ink-mute">
            <span>{MESSAGES.owner.statusStepSubmitted}</span>
            <span>{MESSAGES.owner.statusStepReviewing}</span>
            <span>{MESSAGES.owner.statusStepResult}</span>
          </div>

          {selected.status === "PENDING" && (
            <p className="text-sm text-ink-soft">{MESSAGES.owner.statusPendingMessage}</p>
          )}

          {selected.status === "APPROVED" && (
            <>
              <p className="text-sm text-ok">{MESSAGES.owner.statusApprovedMessage}</p>
              <Link href="/dashboard" className={cn(buttonVariants())}>
                {MESSAGES.owner.goToDashboard}
              </Link>
            </>
          )}

          {selected.status === "REJECTED" && (
            <>
              <p className="text-sm text-bad">{MESSAGES.owner.statusRejectedMessage}</p>
              {selected.rejectReason && (
                <p className="rounded-lg bg-surface px-3 py-2 text-sm text-ink">
                  <span className="font-medium">{MESSAGES.owner.rejectReasonLabel}: </span>
                  {selected.rejectReason}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/owner/settings?restaurantId=${selected.id}`}
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  {MESSAGES.owner.editRestaurantInfo}
                </Link>
                <ResubmitButton restaurantId={selected.id} />
              </div>
            </>
          )}

          {selected.status === "SUSPENDED" && (
            <>
              <p className="text-sm text-bad">{MESSAGES.owner.statusSuspendedMessage}</p>
              {selected.rejectReason && (
                <p className="rounded-lg bg-surface px-3 py-2 text-sm text-ink">
                  <span className="font-medium">{MESSAGES.owner.rejectReasonLabel}: </span>
                  {selected.rejectReason}
                </p>
              )}
              <p className="text-sm text-ink-soft">{MESSAGES.owner.suspendedContactAdmin}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
