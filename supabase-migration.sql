-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ocsrwhjypawbeoeyhfnc/sql

create table if not exists public.subscriptions (
  id                      uuid default gen_random_uuid() primary key,
  user_id                 uuid references auth.users(id) on delete cascade unique not null,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  status                  text,   -- 'trialing' | 'active' | 'past_due' | 'canceled'
  plan                    text,   -- 'beta_monthly' | 'beta_yearly' | 'pro_monthly' | 'pro_yearly'
  trial_end               timestamptz,
  current_period_end      timestamptz,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

-- Row Level Security: users can only read their own subscription
alter table public.subscriptions enable row level security;

create policy "Users can view own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Service role can do anything (for webhook)
create policy "Service role full access"
  on public.subscriptions for all
  using (true)
  with check (true);

-- Push notification subscriptions
create table if not exists public.push_subscriptions (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references auth.users(id) on delete cascade unique not null,
  subscription jsonb not null,
  updated_at   timestamptz default now()
);

alter table public.push_subscriptions enable row level security;

create policy "Users can manage own push subscription"
  on public.push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Service role full access push"
  on public.push_subscriptions for all
  using (true)
  with check (true);

-- BETS TABLE
create table if not exists public.bets (
  id           uuid default gen_random_uuid() primary key,
  client_id    text not null,
  user_id      uuid references auth.users(id) on delete cascade not null,
  date         text,
  sport        text,
  book         text,
  bet_type     text default 'Straight',
  event        text,
  pick         text,
  odds         numeric default 0,
  units        numeric default 0,
  stake        numeric default 0,
  result       text default 'Open',
  pnl          numeric default 0,
  ladder       boolean default false,
  ladder_id    integer,
  pull         boolean default false,
  pull_note    text,
  notes        text,
  confidence   integer,
  updated_at   timestamptz default now(),
  unique (client_id, user_id)
);

alter table public.bets enable row level security;

create policy "Users can manage own bets"
  on public.bets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- USER SETTINGS TABLE
create table if not exists public.user_settings (
  id               uuid default gen_random_uuid() primary key,
  user_id          uuid references auth.users(id) on delete cascade unique not null,
  bankroll         numeric default 1000,
  ladder_starting  numeric default 150,
  username         text default 'OPERATOR',
  risk_settings    jsonb default '{}',
  dark_mode        boolean default true,
  updated_at       timestamptz default now()
);

alter table public.user_settings enable row level security;

create policy "Users can manage own settings"
  on public.user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- TEMPLATES TABLE
create table if not exists public.templates (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references auth.users(id) on delete cascade not null,
  name         text not null,
  bankroll     numeric,
  username     text,
  risk_settings jsonb default '{}',
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique (name, user_id)
);

alter table public.templates enable row level security;

create policy "Users can manage own templates"
  on public.templates for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
