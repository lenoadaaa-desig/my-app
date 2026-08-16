"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BookingCard } from "@/components/booking-card";
import { MESSAGES, ERROR_MESSAGES_TH, MONTH_SHORT_TH } from "@/constants/messages";
import { calendarDayOfWeek } from "@/lib/datetime";
import { computeSlotInstant } from "@/modules/booking/slot.engine";
import { ALLOWED_BOOKING_TRANSITIONS } from "@/modules/booking/booking.state";
import { cn } from "@/lib/utils";
import type { MyBookings, MyBooking } from "@/modules/booking/booking.service";

type ApiError = { code: string; message: string };
type ApiResult<T> = { success: true; data: T } | { success: false; error: ApiError };

function errorText(err: ApiError): string {
  return ERROR_MESSAGES_TH[err.code as keyof typeof ERROR_MESSAGES_TH] ?? MESSAGES.common.errorGeneric;
}

// Client-side prediction only, purely to decide whether the cancel button
// is even tappable — modules/booking/booking.service.ts's
// changeBookingStatus re-checks both the transition graph and the
// minLeadHours deadline for real inside a locked transaction and is the
// only outcome that actually matters. Reuses the same
// ALLOWED_BOOKING_TRANSITIONS and computeSlotInstant the server uses so
// this can't silently drift from what the server would actually decide.
function canCancelNow(booking: MyBooking, now: number): boolean {
  if (!ALLOWED_BOOKING_TRANSITIONS[booking.status].includes("CANCELLED")) {
    return false;
  }
  const dayOfWeek = calendarDayOfWeek(booking.bookingDate);
  const openingHour = booking.restaurant.openingHours.find((h) => h.dayOfWeek === dayOfWeek);
  const minLeadHours = booking.restaurant.bookingSetting?.minLeadHours ?? 0;
  const slotInstant = computeSlotInstant(
    booking.bookingDate,
    openingHour ?? { openTime: "00:00", closeTime: "00:00" },
    booking.slotTime
  );
  return slotInstant.getTime() - now >= minLeadHours * 60 * 60_000;
}

function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg bg-surface px-4 py-12 text-center">
      <p className="font-medium text-ink">{title}</p>
      {hint && (
        <>
          <p className="text-sm text-ink-soft">{hint}</p>
          <Link href="/restaurants" className={cn(buttonVariants({ variant: "outline" }), "mt-2")}>
            {MESSAGES.nav.searchRestaurants}
          </Link>
        </>
      )}
    </div>
  );
}

const NOW_TICK_INTERVAL_MS = 30_000;

export function MyBookingsView({ initialData }: { initialData: MyBookings }) {
  const [data, setData] = useState(initialData);
  const [cancelTarget, setCancelTarget] = useState<MyBooking | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<ApiError | null>(null);
  // Date.now() can't be called directly during render (React's purity
  // rules) — captured as state instead, refreshed periodically so a page
  // left open doesn't let the cancel button stay enabled past its real
  // deadline. Same idiom as app/restaurants/[id]/booking-box.tsx's nowTick.
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), NOW_TICK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  async function confirmCancel() {
    if (!cancelTarget || cancelling) return;
    setCancelling(true);
    setCancelError(null);

    try {
      const res = await fetch(`/api/bookings/${cancelTarget.id}/cancel`, { method: "PATCH" });
      const result = (await res.json()) as ApiResult<{ id: string }>;

      if (!result.success) {
        setCancelError(result.error);
        return;
      }

      // The endpoint only ever transitions to CANCELLED (see
      // app/api/bookings/[id]/cancel/route.ts) — no need to round-trip the
      // response's own status field back through the BookingStatus type.
      setData((prev) => ({
        upcoming: prev.upcoming.filter((b) => b.id !== cancelTarget.id),
        history: prev.history,
        cancelled: [{ ...cancelTarget, status: "CANCELLED" }, ...prev.cancelled],
      }));
      setCancelTarget(null);
    } catch {
      setCancelError({ code: "", message: MESSAGES.common.errorGeneric });
    } finally {
      setCancelling(false);
    }
  }

  return (
    <>
      <Tabs defaultValue="upcoming">
        <TabsList className="w-full">
          <TabsTrigger value="upcoming">{MESSAGES.booking.tabUpcoming}</TabsTrigger>
          <TabsTrigger value="history">{MESSAGES.booking.tabHistory}</TabsTrigger>
          <TabsTrigger value="cancelled">{MESSAGES.booking.tabCancelled}</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-3 flex flex-col gap-3">
          {data.upcoming.length === 0 ? (
            <EmptyState title={MESSAGES.booking.emptyUpcoming} hint={MESSAGES.booking.emptyBookingsHint} />
          ) : (
            data.upcoming.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                action={
                  canCancelNow(booking, nowTick) ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-bad"
                      onClick={() => {
                        setCancelError(null);
                        setCancelTarget(booking);
                      }}
                    >
                      {MESSAGES.booking.cancelButton}
                    </Button>
                  ) : undefined
                }
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-3 flex flex-col gap-3">
          {data.history.length === 0 ? (
            <EmptyState title={MESSAGES.booking.emptyHistory} />
          ) : (
            data.history.map((booking) => <BookingCard key={booking.id} booking={booking} />)
          )}
        </TabsContent>

        <TabsContent value="cancelled" className="mt-3 flex flex-col gap-3">
          {data.cancelled.length === 0 ? (
            <EmptyState title={MESSAGES.booking.emptyCancelled} />
          ) : (
            data.cancelled.map((booking) => <BookingCard key={booking.id} booking={booking} />)
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{MESSAGES.booking.cancelDialogTitle}</AlertDialogTitle>
            {cancelTarget && (
              <AlertDialogDescription>
                {MESSAGES.booking.cancelDialogDescription(
                  cancelTarget.restaurant.name,
                  cancelTarget.bookingDate.getUTCDate(),
                  MONTH_SHORT_TH[cancelTarget.bookingDate.getUTCMonth()],
                  cancelTarget.slotTime
                )}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          {cancelError && <p className="text-center text-sm text-bad">{errorText(cancelError)}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>{MESSAGES.booking.cancelDialogDismiss}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-bad/10 text-bad hover:bg-bad/20"
              disabled={cancelling}
              onClick={(e) => {
                e.preventDefault();
                confirmCancel();
              }}
            >
              {cancelling ? MESSAGES.booking.cancelPending : MESSAGES.booking.cancelDialogConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
