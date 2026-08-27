"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MESSAGES, ROLE_LABELS_TH } from "@/constants/messages";
import { USER_ROLE_QUERY_VALUES } from "@/modules/admin/admin.schema";

const ALL_ROLES = "__all__";
const SEARCH_DEBOUNCE_MS = 400;

function buildHref(q: string, role: string) {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (role !== ALL_ROLES) params.set("role", role);
  // A new search/filter always resets to page 1 — the previous page number
  // almost certainly doesn't exist in the new, differently-sized result set.
  const query = params.toString();
  return query ? `/admin?${query}` : "/admin";
}

// key={q} on the call site below forces a remount whenever the server's own
// `q` changes for a reason other than this component's own debounced
// navigation (e.g. browser back/forward, or a plain Link elsewhere
// resetting the filters) — see CLAUDE.md item 13. Debouncing free-text
// input genuinely needs local state (there's no way to buffer keystrokes
// by reading a prop directly each render), so remount-on-external-change is
// the correct fix here, not "no local state at all".
export function UserSearchControls({ q, role }: { q: string; role: string }) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(q);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const trimmed = searchInput.trim();
      if (trimmed !== q) {
        router.push(buildHref(trimmed, role));
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- q/role changes come from this same navigation or a remount (key={q} above), not a reason to re-fire the debounce timer itself
  }, [searchInput]);

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Input
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder={MESSAGES.admin.userSearchPlaceholder}
        aria-label={MESSAGES.admin.userSearchPlaceholder}
        className="sm:max-w-xs"
      />
      <Select value={role} onValueChange={(value) => value && router.push(buildHref(searchInput, value))}>
        <SelectTrigger aria-label={MESSAGES.admin.userRoleFilterLabel} className="sm:w-48">
          {/* Base UI's Select.Value doesn't auto-derive the matched Item's
              label — see app/restaurants/page.tsx's SelectValue for the
              same note. */}
          <SelectValue placeholder={MESSAGES.admin.userRoleFilterLabel}>
            {(value: string) => (value === ALL_ROLES ? MESSAGES.admin.userRoleFilterAll : (ROLE_LABELS_TH[value] ?? value))}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_ROLES}>{MESSAGES.admin.userRoleFilterAll}</SelectItem>
          {USER_ROLE_QUERY_VALUES.map((r) => (
            <SelectItem key={r} value={r}>
              {ROLE_LABELS_TH[r]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
