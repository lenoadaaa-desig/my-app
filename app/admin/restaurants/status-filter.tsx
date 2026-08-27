"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MESSAGES, RESTAURANT_STATUS_LABELS_TH } from "@/constants/messages";
import { RESTAURANT_STATUS_QUERY_VALUES, type ListRestaurantsQuery } from "@/modules/admin/admin.schema";

const STATUS_KEY_BY_QUERY: Record<string, string> = {
  pending: "PENDING",
  approved: "APPROVED",
  rejected: "REJECTED",
  suspended: "SUSPENDED",
};

export function RestaurantStatusFilter({ status }: { status: ListRestaurantsQuery["status"] }) {
  const router = useRouter();

  return (
    <Select
      value={status}
      onValueChange={(value) => {
        if (value) router.push(`/admin/restaurants?status=${value}`);
      }}
    >
      <SelectTrigger aria-label={MESSAGES.admin.statusFilterLabel} className="w-48">
        {/* Base UI's Select.Value doesn't auto-derive the matched Item's
            label (see app/restaurants/page.tsx's SelectValue for the same
            note) — without this children-function it would show the raw
            query value ("pending") instead of the Thai label. */}
        <SelectValue placeholder={MESSAGES.admin.statusFilterLabel}>
          {(value: string) => RESTAURANT_STATUS_LABELS_TH[STATUS_KEY_BY_QUERY[value]] ?? value}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {RESTAURANT_STATUS_QUERY_VALUES.map((value) => (
          <SelectItem key={value} value={value}>
            {RESTAURANT_STATUS_LABELS_TH[STATUS_KEY_BY_QUERY[value]]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
