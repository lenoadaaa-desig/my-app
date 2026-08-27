import type { Metadata } from "next";
import { getProfile } from "@/lib/dal";
import * as bookingService from "@/modules/booking/booking.service";
import { MESSAGES } from "@/constants/messages";
import { MyBookingsView } from "./my-bookings-view";

export const metadata: Metadata = { title: MESSAGES.nav.myBookings };

export default async function MyBookingsPage() {
  const profile = await getProfile(); // redirects to /login if not authenticated

  const data = await bookingService.getMyBookings(profile.id, { pageSize: 50 });

  return (
    <div className="mx-auto flex max-w-2xl flex-1 flex-col gap-4 bg-canvas px-4 py-6 sm:px-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{MESSAGES.nav.myBookings}</h1>
      <MyBookingsView initialData={data} />
    </div>
  );
}
