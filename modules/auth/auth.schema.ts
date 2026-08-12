import { z } from "zod";
import { MESSAGES } from "@/constants/messages";

const THAI_PHONE_REGEX = /^0\d{8,9}$/;

export const signUpSchema = z.object({
  email: z.email(MESSAGES.auth.emailInvalid),
  password: z
    .string()
    .min(8, MESSAGES.auth.passwordTooShort),
  name: z.string().min(1, MESSAGES.auth.nameRequired),
  phone: z.string().regex(THAI_PHONE_REGEX, MESSAGES.auth.phoneInvalid),
});

export type SignUpInput = z.infer<typeof signUpSchema>;

export const setUserRoleSchema = z.object({
  userId: z.uuid(MESSAGES.auth.userIdInvalid),
  role: z.enum(["customer", "owner", "admin"], MESSAGES.auth.roleInvalid),
});

export type SetUserRoleInput = z.infer<typeof setUserRoleSchema>;
