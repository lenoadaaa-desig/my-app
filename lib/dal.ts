import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureProfile, setUserRole } from "@/modules/auth/auth.service";

export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export type Role = "customer" | "owner" | "admin";

export type Profile = {
  id: string;
  email: string | null;
  role: Role;
};

export class UnauthorizedError extends Error {
  readonly code = "UNAUTHORIZED" as const;
  constructor(message = "Not authenticated.") {
    super(message);
  }
}

export class ForbiddenError extends Error {
  readonly code = "FORBIDDEN" as const;
  constructor(message = "Not authorized.") {
    super(message);
  }
}

async function fetchProfileRow(userId: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, role")
    .eq("id", userId)
    .single();

  return error || !data ? null : data;
}

/**
 * Repairs a rare partial-failure state from restaurant creation:
 * restaurant.service.ts's createRestaurant commits the restaurant in a
 * Prisma transaction, then promotes the owner to "owner" via a separate
 * Supabase Admin API call (can't join the transaction). If that promotion
 * fails, the restaurant exists but its owner is stuck as "customer" —
 * locked out of /owner and unable to even see their own restaurant, with
 * no obvious cause. Only queries when role is "customer" (the only role
 * this can happen to), so it doesn't add a query to every profile read.
 * Runs once — if the repair promotion also fails, that's logged, not retried.
 */
async function healOwnerRoleIfNeeded(profile: Profile): Promise<Profile> {
  if (profile.role !== "customer") {
    return profile;
  }

  const ownedRestaurantCount = await prisma.restaurant.count({ where: { ownerId: profile.id } });
  if (ownedRestaurantCount === 0) {
    return profile;
  }

  console.warn(
    `[dal] healOwnerRoleIfNeeded: user ${profile.id} owns ${ownedRestaurantCount} restaurant(s) but role is still ` +
      `"customer" — a previous restaurant creation's role promotion must have failed. Promoting to "owner" now.`
  );

  const promotion = await setUserRole(profile.id, "owner");
  if (!promotion.success) {
    console.error(
      `[dal] healOwnerRoleIfNeeded: repair promotion to "owner" failed for user ${profile.id}`,
      promotion.error
    );
    return profile;
  }

  return { ...profile, role: "owner" };
}

/** Throws instead of redirecting — safe to use from Route Handlers. */
export async function requireAuthOrThrow() {
  const user = await getUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}

/** Throws instead of redirecting — safe to use from Route Handlers. */
export const requireProfileOrThrow = cache(async (): Promise<Profile> => {
  const user = await requireAuthOrThrow();

  let profile = await fetchProfileRow(user.id);
  if (!profile) {
    // Self-heals an auth user left without a profile row (e.g. a crash
    // between auth.signUp succeeding and the profile insert running). One
    // retry only — if it's still missing after ensureProfile, something
    // deeper is wrong and this should surface, not loop.
    await ensureProfile(user);
    profile = await fetchProfileRow(user.id);
  }

  if (!profile) {
    throw new UnauthorizedError();
  }

  return healOwnerRoleIfNeeded(profile);
});

/**
 * Like requireProfileOrThrow, but returns null instead of throwing when
 * there's no logged-in user. For routes that serve both anonymous and
 * authenticated viewers (e.g. a restaurant detail page whose visibility
 * depends on who's asking).
 */
export const getProfileOrNull = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) {
    return null;
  }

  let profile = await fetchProfileRow(user.id);
  if (!profile) {
    await ensureProfile(user);
    profile = await fetchProfileRow(user.id);
  }

  return profile ? healOwnerRoleIfNeeded(profile) : null;
});

/** Throws instead of redirecting — safe to use from Route Handlers. */
export async function requireRoleOrThrow(...roles: Role[]): Promise<Profile> {
  const profile = await requireProfileOrThrow();
  if (!roles.includes(profile.role)) {
    throw new ForbiddenError();
  }
  return profile;
}

/** For Server Components / Server Actions: redirects instead of throwing. */
export async function getProfile(): Promise<Profile> {
  try {
    return await requireProfileOrThrow();
  } catch {
    redirect("/login");
  }
}

/** For Server Components / Server Actions: redirects instead of throwing. */
export async function requireAuth() {
  try {
    return await requireAuthOrThrow();
  } catch {
    redirect("/login");
  }
}

/** For Server Components / Server Actions: redirects instead of throwing. */
export async function requireRole(...roles: Role[]): Promise<Profile> {
  try {
    return await requireRoleOrThrow(...roles);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      redirect("/dashboard");
    }
    redirect("/login");
  }
}
