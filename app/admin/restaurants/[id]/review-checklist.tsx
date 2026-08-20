"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { MESSAGES } from "@/constants/messages";

const ITEMS = [
  MESSAGES.admin.checklistItemInfoComplete,
  MESSAGES.admin.checklistItemRealPhotos,
  MESSAGES.admin.checklistItemContactable,
  MESSAGES.admin.checklistItemAddressReasonable,
];

// Deliberately UI-only, in-memory state — never sent to the API, never
// persisted to the DB, and (see RestaurantReviewActions) never gates the
// approve/reject/suspend buttons. It's a memory aid for the admin doing the
// review, not a validation gate: forcing it to be fully ticked before
// acting would just make admins tick through it without really looking,
// which is worse than not having a checklist at all. Do not wire this
// state into any button's `disabled`.
export function ReviewChecklist() {
  const [checked, setChecked] = useState<boolean[]>(() => ITEMS.map(() => false));

  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm font-medium text-ink">{MESSAGES.admin.checklistTitle}</p>
        {ITEMS.map((label, i) => (
          <label key={label} className="flex items-center gap-2 text-sm text-ink-soft">
            <Checkbox
              checked={checked[i]}
              onCheckedChange={(value) =>
                setChecked((prev) => prev.map((c, idx) => (idx === i ? value === true : c)))
              }
            />
            {label}
          </label>
        ))}
      </CardContent>
    </Card>
  );
}
