import Link from "next/link";
import { getUser } from "@/lib/dal";
import { logout } from "@/app/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export async function SiteHeader() {
  const user = await getUser();

  return (
    <header className="flex items-center justify-between border-b border-gold-dim bg-surface px-6 py-4 text-sm">
      <Link href="/" className="font-heading font-semibold text-ink">
        TableNow
      </Link>

      <nav className="flex items-center gap-4">
        {user ? (
          <>
            <Link href="/dashboard" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              แดชบอร์ด
            </Link>
            <form action={logout}>
              <Button variant="ghost" size="sm" type="submit">
                ออกจากระบบ
              </Button>
            </form>
          </>
        ) : (
          <>
            <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              เข้าสู่ระบบ
            </Link>
            <Link href="/signup" className={cn(buttonVariants({ variant: "default", size: "sm" }))}>
              สมัครสมาชิก
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
