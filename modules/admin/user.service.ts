import "server-only";

import { Prisma, Role as PrismaRole, type Profile as PrismaProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AdminUserListItem = PrismaProfile & { _count: { ownedRestaurants: number } };

export type ListUsersParams = {
  q?: string;
  role?: PrismaRole;
  page: number;
  pageSize: number;
};

export type ListUsersResult = {
  items: AdminUserListItem[];
  total: number;
  page: number;
  pageSize: number;
};

// A query that's entirely digits (optionally with a leading "+") searches
// phone too; anything else searches only email/fullName as the spec says.
// Without this split, a short numeric-looking or coincidentally-numeric
// query could match someone's phone number when the admin never intended a
// phone search at all — and conversely, a free-text query could spuriously
// match a phone number that happens to contain the same digits as part of
// its string form. Found the reverse problem during testing (not a phone
// match, but the same class of "contains on the wrong field" surprise):
// searching "leno" matched admin@tablenow.test too, because "leno" is
// literally a substring of "tablenow" ("tab-LENO-w") — a coincidence of
// this project's domain name, not a bug in the matching logic itself.
const DIGITS_ONLY = /^\+?\d+$/;

// _count.ownedRestaurants needs Restaurant(ownerId) indexed — see
// prisma/schema.prisma's comment on that index (measured via EXPLAIN,
// Task 8 phase 2) for why a FK column isn't indexed automatically.
export async function listUsers({ q, role, page, pageSize }: ListUsersParams): Promise<ListUsersResult> {
  const trimmedQ = q?.trim();
  const isPhoneQuery = !!trimmedQ && DIGITS_ONLY.test(trimmedQ);
  const where: Prisma.ProfileWhereInput = {
    ...(role ? { role } : {}),
    ...(trimmedQ
      ? {
          OR: [
            { email: { contains: trimmedQ, mode: "insensitive" } },
            { fullName: { contains: trimmedQ, mode: "insensitive" } },
            ...(isPhoneQuery ? [{ phone: { contains: trimmedQ } }] : []),
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.profile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { ownedRestaurants: true } } },
    }),
    prisma.profile.count({ where }),
  ]);

  return { items, total, page, pageSize };
}
