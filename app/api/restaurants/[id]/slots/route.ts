import type { NextRequest } from "next/server";
import { getProfileOrNull } from "@/lib/dal";
import { ok, fail, statusForCode, ERROR_CODES } from "@/lib/api-response";
import { MESSAGES } from "@/constants/messages";
import { getAvailableSlotsQuerySchema } from "@/modules/booking/booking.schema";
import * as bookingService from "@/modules/booking/booking.service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const parsed = getAvailableSlotsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return fail(
      ERROR_CODES.VALIDATION_ERROR,
      parsed.error.issues[0]?.message ?? MESSAGES.booking.invalidDateFormat,
      400
    );
  }

  const viewer = await getProfileOrNull();
  const result = await bookingService.getAvailableSlots(id, parsed.data.date, viewer);
  if (!result.success) {
    return fail(result.error.code, result.error.message, statusForCode(result.error.code));
  }

  return ok(result.data);
}
