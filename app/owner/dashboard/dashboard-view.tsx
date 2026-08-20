"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { BookingStatus } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BookingStatusBadge } from "@/components/booking-status-badge";
import { MESSAGES, ERROR_MESSAGES_TH } from "@/constants/messages";
import { ALLOWED_BOOKING_TRANSITIONS, OWNER_ALLOWED_TARGET_STATUSES } from "@/modules/booking/booking.state";
import type { RestaurantBooking } from "@/modules/booking/booking.service";
import type { Slot } from "@/modules/booking/slot.engine";

type ApiError = { code: string; message: string };
type ApiResult<T> = { success: true; data: T } | { success: false; error: ApiError };

function errorText(err: ApiError): string {
  return ERROR_MESSAGES_TH[err.code as keyof typeof ERROR_MESSAGES_TH] ?? MESSAGES.common.errorGeneric;
}

// Which next statuses a restaurant owner may move a booking to from here —
// the intersection of ALLOWED_BOOKING_TRANSITIONS (is the move legal in the
// domain at all) and OWNER_ALLOWED_TARGET_STATUSES (does the *owner*
// relationship grant this specific target), the exact same two checks
// changeBookingStatus itself composes server-side (booking.service.ts).
// Composing the two existing exported rules here isn't a new rule — it's
// what keeps the button list from ever offering something the server would
// then reject.
function allowedTargetsFor(status: BookingStatus): BookingStatus[] {
  return ALLOWED_BOOKING_TRANSITIONS[status].filter((target) => OWNER_ALLOWED_TARGET_STATUSES.includes(target));
}

// Both require a mandatory reason from the owner (changeBookingStatus
// enforces this server-side too — see booking.service.ts's step 4) since
// neither is the booking's own customer acting: REJECTED means the
// restaurant declined it, CANCELLED (owner-initiated) means the customer
// backed out and someone needs a record of why/how they were told.
const REASON_REQUIRED_STATUSES: BookingStatus[] = ["REJECTED", "CANCELLED"];

const ACTION_LABELS: Partial<Record<BookingStatus, string>> = {
  CONFIRMED: MESSAGES.owner.dashboardConfirmAction,
  REJECTED: MESSAGES.owner.dashboardRejectAction,
  CANCELLED: MESSAGES.owner.dashboardCancelAction,
  CHECKED_IN: MESSAGES.owner.dashboardCheckInAction,
  NO_SHOW: MESSAGES.owner.dashboardNoShowAction,
  COMPLETED: MESSAGES.owner.dashboardCompleteAction,
};

const REASON_DIALOG_TEXT: Partial<Record<BookingStatus, { title: string; reasonLabel: string; confirm: string }>> = {
  REJECTED: {
    title: MESSAGES.owner.dashboardRejectDialogTitle,
    reasonLabel: MESSAGES.owner.dashboardRejectReasonLabel,
    confirm: MESSAGES.owner.dashboardRejectConfirm,
  },
  CANCELLED: {
    title: MESSAGES.owner.dashboardCancelDialogTitle,
    reasonLabel: MESSAGES.owner.dashboardCancelReasonLabel,
    confirm: MESSAGES.owner.dashboardCancelConfirm,
  },
};

