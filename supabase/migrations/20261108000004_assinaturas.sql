-- Assinaturas do Carga Pro (sincronizadas pelo webhook do Stripe)
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.app_secrets (key text primary key, value text not null);
-- Depois de rodar, cadastre o segredo (o mesmo de SUBSCRIPTION_SYNC_SECRET):
-- insert into private.app_secrets (key, value) values ('subscription_sync', '<segredo>');

create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text,
  status text not null default 'none',
  plan_interval text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  trial_used boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
-- o usuário só lê a própria assinatura; quem escreve é o webhook, pela função abaixo
create policy "ver propria assinatura" on public.subscriptions for select to authenticated using (user_id = (select auth.uid()));

-- Chamada pelo webhook (sem sessão). Protegida por um segredo que só o servidor conhece.
create function public.sync_subscription(
  p_secret text, p_user uuid, p_customer text, p_subscription text, p_status text,
  p_interval text, p_period_end timestamptz, p_cancel_at_period_end boolean
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_secret is null or p_secret <> (select value from private.app_secrets where key = 'subscription_sync') then
    raise exception 'não autorizado';
  end if;
  insert into public.subscriptions as s (user_id, stripe_customer_id, stripe_subscription_id, status, plan_interval, current_period_end, cancel_at_period_end, trial_used, updated_at)
  values (p_user, p_customer, p_subscription, p_status, p_interval, p_period_end, coalesce(p_cancel_at_period_end, false), p_status in ('trialing','active','past_due','canceled'), now())
  on conflict (user_id) do update set
    stripe_customer_id = coalesce(excluded.stripe_customer_id, s.stripe_customer_id),
    stripe_subscription_id = coalesce(excluded.stripe_subscription_id, s.stripe_subscription_id),
    status = excluded.status,
    plan_interval = coalesce(excluded.plan_interval, s.plan_interval),
    current_period_end = coalesce(excluded.current_period_end, s.current_period_end),
    cancel_at_period_end = excluded.cancel_at_period_end,
    trial_used = s.trial_used or excluded.trial_used,
    updated_at = now();
end $$;
revoke execute on function public.sync_subscription from public, authenticated;
grant execute on function public.sync_subscription to anon;
