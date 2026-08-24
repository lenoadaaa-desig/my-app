"use client";

import { useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MESSAGES } from "@/constants/messages";
import { deleteUser } from "./actions";

export function DeleteUserDialog({
  userId,
  email,
  disabled,
}: {
  userId: string;
  email: string | null;
  disabled: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // See CLAUDE.md item 14 — state alone can't block a same-tick double
  // dispatch of the confirm button.
  const submittingRef = useRef(false);

  const emailMatches = email !== null && confirmText.trim() === email;

  async function handleConfirm() {
    if (submittingRef.current || !emailMatches) return;
    submittingRef.current = true;
    setPending(true);
    setError(null);
    try {
      await deleteUser(userId);
      setOpen(false);
      // The action's own revalidatePath("/admin") marks the route stale,
      // but doesn't by itself make an already-mounted client page refetch
      // — router.refresh() is what actually re-runs this Server Component
      // and drops the deleted row. Confirmed missing: the delete succeeded
      // server-side (verified in the DB) but the row stayed on screen
      // without this.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : MESSAGES.auth.deleteUserFailed);
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={disabled}
        onClick={() => {
          setConfirmText("");
          setError(null);
          setOpen(true);
        }}
      >
        {MESSAGES.admin.deleteUserButton}
      </Button>

      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{MESSAGES.admin.deleteUserDialogTitle}</DialogTitle>
            <DialogDescription>{MESSAGES.admin.deleteUserDialogDescription(email ?? "")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-email">{MESSAGES.admin.confirmEmailLabel}</Label>
            <Input
              id="confirm-email"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
            />
            {confirmText.length > 0 && !emailMatches && (
              <p className="text-sm text-bad">{MESSAGES.admin.confirmEmailMismatch}</p>
            )}
            {error && <p className="text-sm text-bad">{error}</p>}
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>
              {MESSAGES.admin.deleteUserDialogCancel}
            </DialogClose>
            <Button type="button" variant="destructive" disabled={pending || !emailMatches} onClick={handleConfirm}>
              {pending && <Loader2 className="animate-spin" />}
              {pending ? MESSAGES.admin.deleteUserActionPending : MESSAGES.admin.deleteUserDialogConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
