import "server-only";

import { Prisma, Role as PrismaRole, RestaurantStatus, type Restaurant } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ERROR_CODES, type ErrorCode } from "@/lib/api-response";
import { MESSAGES } from "@/constants/messages";
import type { Profile } from "@/lib/dal";
import * as authService from "@/modules/auth/auth.service";
import type {
  CreateRestaurantInput,
  UpdateRestaurantInput,
  ListPublicRestaurantsInput,
} from "./restaurant.schema";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: ErrorCode; message: string } };

// dayOfWeek follows Date.getDay(): 0 = Sunday ... 6 = Saturday.
const DEFAULT_OPENING_HOURS = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  openTime: "10:00",
  closeTime: "22:00",
  isClosed: false,
}));

export async function createRestaurant(
  ownerId: string,
  data: CreateRestaurantInput
): Promise<ServiceResult<Restaurant>> {
  const profile = await prisma.profile.findUnique({ where: { id: ownerId } });
  if (!profile) {
    return {
      success: false,
      error: { code: ERROR_CODES.NOT_FOUND, message: MESSAGES.restaurant.notFound },
    };
  }

  // Admins approve restaurants — letting them also register one would let
  // an admin approve their own submission. Conflict of interest, blocked
  // outright rather than merely making self-approval hard.
  if (profile.role === PrismaRole.ADMIN) {
    return {
      success: false,
      error: { code: ERROR_CODES.FORBIDDEN, message: MESSAGES.restaurant.adminCannotCreate },
    };
  }

  let restaurant: Restaurant;
  try {
    restaurant = await prisma.$transaction(async (tx) => {
      const created = await tx.restaurant.create({
        data: {
          ownerId,
          name: data.name,
          description: data.description,
          address: data.address,
          phone: data.phone,
          category: data.category,
          coverImage: data.coverImage,
          status: RestaurantStatus.PENDING,
        },
      });

      await tx.openingHour.createMany({
        data: DEFAULT_OPENING_HOURS.map((hours) => ({
          restaurantId: created.id,
          ...hours,
        })),
      });

      await tx.bookingSetting.create({ data: { restaurantId: created.id } });

      return created;
    });
  } catch (err) {
    console.error("[restaurant] createRestaurant: transaction failed", err);
    return {
      success: false,
      error: { code: ERROR_CODES.RESTAURANT_CREATE_FAILED, message: MESSAGES.restaurant.createFailed },
    };
  }

  if (profile.role === PrismaRole.CUSTOMER) {
    // Outside the transaction: setUserRole also calls the Supabase Admin
    // API for app_metadata, which can't participate in a Prisma transaction.
    const promotion = await authService.setUserRole(ownerId, "owner");
    if (!promotion.success) {
      // Restaurant already committed; role sync is now stale. Logged, not
      // rolled back — same partial-failure tolerance setUserRole itself
      // uses for its own app_metadata step.
      console.error(
        `[restaurant] createRestaurant: restaurant ${restaurant.id} created but role promotion to owner failed for user ${ownerId}`
      );
    }
  }

  return { success: true, data: restaurant };
}

export async function updateRestaurant(
  id: string,
  ownerId: string,
  data: UpdateRestaurantInput
): Promise<ServiceResult<Restaurant>> {
  const restaurant = await prisma.restaurant.findUnique({ where: { id } });
  if (!restaurant) {
    return {
      success: false,
      error: { code: ERROR_CODES.NOT_FOUND, message: MESSAGES.restaurant.notFound },
    };
  }

  if (restaurant.ownerId !== ownerId) {
    return {
      success: false,
      error: { code: ERROR_CODES.FORBIDDEN, message: MESSAGES.restaurant.forbidden },
    };
  }

  try {
    const updated = await prisma.restaurant.update({ where: { id }, data });
    return { success: true, data: updated };
  } catch (err) {
    console.error("[restaurant] updateRestaurant: update failed", err);
    return {
      success: false,
      error: { code: ERROR_CODES.RESTAURANT_UPDATE_FAILED, message: MESSAGES.restaurant.updateFailed },
    };
  }
}

export async function listPublicRestaurants(filter: ListPublicRestaurantsInput) {
  // status is always APPROVED here, hardcoded — never accept it from the caller.
  const where: Prisma.RestaurantWhereInput = {
    status: RestaurantStatus.APPROVED,
    ...(filter.category ? { category: filter.category } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.restaurant.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
    }),
    prisma.restaurant.count({ where }),
  ]);

  return { items, total, page: filter.page, pageSize: filter.pageSize };
}

export type RestaurantWithOpeningHours = Restaurant & {
  openingHours: { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }[];
};

export async function getRestaurantById(
  id: string,
  viewer: Profile | null
): Promise<RestaurantWithOpeningHours | null> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    include: { openingHours: { orderBy: { dayOfWeek: "asc" } } },
  });
  if (!restaurant) {
    return null;
  }

  if (restaurant.status === RestaurantStatus.APPROVED) {
    return restaurant;
  }
  if (viewer?.role === "admin") {
    return restaurant;
  }
  if (viewer && restaurant.ownerId === viewer.id) {
    return restaurant;
  }

  // Not visible to this viewer — treated the same as not existing, so a
  // pending/rejected restaurant's existence isn't leaked to strangers.
  return null;
}
