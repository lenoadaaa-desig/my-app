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
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export function ok<T>(data: T) {
  return NextResponse.json({ success: true, data });
}

export function fail(code: ErrorCode, message: string, status: number) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status }
  );
}
