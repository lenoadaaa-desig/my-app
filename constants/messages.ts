export const MESSAGES = {
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
