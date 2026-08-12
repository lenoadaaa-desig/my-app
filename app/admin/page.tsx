import { requireRole, type Profile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { AdminUserTable } from "./admin-user-table";

export default async function AdminPage() {
  const profile = await requireRole("admin");

  const supabase = await createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("id, email, role")
    .order("email");

  return (
    <div className="flex flex-1 flex-col items-center gap-6 bg-zinc-50 px-4 py-16 dark:bg-black">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
        Admin
      </h1>
      <AdminUserTable
        users={(users ?? []) as Profile[]}
        currentUserId={profile.id}
      />
    </div>
  );
}
