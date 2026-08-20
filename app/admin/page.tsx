import Link from "next/link";
import { requireRole, type Profile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";
import { cn } from "@/lib/utils";
import { AdminUserTable } from "./admin-user-table";

export default async function AdminPage() {
  const profile = await requireRole("admin");

  const supabase = await createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("id, email, role")
    .order("email");

  return (
    <div className="flex flex-1 flex-col items-center gap-6 bg-canvas px-4 py-16">
      <h1 className="font-heading text-2xl font-semibold text-ink">{MESSAGES.nav.adminPanel}</h1>
      <Link href="/admin/restaurants" className={cn(buttonVariants({ variant: "outline" }))}>
        {MESSAGES.admin.manageRestaurantsLink}
      </Link>
      <div className="flex w-full max-w-2xl flex-col gap-2">
        <p className="text-sm font-medium text-ink">{MESSAGES.admin.manageUsersTitle}</p>
        <AdminUserTable users={(users ?? []) as Profile[]} currentUserId={profile.id} />
      </div>
    </div>
  );
}
