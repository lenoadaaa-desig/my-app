"use server";

import { revalidatePath } from "next/cache";
import { requireRole, type Role } from "@/lib/dal";
import { setUserRoleSchema, deleteUserSchema } from "@/modules/auth/auth.schema";
import * as authService from "@/modules/auth/auth.service";

export async function setUserRole(userId: string, role: Role) {
  const admin = await requireRole("admin");

  const parsed = setUserRoleSchema.safeParse({ userId, role });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message);
  }

  const result = await authService.setUserRole(parsed.data.userId, parsed.data.role, admin.id);
  if (!result.success) {
    throw new Error(result.error.message);
  }

  revalidatePath("/admin");
}

export async function deleteUser(userId: string) {
  const admin = await requireRole("admin");

  const parsed = deleteUserSchema.safeParse({ userId });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message);
  }

  const result = await authService.deleteUser(parsed.data.userId, admin.id);
  if (!result.success) {
    throw new Error(result.error.message);
  }

  revalidatePath("/admin");
}
