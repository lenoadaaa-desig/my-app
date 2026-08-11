import Link from "next/link";
import { getUser } from "@/lib/dal";
import { logout } from "@/app/actions";

export async function SiteHeader() {
  const user = await getUser();

  return (
    <header className="flex items-center justify-between border-b border-black/[.08] px-6 py-4 text-sm dark:border-white/[.145]">
      <Link href="/" className="font-semibold text-black dark:text-zinc-50">
        my-app
      </Link>

      <nav className="flex items-center gap-4">
        {user ? (
          <>
            <Link href="/dashboard" className="text-zinc-600 dark:text-zinc-400">
              Dashboard
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="text-zinc-600 underline dark:text-zinc-400"
              >
                Log out
              </button>
            </form>
          </>
        ) : (
          <>
            <Link href="/login" className="text-zinc-600 dark:text-zinc-400">
              Log in
            </Link>
            <Link href="/signup" className="font-medium text-black dark:text-zinc-50">
              Sign up
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
