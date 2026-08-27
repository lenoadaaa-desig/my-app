import type { ErrorCode } from "@/lib/api-response";

export const MESSAGES = {
  common: {
    // Only for failures with no server-provided error code at all (network
    // drop, non-JSON response) — anything with an ErrorCode uses
    // ERROR_MESSAGES_TH instead.
    errorGeneric: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
    loginRequired: "เข้าสู่ระบบเพื่อจอง",
    retry: "ลองใหม่",
    today: "วันนี้",
    backToHome: "กลับหน้าแรก",
  },

  notFoundPage: {
    title: "ไม่พบหน้านี้",
    description: "หน้าที่คุณกำลังหาอาจถูกย้ายหรือไม่มีอยู่จริง",
  },

  forbiddenPage: {
    title: "ไม่มีสิทธิ์เข้าถึง",
    description: "คุณไม่มีสิทธิ์เข้าถึงหน้านี้ ลองกลับไปหน้าแรกแล้วเข้าใช้งานส่วนที่คุณมีสิทธิ์แทน",
  },

  errorPage: {
    title: "เกิดข้อผิดพลาด",
    description: "ขออภัย เกิดข้อผิดพลาดที่ไม่คาดคิด ลองใหม่อีกครั้งหรือกลับหน้าแรก",
  },

  // <title>/<meta description> text only (Task 9 phase 2) — not rendered
  // in the page body. Pages whose body already has a suitable heading
  // string (nav.*, owner.*Title, admin.*Title) reuse that instead of
  // duplicating a near-identical string here.
  metadata: {
    restaurantsListDescription:
      "ค้นหาร้านอาหาร ดูเวลาว่าง และจองโต๊ะได้ทันทีจากร้านที่เปิดให้บริการบน TableNow",
    adminRestaurantDetailTitle: "ตรวจสอบร้าน",
  },

  nav: {
    searchRestaurants: "ค้นหาร้าน",
    myBookings: "การจองของฉัน",
    myRestaurants: "ร้านของฉัน",
    adminPanel: "จัดการระบบ",
    dashboard: "แดชบอร์ด",
    login: "เข้าสู่ระบบ",
    signup: "สมัครสมาชิก",
    logout: "ออกจากระบบ",
    openMenu: "เปิดเมนู",
    menuTitle: "เมนู",
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
    deleteUserFailed: "ลบผู้ใช้ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    // Precise counts computed before attempting the delete (not parsed from
    // a raw Prisma FK error) so the admin knows exactly what's blocking it.
    deleteUserBlocked: (restaurantCount: number, bookingCount: number) => {
      const parts: string[] = [];
      if (restaurantCount > 0) parts.push(`เป็นเจ้าของร้าน ${restaurantCount} ร้าน`);
      if (bookingCount > 0) parts.push(`มีการจอง ${bookingCount} รายการ`);
      return `ลบผู้ใช้นี้ไม่ได้เพราะ${parts.join(" และ")} กรุณาย้ายหรือลบข้อมูลเหล่านี้ก่อน`;
    },
    cannotDeleteSelf: "แอดมินไม่สามารถลบบัญชีตัวเองได้",
    cannotChangeOwnRole: "แอดมินไม่สามารถเปลี่ยนบทบาทตัวเองได้",
    cannotDemoteLastAdmin: "ไม่สามารถลดบทบาทได้ เนื่องจากเป็นแอดมินคนเดียวที่เหลืออยู่ในระบบ",

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
    todayOpenHours: (openTime: string, closeTime: string) => `วันนี้ ${openTime} - ${closeTime}`,
    todayClosed: "วันนี้ปิด",

    // UI-facing (search/list page) — not returned by any service.
    searchPlaceholder: "ค้นหาชื่อร้าน...",
    categoryFilterLabel: "หมวดหมู่",
    categoryAllLabel: "ทุกหมวด",
    listEmptyTitle: "ไม่พบร้านที่ค้นหา",
    listEmptyHint: "ลองลดตัวกรองหรือค้นหาด้วยคำอื่น",
    openNowLabel: "เปิดอยู่",
    closedNowLabel: "ปิดแล้ว",
    prevPage: "ก่อนหน้า",
    nextPage: "ถัดไป",
    pageOf: (page: number, totalPages: number) => `หน้า ${page} จาก ${totalPages}`,
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
    cancelReasonRequired: "กรุณาระบุเหตุผลเมื่อยกเลิกการจองแทนลูกค้า",
    restaurantIdRequired: "กรุณาระบุร้าน",
    slotTimeRequired: "กรุณาระบุรอบเวลา",
    invalidSlotTimeFormat: "รูปแบบเวลาไม่ถูกต้อง กรุณาใช้รูปแบบ HH:MM",
    statusInvalid: "สถานะไม่ถูกต้อง",
    invalidTransition: (current: string, allowed: string[]) =>
      allowed.length > 0
        ? `สถานะการจองปัจจุบันคือ "${current}" ไม่สามารถเปลี่ยนเป็นสถานะนี้ได้ (เปลี่ยนได้เฉพาะเป็น: ${allowed.join(", ")})`
        : `สถานะการจองปัจจุบันคือ "${current}" ไม่สามารถเปลี่ยนสถานะได้อีก`,
    statusUpdateFailed: "เปลี่ยนสถานะการจองไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    invalidQuery: "พารามิเตอร์การค้นหาไม่ถูกต้อง",
    // minutesLeft is always >= 1 (checkBookingRateLimit in booking.service.ts
    // rounds up) — never "0 นาที" or a negative number.
    rateLimited: (minutesLeft: number) => `จองบ่อยเกินไป กรุณารออีก ${minutesLeft} นาทีแล้วลองใหม่`,

    // UI-facing (booking box + booking list) — not returned by any service.
    selectDateLabel: "เลือกวันที่",
    partySizeLabel: "จำนวนคน",
    decreasePartySize: "ลดจำนวนคน",
    increasePartySize: "เพิ่มจำนวนคน",
    selectSlotLabel: "รอบเวลา",
    slotsLoading: "กำลังโหลดรอบเวลา...",
    slotsEmptyClosed: "ร้านปิดในวันที่เลือก",
    slotsEmptyGeneric: "ไม่มีรอบว่างสำหรับวันที่เลือก กรุณาเลือกวันอื่น",
    slotsFilteredNotice: "แสดงเฉพาะรอบที่ยังจองได้",
    slotFullBadge: "เต็ม",
    slotPastBadge: "ผ่านไปแล้ว",
    slotSeatsRemaining: (n: number) => `เหลือ ${n} ที่`,
    slotInsufficientForParty: "ไม่พอ",
    pendingConfirmationNotice: "จองแล้วต้องรอร้านยืนยัน",
    bookingSummary: (day: number, monthShort: string, time: string, partySize: number) =>
      `${day} ${monthShort} · ${time} · ${partySize} คน`,
    confirmButton: "ยืนยันการจอง",
    confirmButtonPending: "กำลังจอง...",
    customerNoteLabel: "หมายเหตุถึงร้าน (ถ้ามี)",

    bookingSuccessTitle: "จองสำเร็จ",
    bookingSuccessCodeHint: "แสดงรหัสนี้ให้ร้านดูเมื่อไปถึง",
    bookAnother: "จองรอบอื่นเพิ่ม",
    viewMyBookings: "ดูการจองของฉัน",
    codeLabel: "รหัสการจอง",

    // UI-facing (/bookings/my, /dashboard) — not returned by any service.
    tabUpcoming: "กำลังจะถึง",
    tabHistory: "ประวัติ",
    tabCancelled: "ยกเลิกแล้ว",
    emptyUpcoming: "ยังไม่มีการจองที่กำลังจะถึง",
    emptyHistory: "ยังไม่มีประวัติการจอง",
    emptyCancelled: "ยังไม่มีการจองที่ยกเลิก",
    emptyBookingsHint: "เริ่มค้นหาร้านที่ใช่แล้วจองได้เลย",
    partySizeCount: (n: number) => `${n} ที่นั่ง`,
    cancelButton: "ยกเลิกการจอง",
    cancelDialogTitle: "ยืนยันยกเลิกการจอง?",
    cancelDialogDescription: (restaurantName: string, day: number, monthShort: string, time: string) =>
      `การจองที่ ${restaurantName} วันที่ ${day} ${monthShort} เวลา ${time} จะถูกยกเลิก การกระทำนี้ย้อนกลับไม่ได้`,
    cancelDialogConfirm: "ยืนยันยกเลิก",
    cancelDialogDismiss: "ไม่ยกเลิก",
    cancelPending: "กำลังยกเลิก...",
    upcomingBookingsTitle: "การจองที่กำลังจะถึง",
    viewAllBookings: "ดูทั้งหมด",
  },

  dashboard: {
    greeting: (email: string) => `สวัสดี, ${email}`,
    manageMyRestaurants: "จัดการร้านของฉัน",
  },

  owner: {
    // /owner/register — multi-step form, not returned by any service.
    registerTitle: "ลงทะเบียนร้านอาหาร",
    stepOf: (step: number, total: number) => `ขั้นตอน ${step} จาก ${total}`,
    step1Title: "ข้อมูลร้าน",
    step2Title: "ที่อยู่",
    step3Title: "รูปปก",
    step4Title: "ยืนยันข้อมูล",
    nameLabel: "ชื่อร้าน",
    categoryLabel: "หมวดหมู่",
    descriptionLabel: "คำอธิบายร้าน",
    phoneLabel: "เบอร์โทร",
    addressLabel: "ที่อยู่",
    coverImageLabel: "URL รูปปก",
    coverImageHint: "วางลิงก์รูปภาพ — ยังไม่รองรับการอัปโหลดไฟล์โดยตรงในตอนนี้",
    notProvided: "(ไม่ได้ระบุ)",
    backButton: "ย้อนกลับ",
    nextButton: "ถัดไป",
    submitButton: "ยืนยันและส่งลงทะเบียน",
    submitPending: "กำลังส่ง...",
    reviewHeading: "ตรวจสอบข้อมูลก่อนส่ง",

    // /owner/status
    statusTitle: "สถานะการอนุมัติร้าน",
    statusStepSubmitted: "ส่งแล้ว",
    statusStepReviewing: "กำลังตรวจสอบ",
    statusStepResult: "ผลลัพธ์",
    statusPendingMessage: "ร้านของคุณอยู่ระหว่างการตรวจสอบจากแอดมิน กรุณารอการอนุมัติ",
    statusApprovedMessage: "ร้านของคุณได้รับการอนุมัติแล้ว พร้อมเปิดให้จองแล้ว",
    statusRejectedMessage: "ร้านของคุณถูกปฏิเสธ",
    statusSuspendedMessage: "ร้านของคุณถูกระงับการใช้งาน",
    rejectReasonLabel: "เหตุผล",
    suspendedContactAdmin: "กรุณาติดต่อแอดมินเพื่อขอข้อมูลเพิ่มเติม",
    editRestaurantInfo: "แก้ไขข้อมูลร้าน",
    goToDashboard: "ไปที่แดชบอร์ด",
    noRestaurantsYet: "คุณยังไม่มีร้านที่ลงทะเบียน",
    registerNow: "ลงทะเบียนร้านเลย",
    selectRestaurantLabel: "เลือกร้าน",

    // /owner/settings
    settingsTitle: "ตั้งค่าร้าน",
    generalInfoTab: "ข้อมูลทั่วไป",
    openingHoursTab: "เวลาทำการ",
    bookingSettingsTab: "ตั้งค่าการจอง",
    saveButton: "บันทึก",
    savePending: "กำลังบันทึก...",
    saveSuccess: "บันทึกสำเร็จ",
    closedToggleLabel: "ปิดวันนี้",
    // aria-label only (Task 9 phase 2 accessibility audit) — the visible day
    // name (DAY_OF_WEEK_LABELS_TH) next to each time input isn't
    // programmatically bound to it (a <p>, not a <label>), so a screen
    // reader tabbing between the open/close inputs on a given row can't
    // otherwise tell which day or which boundary it's on.
    hoursOpenTimeLabel: (day: string) => `เวลาเปิด ${day}`,
    hoursCloseTimeLabel: (day: string) => `เวลาปิด ${day}`,
    slotDurationLabel: "ความยาวรอบ (นาที)",
    capacityPerSlotLabel: "จำนวนที่นั่งต่อรอบ",
    maxPartySizeLabel: "จำนวนคนสูงสุดต่อการจอง",
    advanceDaysLabel: "จองล่วงหน้าได้กี่วัน",
    minLeadHoursLabel: "ต้องจองล่วงหน้ากี่ชั่วโมง",
    autoConfirmLabel: "ยืนยันการจองอัตโนมัติ",
    slotDurationInvalid: "ความยาวรอบต้องมากกว่า 0 นาที",
    capacityPerSlotInvalid: "จำนวนที่นั่งต่อรอบต้องมากกว่า 0",
    maxPartySizeInvalid: "จำนวนคนสูงสุดต้องมากกว่า 0",
    maxPartySizeExceedsCapacity: "จำนวนคนสูงสุดต่อการจองต้องไม่เกินจำนวนที่นั่งต่อรอบ",
    advanceDaysInvalid: "จองล่วงหน้าต้องอย่างน้อย 1 วัน",
    minLeadHoursInvalid: "ต้องจองล่วงหน้าอย่างน้อย 0 ชั่วโมง",
    hoursTimeFormatInvalid: "รูปแบบเวลาไม่ถูกต้อง กรุณาใช้รูปแบบ HH:MM",
    hoursZeroLengthInvalid: "เวลาเปิดและเวลาปิดต้องไม่เท่ากัน",
    hoursCountInvalid: "ต้องระบุเวลาทำการให้ครบทั้ง 7 วัน",
    hoursDaysInvalid: "ข้อมูลวันในสัปดาห์ไม่ถูกต้อง",

    // Both endpoints check for future active bookings that would conflict
    // with the new values before saving (PUT .../hours, PUT .../settings) —
    // see modules/restaurant/restaurant.service.ts's
    // countBookingsConflictingWithHours/countBookingsConflictingWithSettings
    // and CLAUDE.md's architecture-decisions section for why this warns
    // instead of blocking or auto-cancelling.
    hoursConflictWarning: (count: number) =>
      `การเปลี่ยนเวลาทำการนี้จะกระทบการจองที่มีอยู่แล้ว ${count} รายการ (อยู่นอกเวลาทำการใหม่) การจองเดิมจะไม่ถูกยกเลิก ยืนยันที่จะบันทึกหรือไม่?`,
    settingsConflictWarning: (count: number) =>
      `การเปลี่ยนค่านี้จะกระทบการจองที่มีอยู่แล้ว ${count} รายการ (เกินจำนวนที่นั่งใหม่) การจองเดิมจะไม่ถูกยกเลิก ยืนยันที่จะบันทึกหรือไม่?`,
    confirmSaveWarningTitle: "คำเตือนก่อนบันทึก",
    confirmSaveAnyway: "ยืนยันบันทึก",
    confirmDialogCancel: "ยกเลิก",

    // /owner/status — resubmit after REJECTED
    resubmitButton: "ส่งตรวจอีกครั้ง",
    resubmitConfirmTitle: "ยืนยันส่งตรวจอีกครั้ง?",
    resubmitConfirmDescription: "ร้านของคุณจะกลับไปอยู่ในสถานะรอตรวจสอบ แอดมินจะตรวจสอบข้อมูลร้านอีกครั้ง",
    resubmitPending: "กำลังส่ง...",
    resubmitOnlyFromRejected: "ส่งตรวจใหม่ได้เฉพาะร้านที่ถูกปฏิเสธเท่านั้น",

    // /owner/dashboard — daily booking management, not returned by any service.
    dashboardTitle: "แดชบอร์ดจัดการการจอง",
    dashboardDateLabel: "วันที่",
    dashboardStatBookings: "จองวันนี้",
    dashboardStatSeats: "ที่นั่งรวม",
    dashboardStatPending: "รอยืนยัน",
    dashboardStatNoShow: "No-show",
    dashboardEmptyTitle: "ไม่มีการจองในวันที่เลือก",
    dashboardNoName: "ไม่ระบุชื่อ",
    dashboardNoPhone: "ไม่มีเบอร์โทร",
    dashboardNoteLabel: "หมายเหตุ",
    dashboardConfirmAction: "ยืนยัน",
    dashboardRejectAction: "ปฏิเสธ",
    dashboardCancelAction: "ยกเลิก",
    dashboardCheckInAction: "เช็คอิน",
    dashboardNoShowAction: "ไม่มาตามนัด",
    dashboardCompleteAction: "เสร็จสิ้น",
    dashboardActionPending: "กำลังดำเนินการ...",
    dashboardRejectDialogTitle: "ปฏิเสธการจองนี้?",
    dashboardRejectReasonLabel: "เหตุผล (จำเป็น)",
    dashboardRejectReasonRequired: "กรุณาระบุเหตุผล",
    dashboardRejectConfirm: "ยืนยันปฏิเสธ",
    // ยกเลิกแทนลูกค้า (เช่นลูกค้าโทรมาแจ้ง) — แยกจาก "ปฏิเสธ" ตรงที่ร้าน
    // ไม่ได้เป็นฝ่ายปฏิเสธ ลูกค้าเป็นฝ่ายไม่มาแล้ว ดู CLAUDE.md
    dashboardCancelDialogTitle: "ยกเลิกการจองนี้แทนลูกค้า?",
    dashboardCancelReasonLabel: "เหตุผล (จำเป็น) — เช่น ลูกค้าโทรมาแจ้งยกเลิก",
    dashboardCancelConfirm: "ยืนยันยกเลิก",
    dashboardSlotsTitle: "มุมมองรายรอบ",
    dashboardSlotsEmpty: "ไม่มีรอบเวลาสำหรับวันที่เลือก (ร้านปิดหรือยังไม่ตั้งค่าการจอง)",
    dashboardNotApprovedMessage: "ร้านนี้ยังไม่เปิดรับจอง ลูกค้าจึงยังจองไม่ได้ — ตัวเลขรอบเวลาด้านล่างจะไม่มีความหมายจนกว่าร้านจะได้รับการอนุมัติ",
    dashboardCheckStatusLink: "ดูสถานะการอนุมัติร้าน",
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

    manageRestaurantsLink: "จัดการร้านอาหาร",
    manageUsersTitle: "จัดการผู้ใช้",
    manageDashboardLink: "สถิติภาพรวม",

    // User management (/admin)
    userSearchPlaceholder: "ค้นหาด้วยอีเมล ชื่อ หรือเบอร์โทร...",
    userRoleFilterLabel: "กรองตามบทบาท",
    userRoleFilterAll: "ทั้งหมด",
    columnEmail: "อีเมล",
    columnName: "ชื่อ",
    columnPhone: "เบอร์โทร",
    columnRole: "บทบาท",
    columnCreatedAt: "วันที่สมัคร",
    columnOwnedRestaurants: "จำนวนร้านที่เป็นเจ้าของ",
    usersEmptyTitle: "ไม่พบผู้ใช้ที่ค้นหา",
    usersEmptyHint: "ลองเปลี่ยนคำค้นหรือตัวกรองบทบาท",

    deleteUserButton: "ลบผู้ใช้",
    deleteUserDialogTitle: "ลบผู้ใช้นี้?",
    deleteUserDialogDescription: (email: string) =>
      `การลบย้อนกลับไม่ได้ พิมพ์อีเมล "${email}" ให้ตรงเพื่อยืนยัน`,
    confirmEmailLabel: "พิมพ์อีเมลเพื่อยืนยัน",
    confirmEmailMismatch: "อีเมลที่พิมพ์ไม่ตรงกับผู้ใช้ที่จะลบ",
    deleteUserDialogCancel: "ยกเลิก",
    deleteUserDialogConfirm: "ยืนยันลบผู้ใช้",
    deleteUserActionPending: "กำลังลบ...",

    roleChangeDisabledSelf: "เปลี่ยนบทบาทตัวเองไม่ได้",
    roleChangeDisabledLastAdmin: "ลดบทบาทไม่ได้ เป็นแอดมินคนเดียวที่เหลืออยู่",

    // Dashboard (/admin/dashboard)
    dashboardOverviewTitle: "สถิติภาพรวม",
    statPendingRestaurants: "ร้านรออนุมัติ",
    statActiveRestaurants: "ร้านที่เปิดใช้งาน",
    statBookingsToday: "การจองวันนี้",
    statTotalUsers: "ผู้ใช้ทั้งหมด",

    bookingTrendTitle: "การจอง 30 วันย้อนหลัง",
    bookingTrendEmpty: "ยังไม่มีการจองในช่วง 30 วันที่ผ่านมา",
    bookingTrendColumnDate: "วันที่",
    bookingTrendColumnTotal: "รวม",
    bookingTrendColumnBreakdown: "แยกตามสถานะ",

    noShowTitle: "อัตรา no-show (30 วันย้อนหลัง)",
    noShowOverallLabel: "ทั้งระบบ",
    noShowNotEnoughData: "ยังมีข้อมูลไม่พอให้คำนวณอัตรา no-show",
    noShowTopTitle: "ร้านที่ no-show สูงสุด",
    noShowTopEmpty: "ยังไม่มีร้านไหนมีการจองครบเกณฑ์ขั้นต่ำ (10 รายการ) ใน 30 วันนี้",
    noShowMinBookingsHint: (min: number) => `นับเฉพาะร้านที่มีการจองอย่างน้อย ${min} รายการ`,

    topRestaurantsTitle: "ร้านที่มีการจองสูงสุด (30 วันย้อนหลัง)",
    topRestaurantsEmpty: "ยังไม่มีการจองในช่วง 30 วันที่ผ่านมา",
    columnBookingCount: "จำนวนการจอง",
    columnNoShowRate: "อัตรา no-show",

    // Queue page (/admin/restaurants)
    queueTitle: "คิวอนุมัติร้าน",
    statusFilterLabel: "กรองตามสถานะ",
    columnRestaurant: "ชื่อร้าน",
    columnOwner: "เจ้าของ",
    columnSubmittedAt: "วันที่ส่ง",
    columnWaiting: "รอมาแล้ว",
    columnReviewedAt: "ตรวจเมื่อ",
    daysWaiting: (days: number) => `${days} วัน`,
    reviewedAtEmpty: "-",
    queueEmptyTitle: "ไม่มีร้านในสถานะนี้",
    queueEmptyHint: "ลองเปลี่ยนตัวกรองสถานะด้านบน",
    backToQueue: "กลับไปคิว",

    // Detail page (/admin/restaurants/[id])
    ownerLabel: "เจ้าของร้าน",
    openingHoursTitle: "เวลาทำการ",
    bookingSettingsTitle: "ตั้งค่าการจอง",
    slotDurationLabel: "ความยาวรอบ (นาที)",
    capacityPerSlotLabel: "ที่นั่งต่อรอบ",
    maxPartySizeLabel: "จำนวนคนต่อโต๊ะสูงสุด",
    advanceDaysLabel: "จองล่วงหน้าได้ (วัน)",
    minLeadHoursLabel: "ต้องจองล่วงหน้าอย่างน้อย (ชั่วโมง)",
    autoConfirmLabel: "ยืนยันการจองอัตโนมัติ",
    autoConfirmYes: "เปิด",
    autoConfirmNo: "ปิด",
    bookingSettingsEmpty: "ร้านนี้ยังไม่มีการตั้งค่าการจอง",

    previousRejectionTitle: "เหตุผลจากการปฏิเสธครั้งก่อน",
    previousRejectionHint:
      "ร้านนี้เคยถูกปฏิเสธมาก่อนด้วยเหตุผลนี้ ตรวจสอบว่าปัญหาที่เคยพบได้รับการแก้ไขแล้วหรือยัง",

    // Checklist is a memory aid only — see the component's own comment for
    // why it must never gate the action buttons.
    checklistTitle: "เช็คลิสต์ก่อนอนุมัติ (ไม่บังคับติ๊ก)",
    checklistItemInfoComplete: "ข้อมูลครบถ้วน",
    checklistItemRealPhotos: "รูปเป็นร้านจริง",
    checklistItemContactable: "เบอร์ติดต่อได้",
    checklistItemAddressReasonable: "ที่อยู่สมเหตุสมผล",

    approveButton: "อนุมัติ",
    rejectButton: "ปฏิเสธ",
    suspendButton: "ระงับ",
    actionPending: "กำลังดำเนินการ...",

    actionSuccessApprove: "อนุมัติร้านนี้แล้ว",
    actionSuccessReject: "ปฏิเสธร้านนี้แล้ว",
    actionSuccessSuspend: "ระงับร้านนี้แล้ว",

    rejectDialogTitle: "ปฏิเสธร้านนี้",
    rejectDialogDescription: "เลือกเหตุผลที่ใช้บ่อย หรือเลือก \"อื่น ๆ\" เพื่อพิมพ์เอง",
    rejectReasonSelectLabel: "เหตุผล",
    rejectReasonBlurryPhoto: "รูปไม่ชัด",
    rejectReasonIncompleteInfo: "ข้อมูลไม่ครบ",
    rejectReasonUnreachable: "ติดต่อไม่ได้",
    rejectReasonDuplicate: "ร้านซ้ำ",
    rejectReasonNotARestaurant: "ไม่ใช่ร้านอาหาร",
    rejectReasonOther: "อื่น ๆ",
    rejectReasonOtherLabel: "ระบุเหตุผล",
    rejectReasonOtherPlaceholder: "ระบุเหตุผล...",
    rejectDialogCancel: "ยกเลิก",
    rejectDialogConfirm: "ยืนยันปฏิเสธ",
  },
} as const;

