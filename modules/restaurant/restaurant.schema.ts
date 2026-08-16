import { z } from "zod";
import { MESSAGES } from "@/constants/messages";

// No status/rejectReason/reviewedAt/reviewedById field on either schema —
// zod strips unknown keys by default, so a client sending them has no
// effect (same pattern as signUpSchema omitting role).
export const createRestaurantSchema = z.object({
  name: z.string().min(1, MESSAGES.restaurant.nameRequired),
  description: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().min(1).optional(),
  category: z.string().min(1, MESSAGES.restaurant.categoryRequired),
  coverImage: z.string().optional(),
});

export type CreateRestaurantInput = z.infer<typeof createRestaurantSchema>;

export const updateRestaurantSchema = createRestaurantSchema.partial();

export type UpdateRestaurantInput = z.infer<typeof updateRestaurantSchema>;

// Query-param validation errors here are surfaced with a fixed generic
// message by the route (not these per-field ones) since a malformed
// ?page=abc fails zod's base type coercion before any custom message here
// would apply.
export const listPublicRestaurantsSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListPublicRestaurantsInput = z.infer<typeof listPublicRestaurantsSchema>;
