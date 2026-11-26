-- AvaGriff PayPal billing support. Additive migration; do not rerun migration 001.
alter table public.subscriptions
  drop constraint if exists subscriptions_provider_check;

alter table public.subscriptions
  add constraint subscriptions_provider_check
  check (provider in ('stripe','paypal','apple','google'));

create table if not exists public.paypal_webhook_events (
  event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now()
);

alter table public.paypal_webhook_events enable row level security;
-- No client policies: only the trusted Edge Function service role can access this table.
