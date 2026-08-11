import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export type Role = "user" | "admin";

export type Profile = {
  id: string;
  email: string | null;
  role: Role;
};

export const getProfile = cache(async (): Promise<Profile> => {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, role")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    redirect("/login");
  }

  return data;
});
