"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { MESSAGES, ROLE_LABELS_TH } from "@/constants/messages";
import { formatThaiDate } from "@/lib/datetime";
import { setUserRole } from "./actions";
import { DeleteUserDialog } from "./delete-user-dialog";
import type { Role } from "@/lib/dal";

export type AdminUserRow = {
  id: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  role: Role;
  createdAt: Date;
  ownedRestaurantCount: number;
};

export function AdminUserTable({
  users,
  currentUserId,
}: {
  users: AdminUserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // `disabled={isPending}` alone only blocks a second change once React has
  // re-rendered with the new isPending value — a same-tick double dispatch
  // (two onChange events fired before that render) would still slip both
  // through to startTransition. See CLAUDE.md's stale-closure note; same
  // ref-guard pattern as every other anti-double-submit handler in the app.
  const changingRef = useRef(false);
  // Which row's change failed + why. Found missing entirely during testing:
  // setUserRole (a Server Action that throws on failure) was called with no
  // .catch anywhere, so a real failure (Supabase API hiccup, or any other
  // reason the update can't complete) surfaced only as a silent
  // unhandledRejection in the browser console — the admin saw the dropdown
  // silently revert with no indication anything had gone wrong.
  const [errorRowId, setErrorRowId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleRoleChange(userId: string, role: Role) {
    if (changingRef.current) return;
    changingRef.current = true;
    setErrorRowId(null);
    startTransition(() => {
      setUserRole(userId, role)
        .then(() => {
          // Mirrors DeleteUserDialog's fix for the same gap: the action's
          // own revalidatePath("/admin") marks the route stale but doesn't
          // by itself make an already-mounted client page refetch.
          router.refresh();
        })
        .catch((err) => {
          setErrorRowId(userId);
          setErrorMessage(err instanceof Error ? err.message : MESSAGES.auth.roleUpdateFailed);
        })
        .finally(() => {
          changingRef.current = false;
        });
    });
  }

  return (
    <div className="rounded-xl ring-1 ring-gold-dim">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{MESSAGES.admin.columnEmail}</TableHead>
            <TableHead>{MESSAGES.admin.columnName}</TableHead>
            <TableHead>{MESSAGES.admin.columnPhone}</TableHead>
            <TableHead>{MESSAGES.admin.columnRole}</TableHead>
            <TableHead>{MESSAGES.admin.columnCreatedAt}</TableHead>
            <TableHead>{MESSAGES.admin.columnOwnedRestaurants}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const isSelf = user.id === currentUserId;
            return (
              <TableRow key={user.id}>
                <TableCell className="text-ink">{user.email ?? MESSAGES.owner.dashboardNoName}</TableCell>
                <TableCell className="text-ink-soft">{user.fullName ?? MESSAGES.owner.dashboardNoName}</TableCell>
                <TableCell className="text-ink-soft">{user.phone ?? MESSAGES.owner.dashboardNoPhone}</TableCell>
                <TableCell>
                  <select
                    value={user.role}
                    disabled={isPending || isSelf}
                    title={isSelf ? MESSAGES.admin.roleChangeDisabledSelf : undefined}
                    onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                    className="rounded border border-gold-dim bg-transparent px-2 py-1 text-sm text-ink disabled:opacity-50"
                  >
                    <option value="customer">{ROLE_LABELS_TH.customer}</option>
                    <option value="owner">{ROLE_LABELS_TH.owner}</option>
                    <option value="admin">{ROLE_LABELS_TH.admin}</option>
                  </select>
                  {errorRowId === user.id && <p className="mt-1 text-xs text-bad">{errorMessage}</p>}
                </TableCell>
                <TableCell className="text-ink-soft">{formatThaiDate(user.createdAt)}</TableCell>
                <TableCell className="text-ink-soft">{user.ownedRestaurantCount}</TableCell>
                <TableCell>
                  <DeleteUserDialog
                    userId={user.id}
                    email={user.email}
                    disabled={isSelf}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
