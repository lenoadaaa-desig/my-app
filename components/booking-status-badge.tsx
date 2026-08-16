import { Badge } from "@/components/ui/badge";
import { BOOKING_STATUS_LABELS_TH, BOOKING_STATUS_COLORS } from "@/constants/messages";

const COLOR_CLASSES: Record<string, string> = {
  ok: "bg-ok/10 text-ok",
  warn: "bg-warn/10 text-warn",
  bad: "bg-bad/10 text-bad",
  sky: "bg-sky/30 text-ink",
  "ink-mute": "bg-ink-mute/10 text-ink-mute",
};

export function BookingStatusBadge({ status }: { status: string }) {
  const color = BOOKING_STATUS_COLORS[status] ?? "ink-mute";
  return (
    <Badge className={COLOR_CLASSES[color]}>{BOOKING_STATUS_LABELS_TH[status] ?? status}</Badge>
  );
}
