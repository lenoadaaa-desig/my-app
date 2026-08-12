"use server";

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

  return { message: MESSAGES.auth.signUpSuccess };
}
