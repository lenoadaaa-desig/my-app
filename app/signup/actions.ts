"use server";

import { redirect } from "next/navigation";
import { signUpSchema } from "@/modules/auth/auth.schema";
import * as authService from "@/modules/auth/auth.service";
import { MESSAGES } from "@/constants/messages";

export type SignupFormState = { error: string } | { message: string } | undefined;

export async function signup(
  _state: SignupFormState,
  formData: FormData
): Promise<SignupFormState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? MESSAGES.auth.signUpFailed };
  }

  const result = await authService.signUp(parsed.data);
  if (!result.success) {
    return { error: result.error.message };
  }

  // hasSession reflects this call's actual Supabase result (Confirm email
  // on -> null session; off -> a live one), not an assumption about the
  // project's config — see CLAUDE.md. redirect() must stay outside any
  // try/catch: it works by throwing NEXT_REDIRECT, which a catch here
  // would swallow and turn into a real error.
  if (result.data.hasSession) {
    redirect("/dashboard");
  }

  return { message: MESSAGES.auth.signUpSuccess };
}
