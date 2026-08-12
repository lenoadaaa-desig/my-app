// Never import this file in a client component.
import "server-only";

import { createClient } from "@supabase/supabase-js";

// Checked at module load, not inside createAdminClient(), so a missing key
// fails immediately with a clear message instead of surfacing later as an
// opaque Supabase 401 deep inside a signup/role-change/delete call.
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY is missing from .env.local. Get it from " +
      "Supabase Dashboard > Project Settings > API Keys > service_role, " +
      "then add it to .env.local (never commit it)."
  );
}

const serviceRoleKey: string = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
