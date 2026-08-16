"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Minus, Plus, Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { BookingStatusBadge } from "@/components/booking-status-badge";
import { MESSAGES, ERROR_MESSAGES_TH, DAY_OF_WEEK_SHORT_TH, MONTH_SHORT_TH } from "@/constants/messages";
import {
  bangkokToday,
  calendarDayOfWeek,
  calendarDaysBetween,
  calendarDateParts,
  formatCalendarDateString,
  parseCalendarDateString,
} from "@/lib/datetime";
import { computeSlotInstant, resolveSlotBookability, type Slot } from "@/modules/booking/slot.engine";
import { cn } from "@/lib/utils";

type OpeningHourRow = { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean };

type BookingBoxProps = {
  restaurantId: string;
  restaurantStatus: string;
  openingHours: OpeningHourRow[];
  isLoggedIn: boolean;
};

type ApiError = { code: string; message: string };
type ApiResult<T> = { success: true; data: T } | { success: false; error: ApiError };

type BookingResult = {
  code: string;
  status: string;
  slotTime: string;
  partySize: number;
};

const DATE_CHIP_COUNT = 14;
const NOW_TICK_INTERVAL_MS = 30_000;

function errorText(err: ApiError): string {
  return ERROR_MESSAGES_TH[err.code as keyof typeof ERROR_MESSAGES_TH] ?? MESSAGES.common.errorGeneric;
}

