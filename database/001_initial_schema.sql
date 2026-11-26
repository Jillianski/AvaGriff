-- AvaGriff initial schema starter. Review and security-test before production.
create extension if not exists pgcrypto;
create table if not exists public.profiles(id uuid primary key references auth.users(id) on delete cascade, display_name text, created_at timestamptz not null default now());
create table if not exists public.households(id uuid primary key default gen_random_uuid(), name text not null check(char_length(name) between 1 and 80), created_by uuid not null references auth.users(id), created_at timestamptz not null default now());
create table if not exists public.household_members(household_id uuid not null references public.households(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,role text not null default 'member' check(role in('owner','admin','member')),joined_at timestamptz not null default now(),primary key(household_id,user_id));
create table if not exists public.tasks(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,household_id uuid references public.households(id) on delete cascade,title text not null check(char_length(title) between 1 and 200),due_at timestamptz,is_complete boolean not null default false,completed_at timestamptz,created_at timestamptz not null default now());
create table if not exists public.important_dates(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,household_id uuid references public.households(id) on delete cascade,title text not null check(char_length(title) between 1 and 120),event_date date not null,created_at timestamptz not null default now());
create or replace function public.is_household_member(h uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.household_members m where m.household_id=h and m.user_id=auth.uid()) $$;
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.tasks enable row level security;
alter table public.important_dates enable row level security;
create policy profile_self on public.profiles for all to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy household_member_read on public.households for select to authenticated using(public.is_household_member(id));
create policy household_creator_insert on public.households for insert to authenticated with check(created_by=auth.uid());
create policy household_member_read_members on public.household_members for select to authenticated using(public.is_household_member(household_id));
create policy tasks_read on public.tasks for select to authenticated using(owner_id=auth.uid() or (household_id is not null and public.is_household_member(household_id)));
create policy tasks_insert on public.tasks for insert to authenticated with check(owner_id=auth.uid() and (household_id is null or public.is_household_member(household_id)));
create policy tasks_update on public.tasks for update to authenticated using(owner_id=auth.uid() or (household_id is not null and public.is_household_member(household_id))) with check(owner_id=auth.uid() and (household_id is null or public.is_household_member(household_id)));
create policy dates_read on public.important_dates for select to authenticated using(owner_id=auth.uid() or (household_id is not null and public.is_household_member(household_id)));
create policy dates_insert on public.important_dates for insert to authenticated with check(owner_id=auth.uid() and (household_id is null or public.is_household_member(household_id)));
-- Invitation/membership writes intentionally omitted: implement a server-verified invitation flow first.
