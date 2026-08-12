import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/modules/auth/auth.service";

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

  return profile;
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
