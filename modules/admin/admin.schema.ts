import { z } from "zod";
import { MESSAGES } from "@/constants/messages";

// Lowercase in the URL (?status=pending) — RestaurantStatus's TS values are
// uppercase (RestaurantStatus.PENDING === "PENDING"), so the route maps this
// with a plain .toUpperCase() rather than a second lookup table.
export const RESTAURANT_STATUS_QUERY_VALUES = ["pending", "approved", "rejected", "suspended"] as const;

export const listRestaurantsQuerySchema = z.object({
  status: z.enum(RESTAURANT_STATUS_QUERY_VALUES).default("pending"),
});

export type ListRestaurantsQuery = z.infer<typeof listRestaurantsQuerySchema>;

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

export const USER_ROLE_QUERY_VALUES = ["customer", "owner", "admin"] as const;

export const listUsersQuerySchema = z.object({
  q: z.string().optional(),
  role: z.enum(USER_ROLE_QUERY_VALUES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
