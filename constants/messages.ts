import type { ErrorCode } from "@/lib/api-response";

export const MESSAGES = {
  common: {
    // Only for failures with no server-provided error code at all (network
    // drop, non-JSON response) — anything with an ErrorCode uses
    // ERROR_MESSAGES_TH instead.
    errorGeneric: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
    loginRequired: "เข้าสู่ระบบเพื่อจอง",
  },

  auth: {
    emailRequired: "กรุณากรอกอีเมล",
    emailInvalid: "รูปแบบอีเมลไม่ถูกต้อง",
    passwordRequired: "กรุณากรอกรหัสผ่าน",
    passwordTooShort: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร",
    nameRequired: "กรุณากรอกชื่อ-นามสกุล",
    phoneInvalid: "รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง",
    roleInvalid: "บทบาทไม่ถูกต้อง",
    userIdInvalid: "รหัสผู้ใช้ไม่ถูกต้อง",

    signUpSuccess: "สมัครสมาชิกสำเร็จ กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี",
    signUpFailed: "สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",

    roleUpdateSuccess: "เปลี่ยนบทบาทผู้ใช้สำเร็จ",
    roleUpdateFailed: "เปลี่ยนบทบาทผู้ใช้ไม่สำเร็จ",

    deleteUserSuccess: "ลบผู้ใช้สำเร็จ",
    deleteUserFailed: "ลบผู้ใช้ไม่สำเร็จ กรุณาลบร้านหรือการจองที่เกี่ยวข้องก่อน",

    unauthorized: "กรุณาเข้าสู่ระบบก่อนใช้งาน",
    forbidden: "คุณไม่มีสิทธิ์เข้าถึงส่วนนี้",
  },

  restaurant: {
    nameRequired: "กรุณากรอกชื่อร้าน",
    categoryRequired: "กรุณาเลือกประเภทร้าน",
    invalidQuery: "พารามิเตอร์การค้นหาไม่ถูกต้อง",

    notFound: "ไม่พบร้านนี้",
    forbidden: "คุณไม่มีสิทธิ์แก้ไขร้านนี้",
    adminCannotCreate:
      "แอดมินไม่สามารถลงทะเบียนร้านได้ เนื่องจากแอดมินเป็นผู้อนุมัติร้าน หากต้องการเปิดร้านจริง กรุณาสมัครบัญชีแยกต่างหาก",

    createFailed: "ลงทะเบียนร้านไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    createSuccess: "ลงทะเบียนร้านสำเร็จ กรุณารอการอนุมัติจากแอดมิน",

    updateFailed: "แก้ไขข้อมูลร้านไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    updateSuccess: "แก้ไขข้อมูลร้านสำเร็จ",

    // UI-facing (detail page) — not returned by any service, only ever
    // rendered directly by app/restaurants/[id].
    addressLabel: "ที่อยู่",
    phoneLabel: "เบอร์โทร",
    openingHoursTitle: "เวลาเปิด-ปิด",
    closedLabel: "ปิด",
    backToList: "กลับไปหน้าค้นหาร้าน",
  },

  booking: {
    dateRequired: "กรุณาระบุวันที่",
    invalidDateFormat: "รูปแบบวันที่ไม่ถูกต้อง กรุณาใช้รูปแบบ YYYY-MM-DD",
    settingsMissing: "ร้านนี้ยังไม่ได้ตั้งค่าการจอง กรุณาติดต่อร้าน",

    restaurantNotApproved: "ร้านนี้ไม่สามารถรับการจองได้ในขณะนี้",
    slotNotAvailable: "ไม่สามารถจองรอบนี้ได้ กรุณาเลือกรอบอื่น",
    partySizeInvalid: "จำนวนคนไม่ถูกต้อง",
    partySizeExceedsMax: (max: number) => `จำนวนคนต้องไม่เกิน ${max} คน`,
    slotFull: "รอบนี้เต็มแล้ว กรุณาเลือกรอบอื่น",
    codeGenerationFailed: "ไม่สามารถสร้างรหัสการจองได้ กรุณาลองใหม่อีกครั้ง",
    createFailed: "จองไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",

    notFound: "ไม่พบการจองนี้",
    forbidden: "คุณไม่มีสิทธิ์จัดการการจองนี้",
    cancelDeadlinePassed: "เลยกำหนดเวลาที่จะยกเลิกด้วยตนเองแล้ว กรุณาติดต่อร้านโดยตรง",
    restaurantIdRequired: "กรุณาระบุร้าน",
    slotTimeRequired: "กรุณาระบุรอบเวลา",
    invalidSlotTimeFormat: "รูปแบบเวลาไม่ถูกต้อง กรุณาใช้รูปแบบ HH:MM",
    statusInvalid: "สถานะไม่ถูกต้อง",
    invalidTransition: (current: string, allowed: string[]) =>
      allowed.length > 0
        ? `สถานะการจองปัจจุบันคือ "${current}" ไม่สามารถเปลี่ยนเป็นสถานะนี้ได้ (เปลี่ยนได้เฉพาะเป็น: ${allowed.join(", ")})`
        : `สถานะการจองปัจจุบันคือ "${current}" ไม่สามารถเปลี่ยนสถานะได้อีก`,
    statusUpdateFailed: "เปลี่ยนสถานะการจองไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",

    // UI-facing (booking box + booking list) — not returned by any service.
    selectDateLabel: "เลือกวันที่",
    partySizeLabel: "จำนวนคน",
    slotsLoading: "กำลังโหลดรอบเวลา...",
    slotsEmptyClosed: "ร้านปิดในวันที่เลือก",
    slotsEmptyGeneric: "ไม่มีรอบว่างสำหรับวันที่เลือก กรุณาเลือกวันอื่น",
    slotFullBadge: "เต็ม",
    slotPastBadge: "ผ่านไปแล้ว",
    slotSeatsRemaining: (n: number) => `เหลือ ${n} ที่`,
    pendingConfirmationNotice: "จองแล้วต้องรอร้านยืนยัน",
    confirmButton: "ยืนยันการจอง",
    confirmButtonPending: "กำลังจอง...",
    customerNoteLabel: "หมายเหตุถึงร้าน (ถ้ามี)",

    bookingSuccessTitle: "จองสำเร็จ",
    bookingSuccessCodeHint: "แสดงรหัสนี้ให้ร้านดูเมื่อไปถึง",
    bookAnother: "จองรอบอื่นเพิ่ม",
    codeLabel: "รหัสการจอง",
  },

  admin: {
    reviewReasonRequired: "กรุณาระบุเหตุผลเมื่อปฏิเสธร้าน",
    restaurantNotFound: "ไม่พบร้านนี้",
    reviewFailed: "ดำเนินการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    reviewSuccess: "ดำเนินการสำเร็จ",
    invalidTransition: (current: string, allowed: string[]) =>
      allowed.length > 0
        ? `สถานะปัจจุบันคือ "${current}" ไม่สามารถเปลี่ยนเป็นสถานะนี้ได้ (เปลี่ยนได้เฉพาะเป็น: ${allowed.join(", ")})`
        : `สถานะปัจจุบันคือ "${current}" ไม่สามารถเปลี่ยนสถานะได้อีก`,
  },
} as const;

