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
