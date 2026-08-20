"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MESSAGES, ERROR_MESSAGES_TH } from "@/constants/messages";
import type { ReviewAction } from "@/modules/admin/admin.service";

type ApiError = { code: string; message: string };
type ApiResult<T> = { success: true; data: T } | { success: false; error: ApiError };

function errorText(err: ApiError): string {
  return ERROR_MESSAGES_TH[err.code as keyof typeof ERROR_MESSAGES_TH] ?? MESSAGES.common.errorGeneric;
}

const REJECT_REASON_OPTIONS = [
  { value: "blurry_photo", label: MESSAGES.admin.rejectReasonBlurryPhoto },
  { value: "incomplete_info", label: MESSAGES.admin.rejectReasonIncompleteInfo },
  { value: "unreachable", label: MESSAGES.admin.rejectReasonUnreachable },
  { value: "duplicate", label: MESSAGES.admin.rejectReasonDuplicate },
  { value: "not_a_restaurant", label: MESSAGES.admin.rejectReasonNotARestaurant },
  { value: "other", label: MESSAGES.admin.rejectReasonOther },
] as const;

const SUCCESS_MESSAGE: Record<ReviewAction, string> = {
  approve: MESSAGES.admin.actionSuccessApprove,
  reject: MESSAGES.admin.actionSuccessReject,
  suspend: MESSAGES.admin.actionSuccessSuspend,
};

export function RestaurantReviewActions({
  restaurantId,
  allowedActions,
}: {
  restaurantId: string;
  allowedActions: ReviewAction[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [successAction, setSuccessAction] = useState<ReviewAction | null>(null);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReasonValue, setRejectReasonValue] = useState<string>(REJECT_REASON_OPTIONS[0].value);
  const [rejectOtherText, setRejectOtherText] = useState("");

  // `pending` state alone isn't enough to block a second in-flight request:
  // two click events dispatched in the same tick (a fast double-click, or a
  // test firing clicks back-to-back) both read `pending` from before either
  // handler's setPending(true) has flushed to a re-render, so both would
  // pass an `if (pending) return` check. A ref is mutated synchronously and
  // is visible to the very next handler invocation immediately, with no
  // render in between — verified with Playwright by firing two rapid clicks
  // on the same button and counting actual network requests (was 2 before
  // this guard, 1 after).
  const submittingRef = useRef(false);

  async function submit(action: ReviewAction, reason?: string) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/restaurants/${restaurantId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(reason ? { reason } : {}) }),
      });
      const result = (await res.json()) as ApiResult<unknown>;
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSuccessAction(action);
      setRejectOpen(false);
      // Stay on this page and re-fetch server data instead of redirecting
      // to the queue — the admin may want to keep looking at this
      // restaurant, or immediately change their mind and pick a different
      // action, and ALLOWED_TRANSITIONS server-side means the button set
      // below needs the fresh status anyway.
      router.refresh();
    } catch {
      setError({ code: "", message: MESSAGES.common.errorGeneric });
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  }

  function handleApproveOrSuspend(action: "approve" | "suspend") {
    setSuccessAction(null);
    submit(action);
  }

  function handleRejectConfirm() {
    const reason =
      rejectReasonValue === "other"
        ? rejectOtherText.trim()
        : (REJECT_REASON_OPTIONS.find((o) => o.value === rejectReasonValue)?.label ?? "");
    if (!reason) return;
    setSuccessAction(null);
    submit("reject", reason);
  }

  const rejectReasonInvalid = rejectReasonValue === "other" && rejectOtherText.trim() === "";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {allowedActions.includes("approve") && (
          <Button type="button" disabled={pending} onClick={() => handleApproveOrSuspend("approve")}>
            {pending && <Loader2 className="animate-spin" />}
            {MESSAGES.admin.approveButton}
          </Button>
        )}
        {allowedActions.includes("reject") && (
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => {
              setError(null);
              setRejectReasonValue(REJECT_REASON_OPTIONS[0].value);
              setRejectOtherText("");
              setRejectOpen(true);
            }}
          >
            {MESSAGES.admin.rejectButton}
          </Button>
        )}
        {allowedActions.includes("suspend") && (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => handleApproveOrSuspend("suspend")}
          >
            {pending && <Loader2 className="animate-spin" />}
            {MESSAGES.admin.suspendButton}
          </Button>
        )}
      </div>

      {/* Only shown here when the reject dialog isn't open — while it's
          open, the dialog renders its own copy of this same error so the
          admin sees it next to the form that produced it. */}
      {error && !rejectOpen && <p className="text-sm text-bad">{errorText(error)}</p>}
      {successAction && <p className="text-sm text-ok">{SUCCESS_MESSAGE[successAction]}</p>}

      <Dialog open={rejectOpen} onOpenChange={(open) => !pending && setRejectOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{MESSAGES.admin.rejectDialogTitle}</DialogTitle>
            <DialogDescription>{MESSAGES.admin.rejectDialogDescription}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{MESSAGES.admin.rejectReasonSelectLabel}</Label>
              <Select value={rejectReasonValue} onValueChange={(v) => v && setRejectReasonValue(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REJECT_REASON_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {rejectReasonValue === "other" && (
              <Textarea
                value={rejectOtherText}
                onChange={(e) => setRejectOtherText(e.target.value)}
                placeholder={MESSAGES.admin.rejectReasonOtherPlaceholder}
                rows={3}
              />
            )}

            {error && <p className="text-sm text-bad">{errorText(error)}</p>}
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>
              {MESSAGES.admin.rejectDialogCancel}
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              disabled={pending || rejectReasonInvalid}
              onClick={handleRejectConfirm}
            >
              {pending && <Loader2 className="animate-spin" />}
              {MESSAGES.admin.rejectDialogConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