export const RESTAURANT_STATUS_LABELS_TH: Record<string, string> = {
  PENDING: "รอตรวจสอบ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ถูกปฏิเสธ",
  SUSPENDED: "ถูกระงับ",
};

// Index = OpeningHour.dayOfWeek / calendarDayOfWeek() (0 = Sunday ... 6 =
// Saturday, matching Date.getUTCDay()) — never reorder.
export const DAY_OF_WEEK_LABELS_TH: string[] = [
  "วันอาทิตย์",
  "วันจันทร์",
  "วันอังคาร",
  "วันพุธ",
  "วันพฤหัสบดี",
  "วันศุกร์",
  "วันเสาร์",
];

export const DAY_OF_WEEK_SHORT_TH: string[] = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

export const BOOKING_STATUS_LABELS_TH: Record<string, string> = {
  PENDING: "รอร้านยืนยัน",
  CONFIRMED: "ยืนยันแล้ว",
  REJECTED: "ร้านปฏิเสธ",
  CANCELLED: "ยกเลิกแล้ว",
  CHECKED_IN: "เช็คอินแล้ว",
  COMPLETED: "เสร็จสิ้น",
  NO_SHOW: "ไม่มาตามนัด",
};

// Semantic color token (app/globals.css) each booking status renders with —
// UI-only concern, kept separate from BOOKING_STATUS_LABELS_TH above since
// that map is also consumed by modules/booking/booking.service.ts (a
// server-only module with no notion of color).
export const BOOKING_STATUS_COLORS: Record<
  string,
  "ok" | "warn" | "bad" | "sky" | "ink-mute"
> = {
  PENDING: "warn",
  CONFIRMED: "ok",
  REJECTED: "bad",
  CANCELLED: "ink-mute",
  CHECKED_IN: "sky",
  COMPLETED: "ink-mute",
  NO_SHOW: "bad",
};

// Generic fallback text per API error code, for UI call sites that only have
// a `code` (e.g. a network/parse failure before the server's own Thai
// `message` was available). Prefer showing the server's `message` when you
// have one. Keyed by the real `ErrorCode` type (type-only import — erased at
// compile time, so it never pulls lib/api-response.ts's `next/server`
// dependency into a client bundle) so adding a new code to ERROR_CODES and
// forgetting to add it here is a tsc error, not a silent raw-code leak to
// the user.
export const ERROR_MESSAGES_TH: Record<ErrorCode, string> = {
  UNAUTHORIZED: "กรุณาเข้าสู่ระบบก่อนใช้งาน",
  FORBIDDEN: "คุณไม่มีสิทธิ์ทำรายการนี้",
  NOT_FOUND: "ไม่พบข้อมูลที่ต้องการ",
  VALIDATION_ERROR: "ข้อมูลที่กรอกไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง",
  SLOT_FULL: "รอบเวลานี้เต็มแล้ว กรุณาเลือกรอบอื่น",
  INVALID_STATE: "ไม่สามารถดำเนินการนี้ได้ในสถานะปัจจุบันของรายการ",
  SIGNUP_FAILED: "สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  ROLE_UPDATE_FAILED: "เปลี่ยนบทบาทผู้ใช้ไม่สำเร็จ",
  DELETE_USER_FAILED: "ลบผู้ใช้ไม่สำเร็จ",
  RESTAURANT_CREATE_FAILED: "ลงทะเบียนร้านไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  RESTAURANT_UPDATE_FAILED: "แก้ไขข้อมูลร้านไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  REVIEW_FAILED: "ดำเนินการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  BOOKING_CODE_GENERATION_FAILED: "ไม่สามารถสร้างรหัสการจองได้ กรุณาลองใหม่อีกครั้ง",
  BOOKING_CREATE_FAILED: "จองไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  BOOKING_STATUS_UPDATE_FAILED: "เปลี่ยนสถานะการจองไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
};
