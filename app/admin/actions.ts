"use server";

import { revalidatePath } from "next/cache";
import { requireRole, type Role } from "@/lib/dal";
import { setUserRoleSchema } from "@/modules/auth/auth.schema";
import * as authService from "@/modules/auth/auth.service";

export async function setUserRole(userId: string, role: Role) {
  await requireRole("admin");

  const parsed = setUserRoleSchema.safeParse({ userId, role });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message);
  }

  const result = await authService.setUserRole(parsed.data.userId, parsed.data.role);
  if (!result.success) {
    throw new Error(result.error.message);
  }

  revalidatePath("/admin");
}
