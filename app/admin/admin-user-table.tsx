"use client";

import { useTransition } from "react";
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

  function handleRoleChange(userId: string, role: Role) {
    startTransition(() => {
      setUserRole(userId, role);
    });
  }

  return (
    <table className="w-full max-w-2xl border-collapse text-left text-sm">
      <thead>
        <tr className="border-b border-black/[.08] dark:border-white/[.145]">
          <th className="py-2 pr-4 font-medium text-zinc-600 dark:text-zinc-400">
            Email
          </th>
          <th className="py-2 font-medium text-zinc-600 dark:text-zinc-400">
            Role
          </th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr
            key={user.id}
            className="border-b border-black/[.08] dark:border-white/[.145]"
          >
            <td className="py-2 pr-4 text-black dark:text-zinc-50">
              {user.email}
            </td>
            <td className="py-2">
              <select
                value={user.role}
                disabled={isPending || user.id === currentUserId}
                onChange={(e) =>
                  handleRoleChange(user.id, e.target.value as Role)
                }
                className="rounded border border-black/[.08] bg-transparent px-2 py-1 text-sm disabled:opacity-50 dark:border-white/[.145]"
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
