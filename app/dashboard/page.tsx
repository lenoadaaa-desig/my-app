import Link from "next/link";
import { getProfile } from "@/lib/dal";

export default async function DashboardPage() {
  const profile = await getProfile();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-4 text-center dark:bg-black">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
        Welcome, {profile.email}
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Role: <span className="font-medium">{profile.role}</span>
      </p>
      {profile.role === "admin" && (
        <Link
          href="/admin"
          className="text-sm font-medium text-black underline dark:text-zinc-50"
        >
          Go to admin panel
        </Link>
      )}
    </div>
  );
}
