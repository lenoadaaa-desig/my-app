-- supabase/rls-and-triggers.sql
--
-- This file is NOT a schema. Prisma (prisma/schema.prisma) owns every
-- table, enum, foreign key, and index in `public` — never add a CREATE
-- TABLE / CREATE TYPE / ALTER TABLE ... ADD COLUMN here.
--
-- This file holds only what Prisma cannot express: RLS policies,
-- security-definer functions, and triggers. Every statement is written to
-- be safe to re-run (drop-then-create / create-or-replace), so re-apply
-- this in full after every `prisma migrate dev` / `prisma migrate deploy`
-- that changes table shape.
--
-- This file contains SELECT policies only, on purpose. All writes go
-- through API Routes + Prisma (which connects as `postgres` and bypasses
-- RLS entirely) — never add an INSERT/UPDATE/DELETE policy here, that
-- would open a door for a client to write data around the business logic
-- in modules/. `lib/dal.ts` reads `profiles` through the Supabase server
-- client, which does respect RLS, so the SELECT policies below are load-
-- bearing — do not remove them.
--
-- How to apply:
--   Option A — Supabase Dashboard: SQL Editor -> paste this file -> Run.
--   Option B — psql:
--     psql "$DIRECT_URL" -f supabase/rls-and-triggers.sql
--   Use DIRECT_URL (port 5432), not the pooled DATABASE_URL — DDL over
--   PgBouncer transaction pooling can fail on some statements.

-- ============================================================
-- Roles & profiles
-- ============================================================

drop function if exists public.current_role();

-- security definer so this can be called from RLS policies (including on
-- profiles itself) without recursing back into those same policies. This
-- does NOT bypass RLS by itself — it only changes the effective role to
-- this function's owner. The inner query is safe here because the role
-- that applies this file (`postgres`, via the Dashboard SQL Editor or
-- `psql` on DIRECT_URL/DATABASE_URL) owns `profiles` (pg_tables.tableowner
-- = postgres) AND has rolbypassrls = true directly (verified via
-- pg_roles), and `profiles` has relforcerowsecurity = false — so the
-- inner select skips RLS outright, no recursive policy call happens.
-- Re-verify these three facts before relying on this if the DB role setup
-- ever changes. Named `auth_user_role`, not `current_role`, because
-- `current_role` is already a Postgres keyword (paired with
-- `current_user`) and shadowing it is confusing to call correctly.
create or replace function public.auth_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Block role changes from anyone except an admin (or a service-role
-- script, which has no auth.uid() and so is exempt from this check by
-- design). This trigger only protects the Supabase-client write path —
-- Prisma (connected as the `postgres` role) always bypasses it, since
-- auth.uid() is null on that connection. The real enforcement of "only
-- admins change role" must be duplicated in modules/ (see CLAUDE.md
-- "การตัดสินใจสถาปัตยกรรม" #3).
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role <> old.role
     and auth.uid() is not null
     and public.auth_user_role() <> 'admin' then
    raise exception 'Only admins can change a profile role.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- Supabase enables RLS on every new table in this project automatically,
-- so this is a no-op today — kept for explicitness in case that default
-- ever changes, and so this file stays correct if reused on another
-- Supabase project without the same default.
alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.auth_user_role() = 'admin');

-- No write policy here: profiles are created/updated by app code via the
-- service-role client (bypasses RLS) or via Prisma — never via the anon
-- key. See CLAUDE.md "ปัญหาค้างที่ยังไม่แก้" for the matching delete-user
-- requirement (auth.users has no FK to profiles).

-- ============================================================
-- Restaurants
-- ============================================================

-- Block status changes from anyone except an admin (or a service-role
-- script), same pattern and same caveat as protect_profile_role above:
-- protects only the Supabase-client path, Prisma always bypasses it, real
-- enforcement is in modules/.
create or replace function public.protect_restaurant_approval()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status <> old.status
     and auth.uid() is not null
     and public.auth_user_role() <> 'admin' then
    raise exception 'Only admins can change restaurant approval status.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_restaurant_approval on public.restaurants;
create trigger protect_restaurant_approval
  before update on public.restaurants
  for each row execute function public.protect_restaurant_approval();

alter table public.restaurants enable row level security;

drop policy if exists "Anyone can view approved restaurants" on public.restaurants;
create policy "Anyone can view approved restaurants"
  on public.restaurants for select
  using (status = 'approved');

drop policy if exists "Owners can view own restaurants" on public.restaurants;
create policy "Owners can view own restaurants"
  on public.restaurants for select
  using (owner_id = auth.uid());

-- Renamed from "Admins manage all restaurants": SELECT only now — writes
-- (including approval) go through API Routes + Prisma, not this policy.
drop policy if exists "Admins manage all restaurants" on public.restaurants;
drop policy if exists "Admins can view all restaurants" on public.restaurants;
create policy "Admins can view all restaurants"
  on public.restaurants for select
  using (public.auth_user_role() = 'admin');

-- No write policy here: restaurant creation/updates/approval go through
-- API Routes + Prisma.

-- ============================================================
-- Bookings
-- ============================================================

alter table public.bookings enable row level security;

drop policy if exists "Customers view own bookings" on public.bookings;
create policy "Customers view own bookings"
  on public.bookings for select
  using (customer_id = auth.uid());

drop policy if exists "Owners view bookings for own restaurants" on public.bookings;
create policy "Owners view bookings for own restaurants"
  on public.bookings for select
  using (
    exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id and r.owner_id = auth.uid()
    )
  );

-- Renamed from "Admins manage all bookings": SELECT only now — writes
-- (confirm/cancel/check-in/etc.) go through API Routes + Prisma, not this
-- policy. #12 in the earlier review (a customer freely setting their own
-- booking's status via supabase-js from devtools) is exactly why: the fix
-- isn't a trigger to plug that hole, it's not opening the hole at all.
drop policy if exists "Admins manage all bookings" on public.bookings;
drop policy if exists "Admins can view all bookings" on public.bookings;
create policy "Admins can view all bookings"
  on public.bookings for select
  using (public.auth_user_role() = 'admin');

-- No write policy here: booking creation/updates go through API Routes +
-- Prisma.

-- ============================================================
-- Opening hours / booking settings / closures
-- ============================================================

-- No policies here, on purpose. RLS is enabled by Supabase's project
-- default with zero policies defined, which means deny-all for anon and
-- authenticated — nothing reads or writes these tables via a client key.
-- All access to opening_hours, booking_settings, and closures goes
-- through API Routes + Prisma (the `postgres` role, which bypasses RLS).
-- Do not add a policy here without a specific client-side read need.

-- Bootstrap: there is no admin yet, so promote your first admin manually.
-- update public.profiles set role = 'admin' where email = 'you@example.com';
