-- Run this in the Supabase SQL editor for your project.
-- This file is the hand-maintained source of truth for the schema; there is
-- no migration tool, so apply changes here manually and re-run the whole
-- file (every statement below is written to be safe to re-run).

-- ============================================================
-- Roles & profiles
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('admin', 'owner', 'customer');
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role public.user_role not null default 'customer',
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade path for databases created from the old schema, where role was
-- `text not null default 'user' check (role in ('user', 'admin'))`.
-- No-op when the table was just created above with the enum type already.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'role' and data_type <> 'USER-DEFINED'
  ) then
    alter table public.profiles drop constraint if exists profiles_role_check;
    alter table public.profiles alter column role drop default;
    alter table public.profiles
      alter column role type public.user_role
      using (case when role = 'user' then 'customer' else role end)::public.user_role;
    alter table public.profiles alter column role set default 'customer';
  end if;
end $$;

alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- security definer so this can be called from RLS policies (including on
-- profiles itself) without recursing back into those same policies.
create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid()
$$;

drop function if exists public.is_admin(uuid);

-- Block role changes from anyone except an admin (or a service-role script,
-- which has no auth.uid() and so is exempt from this check).
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role <> old.role
     and auth.uid() is not null
     and public.current_role() <> 'admin' then
    raise exception 'Only admins can change a profile role.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.current_role() = 'admin');

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Admins can update any profile" on public.profiles;
create policy "Admins can update any profile"
  on public.profiles for update
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- No insert policy for clients: rows are only created by the trigger below.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Restaurants (rough shape for now — no UI built against this yet)
-- ============================================================

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text,
  address text,
  phone text,
  open_time time,
  close_time time,
  capacity integer,
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);

-- Block is_approved changes from anyone except an admin (or a service-role
-- script), same pattern as protect_profile_role above.
create or replace function public.protect_restaurant_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_approved <> old.is_approved
     and auth.uid() is not null
     and public.current_role() <> 'admin' then
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
  using (is_approved = true);

drop policy if exists "Owners can view own restaurants" on public.restaurants;
create policy "Owners can view own restaurants"
  on public.restaurants for select
  using (owner_id = auth.uid());

drop policy if exists "Owners can insert own restaurants" on public.restaurants;
create policy "Owners can insert own restaurants"
  on public.restaurants for insert
  with check (owner_id = auth.uid());

drop policy if exists "Owners can update own restaurants" on public.restaurants;
create policy "Owners can update own restaurants"
  on public.restaurants for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Admins manage all restaurants" on public.restaurants;
create policy "Admins manage all restaurants"
  on public.restaurants for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- ============================================================
-- Reservations (rough shape for now — no UI built against this yet)
-- ============================================================

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  reserved_at timestamptz not null,
  party_size integer not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled', 'completed')),
  note text,
  created_at timestamptz not null default now()
);

alter table public.reservations enable row level security;

drop policy if exists "Customers view own reservations" on public.reservations;
create policy "Customers view own reservations"
  on public.reservations for select
  using (customer_id = auth.uid());

drop policy if exists "Customers insert own reservations" on public.reservations;
create policy "Customers insert own reservations"
  on public.reservations for insert
  with check (customer_id = auth.uid());

drop policy if exists "Customers update own reservations" on public.reservations;
create policy "Customers update own reservations"
  on public.reservations for update
  using (customer_id = auth.uid())
  with check (customer_id = auth.uid());

drop policy if exists "Owners view reservations for own restaurants" on public.reservations;
create policy "Owners view reservations for own restaurants"
  on public.reservations for select
  using (
    exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id and r.owner_id = auth.uid()
    )
  );

drop policy if exists "Owners update reservations for own restaurants" on public.reservations;
create policy "Owners update reservations for own restaurants"
  on public.reservations for update
  using (
    exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id and r.owner_id = auth.uid()
    )
  );

drop policy if exists "Admins manage all reservations" on public.reservations;
create policy "Admins manage all reservations"
  on public.reservations for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- Bootstrap: there is no admin yet, so promote your first admin manually.
-- update public.profiles set role = 'admin' where email = 'you@example.com';