function SlotsOverview({ slots }: { slots: Slot[] }) {
  if (slots.length === 0) {
    return <p className="text-sm text-ink-soft">{MESSAGES.owner.dashboardSlotsEmpty}</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {slots.map((slot) => {
        const full = slot.available <= 0;
        return (
          <div
            key={slot.time}
            className={`flex flex-col items-center rounded-lg border px-2.5 py-1.5 text-xs ${
              full ? "border-bad/30 bg-bad/10 text-bad" : "border-gold-dim bg-surface text-ink"
            }`}
          >
            <span className="font-medium">{slot.time}</span>
            <span>{full ? MESSAGES.booking.slotFullBadge : MESSAGES.booking.slotSeatsRemaining(slot.available)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function DashboardView({
  restaurantId,
  date,
  initialBookings,
  initialBookingsError,
  slots,
}: {
  restaurantId: string;
  date: string;
  initialBookings: RestaurantBooking[];
  initialBookingsError: string | null;
  slots: Slot[];
}) {
  const router = useRouter();
  // One transition covers both "waiting for a server re-render" cases this
  // view has: navigating to a different date, and refreshing after a status
  // change. Both end the same way (Next merges a fresh RSC payload in), so
  // one pending flag driving the same spinner next to the date field is
  // accurate for either.
  const [isRefreshing, startRefresh] = useTransition();
  // actingId only tracks "which button's PATCH request is in flight" — it
  // does NOT hold a copy of booking data. There is deliberately no
  // useState(initialBookings) here: this component renders `initialBookings`
  // directly on every render. A client-side navigation to a different
  // restaurantId/date (the selector <Link>, or handleDateChange below) re-
  // runs page.tsx on the server and hands down a fresh `initialBookings`
  // prop; reading it directly means there is no local copy that could ever
  // fall out of sync with it — the exact bug this replaced (see CLAUDE.md).
  const [actingId, setActingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const [reasonDialog, setReasonDialog] = useState<{ booking: RestaurantBooking; targetStatus: BookingStatus } | null>(
    null
  );
  const [reasonText, setReasonText] = useState("");
  const [reasonSubmitError, setReasonSubmitError] = useState<string | null>(null);
  // See CLAUDE.md's note on why a same-tick double click needs a ref, not
  // state, to block a second in-flight request — `actingId` alone (state)
  // isn't enough.
  const actingRef = useRef<string | null>(null);

  function handleDateChange(nextDate: string) {
    if (!nextDate) return;
    startRefresh(() => {
      router.push(`/owner/dashboard?restaurantId=${restaurantId}&date=${nextDate}`);
    });
  }

  async function applyStatusChange(bookingId: string, nextStatus: BookingStatus, reason?: string) {
    if (actingRef.current) return;
    actingRef.current = bookingId;
    setActingId(bookingId);
    setActionError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, reason }),
      });
      const result = (await res.json()) as ApiResult<{ statusReason: string | null }>;
      if (!result.success) {
        setActionError(result.error);
        return false;
      }
      // Single source of truth: the mutation already succeeded server-side,
      // so ask the server for the real current state instead of hand-
      // patching a local copy to guess at it. router.refresh() re-runs
      // page.tsx (getRestaurantBookings/getAvailableSlots) and merges the
      // new props in — same path as any other navigation, no separate
      // "apply this one field change locally" logic to keep correct.
      startRefresh(() => {
        router.refresh();
      });
      return true;
    } catch {
      setActionError({ code: "", message: MESSAGES.common.errorGeneric });
      return false;
    } finally {
      actingRef.current = null;
      setActingId(null);
    }
  }

  function openReasonDialog(booking: RestaurantBooking, targetStatus: BookingStatus) {
    setReasonSubmitError(null);
    setReasonText("");
    setReasonDialog({ booking, targetStatus });
  }

  async function confirmReasonAction() {
    if (!reasonDialog) return;
    if (!reasonText.trim()) {
      setReasonSubmitError(MESSAGES.owner.dashboardRejectReasonRequired);
      return;
    }
    setReasonSubmitError(null);
    const ok = await applyStatusChange(reasonDialog.booking.id, reasonDialog.targetStatus, reasonText.trim());
    if (ok) {
      setReasonDialog(null);
      setReasonText("");
    }
  }

  const totalCount = initialBookings.length;
  const totalSeats = initialBookings.reduce((sum, b) => sum + b.partySize, 0);
  const pendingCount = initialBookings.filter((b) => b.status === BookingStatus.PENDING).length;
  const noShowCount = initialBookings.filter((b) => b.status === BookingStatus.NO_SHOW).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dashboard-date">{MESSAGES.owner.dashboardDateLabel}</Label>
        <div className="flex items-center gap-2">
          <Input
            id="dashboard-date"
            type="date"
            value={date}
            onChange={(e) => handleDateChange(e.target.value)}
            className="w-fit"
          />
          {isRefreshing && <Loader2 className="size-4 animate-spin text-ink-mute" />}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: MESSAGES.owner.dashboardStatBookings, value: totalCount },
          { label: MESSAGES.owner.dashboardStatSeats, value: totalSeats },
          { label: MESSAGES.owner.dashboardStatPending, value: pendingCount },
          { label: MESSAGES.owner.dashboardStatNoShow, value: noShowCount },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex flex-col items-center gap-0.5 py-3 text-center">
              <span className="font-heading text-xl font-semibold text-ink">{stat.value}</span>
              <span className="text-xs text-ink-soft">{stat.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-2">
          <p className="text-sm font-medium text-ink">{MESSAGES.owner.dashboardSlotsTitle}</p>
          <SlotsOverview slots={slots} />
        </CardContent>
      </Card>

      {actionError && <p className="text-sm text-bad">{errorText(actionError)}</p>}

      {initialBookingsError ? (
        <p className="text-sm text-bad">{initialBookingsError}</p>
      ) : initialBookings.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg bg-surface px-4 py-12 text-center">
          <p className="font-medium text-ink">{MESSAGES.owner.dashboardEmptyTitle}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {initialBookings.map((booking) => {
            const targets = allowedTargetsFor(booking.status);
            const isActing = actingId === booking.id;

            return (
              <Card key={booking.id}>
                <CardContent className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-ink">{booking.slotTime}</p>
                    <BookingStatusBadge status={booking.status} />
                  </div>
                  <p className="text-sm text-ink">
                    {booking.customer.fullName ?? booking.customer.email ?? MESSAGES.owner.dashboardNoName}
                  </p>
                  <p className="text-sm text-ink-soft">{booking.customer.phone ?? MESSAGES.owner.dashboardNoPhone}</p>
                  <p className="text-sm text-ink-soft">{MESSAGES.booking.partySizeCount(booking.partySize)}</p>
                  {booking.customerNote && (
                    <p className="text-sm text-ink-soft">
                      <span className="font-medium">{MESSAGES.owner.dashboardNoteLabel}: </span>
                      {booking.customerNote}
                    </p>
                  )}
                  <p className="text-xs text-ink-mute">
                    {MESSAGES.booking.codeLabel}: <span className="font-medium tracking-wide">{booking.code}</span>
                  </p>

                  {targets.length > 0 && (
                    <div className="mt-1 flex flex-wrap justify-end gap-2">
                      {targets.map((target) => (
                        <Button
                          key={target}
                          type="button"
                          size="sm"
                          variant="outline"
                          className={REASON_REQUIRED_STATUSES.includes(target) ? "text-bad" : undefined}
                          disabled={isActing}
                          onClick={() => {
                            if (REASON_REQUIRED_STATUSES.includes(target)) {
                              openReasonDialog(booking, target);
                            } else {
                              applyStatusChange(booking.id, target);
                            }
                          }}
                        >
                          {isActing ? (
                            <>
                              <Loader2 className="animate-spin" />
                              {MESSAGES.owner.dashboardActionPending}
                            </>
                          ) : (
                            ACTION_LABELS[target]
                          )}
                        </Button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog
        open={reasonDialog !== null}
        onOpenChange={(open) => {
          if (!open && actingId === null) setReasonDialog(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {reasonDialog && REASON_DIALOG_TEXT[reasonDialog.targetStatus]?.title}
            </AlertDialogTitle>
            {reasonDialog && (
              <AlertDialogDescription>
                {reasonDialog.booking.slotTime} ·{" "}
                {reasonDialog.booking.customer.fullName ?? MESSAGES.owner.dashboardNoName}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reason-text">
              {reasonDialog && REASON_DIALOG_TEXT[reasonDialog.targetStatus]?.reasonLabel}
            </Label>
            <Textarea
              id="reason-text"
              value={reasonText}
              onChange={(e) => {
                setReasonText(e.target.value);
                setReasonSubmitError(null);
              }}
              rows={3}
            />
            {reasonSubmitError && <p className="text-sm text-bad">{reasonSubmitError}</p>}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={actingId !== null}>{MESSAGES.owner.confirmDialogCancel}</AlertDialogCancel>
            <Button
              type="button"
              className="bg-bad/10 text-bad hover:bg-bad/20"
              disabled={actingId !== null}
              onClick={confirmReasonAction}
            >
              {actingId !== null
                ? MESSAGES.owner.dashboardActionPending
                : reasonDialog && REASON_DIALOG_TEXT[reasonDialog.targetStatus]?.confirm}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
