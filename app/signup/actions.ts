"use server";

import { createClient } from "@/lib/supabase/server";

export type SignupFormState = { error: string } | { message: string } | undefined;

export async function signup(
  _state: SignupFormState,
  formData: FormData
): Promise<SignupFormState> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string") {
    return { error: "Email and password are required." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters long." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: error.message };
  }

  return { message: "Check your email to confirm your account." };
}
