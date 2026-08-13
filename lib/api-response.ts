import { NextResponse } from "next/server";

export const ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  SLOT_FULL: "SLOT_FULL",
  INVALID_STATE: "INVALID_STATE",
  SIGNUP_FAILED: "SIGNUP_FAILED",
  ROLE_UPDATE_FAILED: "ROLE_UPDATE_FAILED",
  DELETE_USER_FAILED: "DELETE_USER_FAILED",
  RESTAURANT_CREATE_FAILED: "RESTAURANT_CREATE_FAILED",
  RESTAURANT_UPDATE_FAILED: "RESTAURANT_UPDATE_FAILED",
  REVIEW_FAILED: "REVIEW_FAILED",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  SLOT_FULL: 409,
  INVALID_STATE: 409,
  SIGNUP_FAILED: 500,
  ROLE_UPDATE_FAILED: 500,
  DELETE_USER_FAILED: 500,
  RESTAURANT_CREATE_FAILED: 500,
  RESTAURANT_UPDATE_FAILED: 500,
  REVIEW_FAILED: 500,
};

/** Maps a ServiceResult error code to the HTTP status a route should respond with. */
export function statusForCode(code: ErrorCode): number {
  return STATUS_BY_CODE[code] ?? 500;
}

export function ok<T>(data: T) {
  return NextResponse.json({ success: true, data });
}

export function fail(code: ErrorCode, message: string, status: number) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status }
  );
}
