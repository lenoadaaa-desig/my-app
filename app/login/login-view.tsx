"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "./actions";
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

export function LoginView() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <div className="flex flex-1 items-center justify-center bg-canvas px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">เข้าสู่ระบบ</CardTitle>
          <CardDescription>เข้าสู่ระบบเพื่อจองโต๊ะและจัดการการจองของคุณ</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="flex flex-col gap-4">
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
                autoComplete="current-password"
              />
            </div>

            {state?.error && <p className="text-sm text-bad">{state.error}</p>}

            <Button type="submit" disabled={pending} className="mt-2 w-full">
              {pending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </Button>

            <p className="text-sm text-ink-soft">
              ยังไม่มีบัญชี?{" "}
              <Link href="/signup" className="font-medium text-gold hover:underline">
                สมัครสมาชิก
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
