import Link from "next/link";
import { getProfileOrNull } from "@/lib/dal";
import { SiteNav } from "./site-nav";

export async function SiteHeader() {
  const profile = await getProfileOrNull();

  return (
    <header className="flex items-center justify-between border-b border-gold-dim bg-surface px-6 py-4 text-sm">
      <Link href="/" className="font-heading font-semibold text-ink">
        TableNow
      </Link>

      <SiteNav isLoggedIn={profile !== null} role={profile?.role ?? null} />
    </header>
  );
}
