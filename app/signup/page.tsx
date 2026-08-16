"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, undefined);

  return (
    <div className="flex flex-1 items-center justify-center bg-canvas px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">สมัครสมาชิก</CardTitle>
          <CardDescription>สร้างบัญชีเพื่อเริ่มจองโต๊ะร้านอาหาร</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">ชื่อ-นามสกุล</Label>
              <Input id="name" name="name" type="text" required autoComplete="name" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">เบอร์โทรศัพท์</Label>
              <Input id="phone" name="phone" type="tel" required autoComplete="tel" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">อีเมล</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">รหัสผ่าน</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            {state && "error" in state && (
              <p className="text-sm text-bad">{state.error}</p>
            )}
            {state && "message" in state && (
              <p className="text-sm text-ok">{state.message}</p>
            )}

            <Button type="submit" disabled={pending} className="mt-2 w-full">
              {pending ? "กำลังสมัครสมาชิก..." : "สมัครสมาชิก"}
            </Button>

            <p className="text-sm text-ink-soft">
              มีบัญชีอยู่แล้ว?{" "}
              <Link href="/login" className="font-medium text-gold hover:underline">
                เข้าสู่ระบบ
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
