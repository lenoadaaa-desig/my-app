"use client";

import { useRef, useTransition } from "react";
import { setUserRole } from "./actions";
import type { Profile, Role } from "@/lib/dal";

export function AdminUserTable({
  users,
  currentUserId,
}: {
  users: Profile[];
  currentUserId: string;
}) {
  const [isPending, startTransition] = useTransition();
  // `disabled={isPending}` alone only blocks a second change once React has
  // re-rendered with the new isPending value — a same-tick double dispatch
  // (two onChange events fired before that render) would still slip both
  // through to startTransition. See CLAUDE.md's stale-closure note; same
  // ref-guard pattern as every other anti-double-submit handler in the app.
  const changingRef = useRef(false);

  function handleRoleChange(userId: string, role: Role) {
    if (changingRef.current) return;
    changingRef.current = true;
    startTransition(() => {
      setUserRole(userId, role).finally(() => {
        changingRef.current = false;
      });
    });
  }

  return (
    <table className="w-full border-collapse text-left text-sm">
      <thead>
        <tr className="border-b border-gold-dim">
          <th className="py-2 pr-4 font-medium text-ink-soft">Email</th>
          <th className="py-2 font-medium text-ink-soft">Role</th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={user.id} className="border-b border-gold-dim">
            <td className="py-2 pr-4 text-ink">{user.email}</td>
            <td className="py-2">
              <select
                value={user.role}
                disabled={isPending || user.id === currentUserId}
                onChange={(e) =>
                  handleRoleChange(user.id, e.target.value as Role)
                }
                className="rounded border border-gold-dim bg-transparent px-2 py-1 text-sm text-ink disabled:opacity-50"
              >
                <option value="customer">customer</option>
                <option value="owner">owner</option>
                <option value="admin">admin</option>
              </select>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