export const ROLE_LABELS_TH: Record<string, string> = {
  customer: "ลูกค้า",
  owner: "เจ้าของร้าน",
  admin: "แอดมิน",
};

export const RESTAURANT_STATUS_LABELS_TH: Record<string, string> = {
  PENDING: "รอตรวจสอบ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ถูกปฏิเสธ",
  SUSPENDED: "ถูกระงับ",
};

// Semantic color token each restaurant status renders with — mirrors
// BOOKING_STATUS_COLORS's separation from its *_LABELS_TH sibling (see that
// map's comment): admin.service.ts imports RESTAURANT_STATUS_LABELS_TH as
// plain strings for invalidTransition(...), so this stays a separate map.
export const RESTAURANT_STATUS_COLORS: Record<
  string,
  "ok" | "warn" | "bad" | "sky" | "ink-mute"
> = {
  PENDING: "warn",
  APPROVED: "ok",
  REJECTED: "bad",
  SUSPENDED: "bad",
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

// Index 0 = January ... 11 = December, matching Date.getUTCMonth().
export const MONTH_SHORT_TH: string[] = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

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
  CONFIRMATION_REQUIRED: "การเปลี่ยนแปลงนี้กระทบการจองที่มีอยู่แล้ว กรุณายืนยันอีกครั้ง",
  SIGNUP_FAILED: "สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  ROLE_UPDATE_FAILED: "เปลี่ยนบทบาทผู้ใช้ไม่สำเร็จ",
  DELETE_USER_FAILED: "ลบผู้ใช้ไม่สำเร็จ",
  RESTAURANT_CREATE_FAILED: "ลงทะเบียนร้านไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  RESTAURANT_UPDATE_FAILED: "แก้ไขข้อมูลร้านไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  REVIEW_FAILED: "ดำเนินการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  BOOKING_CODE_GENERATION_FAILED: "ไม่สามารถสร้างรหัสการจองได้ กรุณาลองใหม่อีกครั้ง",
  BOOKING_CREATE_FAILED: "จองไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  BOOKING_STATUS_UPDATE_FAILED: "เปลี่ยนสถานะการจองไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  // Generic only — the real wait time is dynamic (MESSAGES.booking.rateLimited),
  // so any call site that can show the server's own `message` should prefer
  // that over this static fallback (see app/restaurants/[id]/booking-box.tsx's
  // errorText).
  RATE_LIMITED: "จองบ่อยเกินไป กรุณาลองใหม่ภายหลัง",
};
