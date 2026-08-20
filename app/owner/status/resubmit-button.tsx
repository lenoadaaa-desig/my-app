"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { MESSAGES, ERROR_MESSAGES_TH } from "@/constants/messages";

type ApiError = { code: string; message: string };
type ApiResult<T> = { success: true; data: T } | { success: false; error: ApiError };

function errorText(err: ApiError): string {
  return ERROR_MESSAGES_TH[err.code as keyof typeof ERROR_MESSAGES_TH] ?? MESSAGES.common.errorGeneric;
}

export function ResubmitButton({ restaurantId }: { restaurantId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  // See CLAUDE.md's stale-closure note — `pending` state alone can't block
  // a same-tick double click.
  const pendingRef = useRef(false);

  async function confirmResubmit() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/restaurants/${restaurantId}/resubmit`, { method: "POST" });
      const result = (await res.json()) as ApiResult<unknown>;
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      // Re-fetches the server component so the stepper/status card reflect
      // the restaurant's new PENDING status without a full page reload.
      router.refresh();
    } catch {
      setError({ code: "", message: MESSAGES.common.errorGeneric });
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {MESSAGES.owner.resubmitButton}
      </Button>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{MESSAGES.owner.resubmitConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{MESSAGES.owner.resubmitConfirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-center text-sm text-bad">{errorText(error)}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{MESSAGES.owner.confirmDialogCancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                confirmResubmit();
              }}
            >
              {pending ? MESSAGES.owner.resubmitPending : MESSAGES.owner.resubmitButton}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
