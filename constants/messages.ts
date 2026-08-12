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
} as const;
