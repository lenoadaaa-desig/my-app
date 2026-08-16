import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { BookingStatusBadge } from "@/components/booking-status-badge";
import { MESSAGES, MONTH_SHORT_TH } from "@/constants/messages";

export type BookingCardData = {
  id: string;
  code: string;
  status: string;
  partySize: number;
  bookingDate: Date;
  slotTime: string;
  restaurant: { name: string };
};

export function BookingCard({ booking, action }: { booking: BookingCardData; action?: ReactNode }) {
  const day = booking.bookingDate.getUTCDate();
  const month = MONTH_SHORT_TH[booking.bookingDate.getUTCMonth()];

  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-ink">{booking.restaurant.name}</p>
          <BookingStatusBadge status={booking.status} />
        </div>
        <p className="text-sm text-ink-soft">
          {day} {month} · {booking.slotTime} · {MESSAGES.booking.partySizeCount(booking.partySize)}
        </p>
        <p className="text-xs text-ink-mute">
          {MESSAGES.booking.codeLabel}: <span className="font-medium tracking-wide">{booking.code}</span>
        </p>
        {action && <div className="mt-1 flex justify-end">{action}</div>}
      </CardContent>
    </Card>
  );
}