export function BookingBox({ restaurantId, restaurantStatus, openingHours, isLoggedIn }: BookingBoxProps) {
  const today = useMemo(() => bangkokToday(), []);

  const dateOptions = useMemo(() => {
    return Array.from({ length: DATE_CHIP_COUNT }, (_, i) => {
      const date = new Date(today.getTime() + i * 86_400_000);
      return { date, value: formatCalendarDateString(date) };
    });
  }, [today]);

  const [selectedDateValue, setSelectedDateValue] = useState(dateOptions[0].value);
  const [partySize, setPartySize] = useState(2);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [slotsError, setSlotsError] = useState<ApiError | null>(null);
  const [selectedSlotTime, setSelectedSlotTime] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<ApiError | null>(null);
  const [successBooking, setSuccessBooking] = useState<BookingResult | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), NOW_TICK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const selectedDate = parseCalendarDateString(selectedDateValue)!;
  const selectedDayOfWeek = calendarDayOfWeek(selectedDate);
  const openingHourForDay = openingHours.find((h) => h.dayOfWeek === selectedDayOfWeek);
  const isClosedThisDay = openingHourForDay?.isClosed ?? false;

  function fetchSlots(dateValue: string) {
    setSlotsLoading(true);
    setSlotsError(null);
    setSelectedSlotTime(null);

    fetch(`/api/restaurants/${restaurantId}/slots?date=${dateValue}`)
      .then((res) => res.json() as Promise<ApiResult<Slot[]>>)
      .then((result) => {
        if (!result.success) {
          setSlotsError(result.error);
          setSlots(null);
          return;
        }
        setSlots(result.data);
      })
      .catch(() => {
        setSlotsError({ code: "", message: MESSAGES.common.errorGeneric });
        setSlots(null);
      })
      .finally(() => setSlotsLoading(false));
  }

  useEffect(() => {
    // A closed day never fetches — its own branch below in the render
    // short-circuits before the slot grid, so there's nothing to derive
    // from a fetch here.
    if (isClosedThisDay) return;
    // fetchSlots's setSlotsLoading(true)/setSlotsError(null) at its start
    // are the "start of an async operation" idiom React's own docs show
    // for data fetching in an effect (react.dev/learn/you-might-not-need-an-effect
    // — the setBio(null)-before-fetchBio(...).then(...) example), not a
    // synchronous derivation of state from other state. The newer
    // set-state-in-effect compiler rule flags it anyway; adopting Suspense
    // or a fetching library to satisfy it is out of scope here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSlots(selectedDateValue);
    // fetchSlots is a plain function re-created every render (not memoized)
    // purely to read restaurantId/current state at call time — listing it
    // here would refetch on every unrelated re-render instead of only when
    // the selected date (or the closed-day short-circuit) actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDateValue, isClosedThisDay]);

  // Single source of truth for "can this fetched slot actually be booked
  // right now" — shared with modules/booking/booking.service.ts's own
  // capacity/lead-time logic via resolveSlotBookability, so the UI's
  // decision can never drift from the server's. Re-evaluated on every
  // render (partySize/nowTick both feed it), not cached, since either can
  // make a previously-bookable slot stop being bookable.
  function bookabilityOf(slot: Slot) {
    const instant = computeSlotInstant(
      selectedDate,
      openingHourForDay ?? { openTime: "00:00", closeTime: "00:00" },
      slot.time
    );
    return resolveSlotBookability(slot, partySize, instant, new Date(nowTick));
  }

  // Derived, not stored: if the previously-clicked slot is no longer
  // bookable (party size grew past what's left, or time marched past it),
  // it stops counting as "selected" the moment that becomes true — no
  // separate effect needed to go clear selectedSlotTime back to null. This
  // is also what the confirm button and summary line below key off of, not
  // the raw click state.
  const selectedSlot = slots?.find((s) => s.time === selectedSlotTime) ?? null;
  const effectiveSlotTime = selectedSlot && bookabilityOf(selectedSlot).bookable ? selectedSlotTime : null;

  // A returned list that doesn't start at the day's real opening time means
  // generateSlots cut earlier slots (already past, or inside minLeadHours) —
  // without this, "opens 10:00" above next to a grid starting at 13:00
  // reads as a bug, not a lead-time rule.
  const slotsWereFiltered =
    !slotsLoading &&
    !slotsError &&
    !!slots &&
    slots.length > 0 &&
    !!openingHourForDay &&
    slots[0].time !== openingHourForDay.openTime;

  function slotDisplay(slot: Slot): { disabled: boolean; label: string; labelClass: string; timeClass: string } {
    const bookability = bookabilityOf(slot);
    if (bookability.bookable) {
      return {
        disabled: false,
        label: MESSAGES.booking.slotSeatsRemaining(slot.available),
        labelClass: "text-ink-soft",
        timeClass: "text-ink",
      };
    }
    if (bookability.reason === "full") {
      // Kept out of any opacity-affected element — a faded "เต็ม" is easy to
      // misread as still-available. font-semibold plus full-strength text-bad,
      // not muted like the other disabled reasons below.
      return {
        disabled: true,
        label: MESSAGES.booking.slotFullBadge,
        labelClass: "font-semibold text-bad",
        timeClass: "text-ink-mute",
      };
    }
    if (bookability.reason === "past") {
      return {
        disabled: true,
        label: MESSAGES.booking.slotPastBadge,
        labelClass: "text-ink-mute",
        timeClass: "text-ink-mute",
      };
    }
    // insufficient_party_size — short label ("ไม่พอ", not "เหลือ N ที่")
    // deliberately, so it never wraps onto a second line and stretches
    // that one card taller than the rest of the grid.
    return {
      disabled: true,
      label: MESSAGES.booking.slotInsufficientForParty,
      labelClass: "text-ink-mute",
      timeClass: "text-ink-mute",
    };
  }

  async function handleSubmit() {
    if (!effectiveSlotTime || submitting) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          date: selectedDateValue,
          slotTime: effectiveSlotTime,
          partySize,
          ...(note.trim() ? { customerNote: note.trim() } : {}),
        }),
      });
      const result = (await res.json()) as ApiResult<BookingResult>;

      if (!result.success) {
        setSubmitError(result.error);
        if (result.error.code === "SLOT_FULL") {
          fetchSlots(selectedDateValue);
        }
        return;
      }

      setSuccessBooking(result.data);
    } catch {
      setSubmitError({ code: "", message: MESSAGES.common.errorGeneric });
    } finally {
      setSubmitting(false);
    }
  }

  if (successBooking) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm font-medium text-ink-soft">{MESSAGES.booking.bookingSuccessTitle}</p>
          <p className="font-heading text-4xl font-semibold tracking-widest text-gold">
            {successBooking.code}
          </p>
          <BookingStatusBadge status={successBooking.status} />
          <p className="text-sm text-ink-mute">{MESSAGES.booking.bookingSuccessCodeHint}</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => {
                setSuccessBooking(null);
                setSelectedSlotTime(null);
                setNote("");
              }}
            >
              {MESSAGES.booking.bookAnother}
            </Button>
            <Link href="/bookings/my" className={cn(buttonVariants({ variant: "outline" }))}>
              {MESSAGES.booking.viewMyBookings}
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (restaurantStatus !== "APPROVED") {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-ink-soft">
          {MESSAGES.booking.restaurantNotApproved}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-ink">{MESSAGES.booking.selectDateLabel}</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {dateOptions.map(({ date, value }) => {
              const isSelected = value === selectedDateValue;
              const daysAhead = calendarDaysBetween(calendarDateParts(today), calendarDateParts(date));
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelectedDateValue(value)}
                  className={cn(
                    "flex shrink-0 flex-col items-center rounded-lg border-2 px-3 py-1.5 text-sm transition-colors",
                    isSelected
                      ? "border-gold bg-gold-dim text-ink"
                      : "border-transparent bg-surface text-ink-soft hover:border-gold-dim"
                  )}
                >
                  <span className="text-xs">
                    {daysAhead === 0 ? MESSAGES.common.today : DAY_OF_WEEK_SHORT_TH[calendarDayOfWeek(date)]}
                  </span>
                  <span className="font-medium">{date.getUTCDate()}</span>
                </button>
              );
            })}
          </div>
        </div>

        {isClosedThisDay ? (
          <p className="rounded-lg bg-surface px-4 py-6 text-center text-sm text-ink-mute">
            {MESSAGES.booking.slotsEmptyClosed}
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-ink">{MESSAGES.booking.partySizeLabel}</p>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  disabled={partySize <= 1}
                  aria-label={MESSAGES.booking.decreasePartySize}
                  onClick={() => setPartySize((n) => Math.max(1, n - 1))}
                >
                  <Minus />
                </Button>
                <span className="w-6 text-center font-medium text-ink">{partySize}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label={MESSAGES.booking.increasePartySize}
                  onClick={() => setPartySize((n) => n + 1)}
                >
                  <Plus />
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium text-ink">{MESSAGES.booking.selectSlotLabel}</p>
                {slotsWereFiltered && (
                  <p className="text-xs text-ink-mute">{MESSAGES.booking.slotsFilteredNotice}</p>
                )}
              </div>

              {slotsLoading ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {Array.from({ length: 8 }, (_, i) => (
                    <Skeleton key={i} className="h-14 rounded-lg" />
                  ))}
                </div>
              ) : slotsError ? (
                <div className="flex flex-col items-center gap-2 rounded-lg bg-surface px-4 py-6 text-center">
                  <p className="text-sm text-bad">{errorText(slotsError)}</p>
                  <Button variant="outline" size="sm" onClick={() => fetchSlots(selectedDateValue)}>
                    {MESSAGES.common.retry}
                  </Button>
                </div>
              ) : !slots || slots.length === 0 ? (
                <p className="rounded-lg bg-surface px-4 py-6 text-center text-sm text-ink-mute">
                  {MESSAGES.booking.slotsEmptyGeneric}
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((slot) => {
                    const { disabled, label, labelClass, timeClass } = slotDisplay(slot);
                    const isSelected = effectiveSlotTime === slot.time;
                    return (
                      <button
                        key={slot.time}
                        type="button"
                        disabled={disabled}
                        onClick={() => setSelectedSlotTime(slot.time)}
                        className={cn(
                          "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg border-2 px-2 py-2.5 text-sm transition-colors",
                          isSelected
                            ? "border-gold bg-gold-dim"
                            : disabled
                              ? "cursor-not-allowed border-transparent bg-canvas"
                              : "border-transparent bg-raised hover:border-gold-dim"
                        )}
                      >
                        <span className={cn("font-medium", isSelected ? "text-ink" : timeClass)}>
                          {slot.time}
                        </span>
                        <span className={cn("text-xs", isSelected ? "text-ink" : labelClass)}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="customerNote" className="text-sm font-medium text-ink">
                {MESSAGES.booking.customerNoteLabel}
              </label>
              <Textarea
                id="customerNote"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                rows={2}
              />
            </div>

            <p className="text-center text-sm text-ink-soft">
              {MESSAGES.booking.pendingConfirmationNotice}
            </p>

            {submitError && (
              <p className="text-center text-sm text-bad">{errorText(submitError)}</p>
            )}

            {effectiveSlotTime && (
              <p className="text-center text-sm font-medium text-ink">
                {MESSAGES.booking.bookingSummary(
                  selectedDate.getUTCDate(),
                  MONTH_SHORT_TH[selectedDate.getUTCMonth()],
                  effectiveSlotTime,
                  partySize
                )}
              </p>
            )}

            {isLoggedIn ? (
              <Button
                type="button"
                size="lg"
                disabled={!effectiveSlotTime || submitting}
                onClick={handleSubmit}
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" />
                    {MESSAGES.booking.confirmButtonPending}
                  </>
                ) : (
                  MESSAGES.booking.confirmButton
                )}
              </Button>
            ) : (
              <Link href="/login" className={cn(buttonVariants({ size: "lg" }))}>
                {MESSAGES.common.loginRequired}
              </Link>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
