"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { MESSAGES } from "@/constants/messages";
import { cn } from "@/lib/utils";
import { logout } from "@/app/actions";
import type { Role } from "@/lib/dal";

type NavLink = { href: string; label: string; prefetch?: boolean };

function buildNavLinks(role: Role | null): NavLink[] {
  const links: NavLink[] = [{ href: "/restaurants", label: MESSAGES.nav.searchRestaurants }];
  if (role === "customer" || role === "owner") {
    links.push({ href: "/bookings/my", label: MESSAGES.nav.myBookings });
  }
  if (role === "owner") {
    // /owner/dashboard doesn't exist yet — the link is added ahead of the
    // page on purpose, per the task that requested this navigation.
    // prefetch={false}: Next.js's <Link> prefetches any href visible in the
    // viewport by default in production, which 404s in the background for
    // a route that isn't built yet. Remove this once the page exists.
    links.push({ href: "/owner/dashboard", label: MESSAGES.nav.myRestaurants, prefetch: false });
  }
  if (role === "admin") {
    links.push({ href: "/admin", label: MESSAGES.nav.adminPanel });
  }
  return links;
}

export function SiteNav({ isLoggedIn, role }: { isLoggedIn: boolean; role: Role | null }) {
  const [open, setOpen] = useState(false);
  const navLinks = buildNavLinks(role);

  return (
    <>
      <nav className="hidden items-center gap-1 sm:flex">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            prefetch={link.prefetch}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            {link.label}
          </Link>
        ))}
        {isLoggedIn ? (
          <>
            <Link href="/dashboard" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              {MESSAGES.nav.dashboard}
            </Link>
            <form action={logout}>
              <Button variant="ghost" size="sm" type="submit">
                {MESSAGES.nav.logout}
              </Button>
            </form>
          </>
        ) : (
          <>
            <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              {MESSAGES.nav.login}
            </Link>
            <Link href="/signup" className={cn(buttonVariants({ variant: "default", size: "sm" }))}>
              {MESSAGES.nav.signup}
            </Link>
          </>
        )}
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={MESSAGES.nav.openMenu}
              className="sm:hidden"
            />
          }
        >
          <Menu />
        </SheetTrigger>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>{MESSAGES.nav.menuTitle}</SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-1 px-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                prefetch={link.prefetch}
                onClick={() => setOpen(false)}
                className={cn(buttonVariants({ variant: "ghost" }), "justify-start")}
              >
                {link.label}
              </Link>
            ))}
            {isLoggedIn && (
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className={cn(buttonVariants({ variant: "ghost" }), "justify-start")}
              >
                {MESSAGES.nav.dashboard}
              </Link>
            )}
          </div>

          <SheetFooter>
            {isLoggedIn ? (
              <form action={logout}>
                <Button
                  variant="outline"
                  type="submit"
                  className="w-full"
                  onClick={() => setOpen(false)}
                >
                  {MESSAGES.nav.logout}
                </Button>
              </form>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  {MESSAGES.nav.login}
                </Link>
                <Link href="/signup" onClick={() => setOpen(false)} className={cn(buttonVariants())}>
                  {MESSAGES.nav.signup}
                </Link>
              </>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
