-- AvaGriff initial multi-user schema.
-- Apply only after creating a Supabase project and reviewing this migration.
-- Never expose the service_role key in a browser or mobile app.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table if not exists public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  invited_email text not null,
  token_hash text not null unique,
  invited_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  is_done boolean not null default false,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (household_id is null or household_id is not null)
);

create table if not exists public.important_dates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  event_date date not null,
  created_at timestamptz not null default now()
);

-- Billing state is written only by a trusted server/webhook using service_role.
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null check (provider in ('stripe','apple','google')),
  provider_customer_id text,
  provider_subscription_id text,
  plan text not null default 'free' check (plan in ('free','premium_monthly','premium_annual')),
  status text not null default 'inactive',
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists tasks_owner_created_idx on public.tasks(owner_id, created_at desc);
create index if not exists tasks_household_created_idx on public.tasks(household_id, created_at desc);
create index if not exists dates_owner_date_idx on public.important_dates(owner_id, event_date);
create index if not exists dates_household_date_idx on public.important_dates(household_id, event_date);
create index if not exists members_user_idx on public.household_members(user_id);

-- SECURITY DEFINER helpers avoid recursive RLS lookups on household_members.
create or replace function public.is_household_member(target_household uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.household_members hm
    where hm.household_id = target_household and hm.user_id = auth.uid()
  );
$function$;

create or replace function public.is_household_admin(target_household uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.household_members hm
    where hm.household_id = target_household
      and hm.user_id = auth.uid()
      and hm.role in ('owner','admin')
  );
$$;

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.tasks enable row level security;
alter table public.important_dates enable row level security;
alter table public.subscriptions enable row level security;

create policy "profiles_select_self" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles_insert_self" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles_update_self" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "households_select_members" on public.households for select to authenticated using (public.is_household_member(id));
create policy "households_create_self" on public.households for insert to authenticated with check (created_by = auth.uid());
create policy "households_update_admin" on public.households for update to authenticated using (public.is_household_admin(id)) with check (public.is_household_admin(id));
create policy "households_delete_owner" on public.households for delete to authenticated using (exists (select 1 from public.household_members hm where hm.household_id = id and hm.user_id = auth.uid() and hm.role = 'owner'));

create policy "members_select_household" on public.household_members for select to authenticated using (public.is_household_member(household_id));
create policy "members_insert_admin" on public.household_members for insert to authenticated with check (public.is_household_admin(household_id));
-- Membership role changes are intentionally server-managed; no client UPDATE policy.
create policy "members_delete_self_or_admin_non_owner" on public.household_members for delete to authenticated using (user_id = auth.uid() or (public.is_household_admin(household_id) and role <> 'owner'));

-- Automatically make the household creator its owner, avoiding an ownerless household.
create or replace function public.add_household_creator_as_owner()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $function$
begin
  insert into public.household_members(household_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$function$;
create trigger households_add_creator_owner
after insert on public.households
for each row execute function public.add_household_creator_as_owner();

create policy "invites_select_admin" on public.household_invites for select to authenticated using (public.is_household_admin(household_id));
create policy "invites_insert_admin" on public.household_invites for insert to authenticated with check (public.is_household_admin(household_id) and invited_by = auth.uid());
create policy "invites_delete_admin" on public.household_invites for delete to authenticated using (public.is_household_admin(household_id));

create policy "tasks_select_personal_or_household" on public.tasks for select to authenticated using (owner_id = auth.uid() or (household_id is not null and public.is_household_member(household_id)));
create policy "tasks_insert_personal_or_household" on public.tasks for insert to authenticated with check (owner_id = auth.uid() and (household_id is null or public.is_household_member(household_id)));
create policy "tasks_update_owner_or_household_admin" on public.tasks for update to authenticated using (owner_id = auth.uid() or (household_id is not null and public.is_household_admin(household_id))) with check (owner_id = auth.uid() or (household_id is not null and public.is_household_admin(household_id)));
create policy "tasks_delete_owner_or_household_admin" on public.tasks for delete to authenticated using (owner_id = auth.uid() or (household_id is not null and public.is_household_admin(household_id)));

create policy "dates_select_personal_or_household" on public.important_dates for select to authenticated using (owner_id = auth.uid() or (household_id is not null and public.is_household_member(household_id)));
create policy "dates_insert_personal_or_household" on public.important_dates for insert to authenticated with check (owner_id = auth.uid() and (household_id is null or public.is_household_member(household_id)));
create policy "dates_update_owner_or_household_admin" on public.important_dates for update to authenticated using (owner_id = auth.uid() or (household_id is not null and public.is_household_admin(household_id))) with check (owner_id = auth.uid() or (household_id is not null and public.is_household_admin(household_id)));
create policy "dates_delete_owner_or_household_admin" on public.important_dates for delete to authenticated using (owner_id = auth.uid() or (household_id is not null and public.is_household_admin(household_id)));

create policy "subscriptions_select_self" on public.subscriptions for select to authenticated using (user_id = auth.uid());
-- Intentionally no client INSERT/UPDATE/DELETE policies for subscriptions.
-- Configure Supabase Auth email confirmation, rate limits, redirect URLs and MFA policy
-- in the Supabase dashboard before production. Invite acceptance must be server-verified.
