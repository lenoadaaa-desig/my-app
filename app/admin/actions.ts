"use server";

import { revalidatePath } from "next/cache";
import { getProfile, type Role } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

export async function setUserRole(userId: string, role: Role) {
  const profile = await getProfile();
  if (profile.role !== "admin") {
    throw new Error("Not authorized.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin");
}
