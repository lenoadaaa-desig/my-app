import type { Metadata } from "next";
import Link from "next/link";
import { Role as PrismaRole } from "@prisma/client";
import { requireRole, type Role } from "@/lib/dal";
import { buttonVariants } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";
import { cn } from "@/lib/utils";
import * as userService from "@/modules/admin/user.service";
import { listUsersQuerySchema, type ListUsersQuery } from "@/modules/admin/admin.schema";
import { UserSearchControls } from "./user-search-controls";
import { AdminUserTable, type AdminUserRow } from "./admin-user-table";

export const metadata: Metadata = { title: MESSAGES.nav.adminPanel };

function buildPageHref(query: ListUsersQuery, page: number): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.role) params.set("role", query.role);
  params.set("page", String(page));
  return `/admin?${params.toString()}`;
}

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const profile = await requireRole("admin");

  const sp = await searchParams;
  const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const parsed = listUsersQuerySchema.safeParse({
    q: single(sp.q),
    role: single(sp.role),
    page: single(sp.page),
  });
  // Same "fall back to default rather than error the page" stance as the
  // admin restaurant queue's ?status= handling.
  const query: ListUsersQuery = parsed.success ? parsed.data : { role: undefined, page: 1, pageSize: 20 };

  const result = await userService.listUsers({
    q: query.q,
    role: query.role ? (query.role.toUpperCase() as PrismaRole) : undefined,
    page: query.page,
    pageSize: query.pageSize,
  });

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const rows: AdminUserRow[] = result.items.map((u) => ({
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    phone: u.phone,
    role: u.role.toLowerCase() as Role,
    createdAt: u.createdAt,
    ownedRestaurantCount: u._count.ownedRestaurants,
  }));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 bg-canvas px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-heading text-2xl font-semibold text-ink">{MESSAGES.nav.adminPanel}</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/restaurants" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            {MESSAGES.admin.manageRestaurantsLink}
          </Link>
          <Link href="/admin/dashboard" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            {MESSAGES.admin.manageDashboardLink}
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-ink">{MESSAGES.admin.manageUsersTitle}</p>
        {/* key remounts this client component (and so its debounced search
            box) when the server-confirmed q genuinely changes for a reason
            other than its own navigation — see the component's own comment
            and CLAUDE.md item 13. */}
        <UserSearchControls key={query.q ?? ""} q={query.q ?? ""} role={query.role ?? "__all__"} />

        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-lg bg-surface px-4 py-16 text-center">
            <p className="font-medium text-ink">{MESSAGES.admin.usersEmptyTitle}</p>
            <p className="text-sm text-ink-soft">{MESSAGES.admin.usersEmptyHint}</p>
          </div>
        ) : (
          <>
            <AdminUserTable users={rows} currentUserId={profile.id} />

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3">
                <Link
                  href={buildPageHref(query, Math.max(1, query.page - 1))}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    query.page <= 1 && "pointer-events-none opacity-50"
                  )}
                  aria-disabled={query.page <= 1}
                >
                  {MESSAGES.restaurant.prevPage}
                </Link>
                <p className="text-sm text-ink-soft">{MESSAGES.restaurant.pageOf(query.page, totalPages)}</p>
                <Link
                  href={buildPageHref(query, Math.min(totalPages, query.page + 1))}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    query.page >= totalPages && "pointer-events-none opacity-50"
                  )}
                  aria-disabled={query.page >= totalPages}
                >
                  {MESSAGES.restaurant.nextPage}
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
