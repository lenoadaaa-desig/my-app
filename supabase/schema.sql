-- Run this in the Supabase SQL editor for your project.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- security definer so this can be called from RLS policies on profiles
-- without recursing back into those same policies.
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = uid and role = 'admin'
  );
$$;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin(auth.uid()));

-- Intentionally no self-update policy: users have no path to change their
-- own role. Only admins can update any profile (including role).
create policy "Admins can update any profile"
  on public.profiles for update
  using (public.is_admin(auth.uid()));

-- Auto-create a profile row (role defaults to 'user') whenever someone signs up.
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

-- Bootstrap: there is no admin yet, so promote your first admin manually.
-- update public.profiles set role = 'admin' where email = 'you@example.com';
