-- Admin push subscription IDs — allows direct device targeting via OneSignal.
-- Run this in the Supabase SQL editor.
create table if not exists admin_push_subscriptions (
  id               uuid primary key default gen_random_uuid(),
  subscription_id  text not null unique,
  created_at       timestamptz not null default now()
);
