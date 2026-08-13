import { z } from "zod";
import { MESSAGES } from "@/constants/messages";

export const reviewRestaurantSchema = z
  .object({
    action: z.enum(["approve", "reject", "suspend"], MESSAGES.admin.reviewFailed),
    reason: z.string().optional(),
  })
  .refine((data) => data.action !== "reject" || !!data.reason?.trim(), {
    message: MESSAGES.admin.reviewReasonRequired,
    path: ["reason"],
  });

export type ReviewRestaurantInput = z.infer<typeof reviewRestaurantSchema>;
