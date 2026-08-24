import Link from "next/link";
import { RestaurantStatus } from "@prisma/client";
import { requireRole } from "@/lib/dal";
import * as adminService from "@/modules/admin/admin.service";
import { listRestaurantsQuerySchema, type ListRestaurantsQuery } from "@/modules/admin/admin.schema";
import { calendarDaysBetween, toBangkokParts, formatThaiDate } from "@/lib/datetime";
import { MESSAGES } from "@/constants/messages";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RestaurantStatusFilter } from "./status-filter";

export default async function AdminRestaurantsPage({
  searchParams,
}: PageProps<"/admin/restaurants">) {
  await requireRole("admin");

  const rawStatus = (await searchParams).status;
  const parsed = listRestaurantsQuerySchema.safeParse({
    status: Array.isArray(rawStatus) ? rawStatus[0] : rawStatus,
  });
  // An unrecognized/malformed ?status= falls back to the default (pending)
  // rather than erroring the page — same "don't punish a bad query string"
  // stance as listPublicRestaurantsSchema's callers.
  const statusQuery: ListRestaurantsQuery["status"] = parsed.success ? parsed.data.status : "pending";
  const status = statusQuery.toUpperCase() as RestaurantStatus;
  const isPending = status === RestaurantStatus.PENDING;

  const restaurants = await adminService.listRestaurantsByStatus(status);
  const nowParts = toBangkokParts(new Date());

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 bg-canvas px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-heading text-2xl font-semibold text-ink">{MESSAGES.admin.queueTitle}</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            {MESSAGES.admin.manageUsersTitle}
          </Link>
          <Link href="/admin/dashboard" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            {MESSAGES.admin.manageDashboardLink}
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium text-ink">{MESSAGES.admin.statusFilterLabel}</p>
        <RestaurantStatusFilter status={statusQuery} />
      </div>

      {restaurants.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-lg bg-surface px-4 py-16 text-center">
          <p className="font-medium text-ink">{MESSAGES.admin.queueEmptyTitle}</p>
          <p className="text-sm text-ink-soft">{MESSAGES.admin.queueEmptyHint}</p>
        </div>
      ) : (
        <div className="rounded-xl ring-1 ring-gold-dim">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{MESSAGES.admin.columnRestaurant}</TableHead>
                <TableHead>{MESSAGES.admin.columnOwner}</TableHead>
                <TableHead>{MESSAGES.admin.columnSubmittedAt}</TableHead>
                <TableHead>
                  {isPending ? MESSAGES.admin.columnWaiting : MESSAGES.admin.columnReviewedAt}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {restaurants.map((restaurant) => (
                <TableRow key={restaurant.id}>
                  <TableCell>
                    <Link
                      href={`/admin/restaurants/${restaurant.id}?from=${statusQuery}`}
                      className="font-medium text-ink underline-offset-2 hover:underline"
                    >
                      {restaurant.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-ink-soft">
                    {restaurant.owner.fullName ?? restaurant.owner.email ?? MESSAGES.owner.dashboardNoName}
                  </TableCell>
                  <TableCell className="text-ink-soft">{formatThaiDate(restaurant.createdAt)}</TableCell>
                  <TableCell className="text-ink-soft">
                    {isPending
                      ? MESSAGES.admin.daysWaiting(
                          calendarDaysBetween(toBangkokParts(restaurant.createdAt), nowParts)
                        )
                      : restaurant.reviewedAt
                        ? formatThaiDate(restaurant.reviewedAt)
                        : MESSAGES.admin.reviewedAtEmpty}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
