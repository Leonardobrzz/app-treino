-- Painel do dono (/admin): números do app inteiro, só para e-mails da lista de admins.
-- As funções rodam como security definer (enxergam todos os usuários), mas recusam qualquer
-- chamada de quem não está em private.app_admins. A lista fica num schema privado, fora da API.

create table if not exists private.app_admins (email text primary key);
insert into private.app_admins (email) values
  ('arraiamidas@gmail.com'),
  ('leonardobrzz45@gmail.com'),
  ('leonardoalves@alu.ufc.br')
on conflict do nothing;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from private.app_admins a where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

create or replace function private.require_admin()
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
end;
$$;

-- contas de teste ficam fora dos números quando hide_tests = true
create or replace function private.is_test(email text)
returns boolean language sql immutable set search_path = '' as $$ select coalesce(email, '') like '%@carga.app' $$;

create or replace function public.admin_overview(hide_tests boolean default true)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  r jsonb;
  tz text := 'America/Sao_Paulo';
begin
  perform private.require_admin();
  with u as (
    select id, email, created_at from auth.users where not (hide_tests and private.is_test(email))
  ),
  s as (
    select sub.* from public.subscriptions sub join u on u.id = sub.user_id
  )
  select jsonb_build_object(
    'users_total', (select count(*) from u),
    'users_today', (select count(*) from u where (created_at at time zone tz)::date = (now() at time zone tz)::date),
    'users_7d', (select count(*) from u where created_at > now() - interval '7 days'),
    'users_30d', (select count(*) from u where created_at > now() - interval '30 days'),
    'confirmed', (select count(*) from auth.users au join u on u.id = au.id where au.email_confirmed_at is not null),
    'onboarded', (select count(*) from public.profiles p join u on u.id = p.id where p.onboarded_at is not null),
    'trialing', (select count(*) from s where status = 'trialing'),
    'active', (select count(*) from s where status = 'active'),
    'active_month', (select count(*) from s where status = 'active' and plan_interval = 'mensal'),
    'active_year', (select count(*) from s where status = 'active' and plan_interval = 'anual'),
    'canceling', (select count(*) from s where status in ('active', 'trialing') and cancel_at_period_end),
    'canceled', (select count(*) from s where status in ('canceled', 'unpaid', 'incomplete_expired')),
    'past_due', (select count(*) from s where status = 'past_due'),
    'trained_7d', (select count(distinct se.user_id) from public.sessions se join u on u.id = se.user_id
                   where se.finished_at is not null and se.started_at > now() - interval '7 days'),
    'trained_ever', (select count(distinct se.user_id) from public.sessions se join u on u.id = se.user_id where se.finished_at is not null),
    'workouts_30d', (select count(*) from public.sessions se join u on u.id = se.user_id
                     where se.finished_at is not null and se.started_at > now() - interval '30 days'),
    'meals_30d', (select count(*) from public.meals m join u on u.id = m.user_id where m.created_at > now() - interval '30 days'),
    -- uso de IA no mês corrente (base do custo estimado)
    'ai_chat_pro_month', (select count(*) from public.ai_messages am join u on u.id = am.user_id
                          left join public.subscriptions sb on sb.user_id = am.user_id
                          where am.role = 'user' and am.created_at >= date_trunc('month', now())
                            and coalesce(sb.status, 'none') in ('active', 'trialing')),
    'ai_chat_free_month', (select count(*) from public.ai_messages am join u on u.id = am.user_id
                           left join public.subscriptions sb on sb.user_id = am.user_id
                           where am.role = 'user' and am.created_at >= date_trunc('month', now())
                             and coalesce(sb.status, 'none') not in ('active', 'trialing')),
    'ai_food_month', (select count(*) from public.nutrition_scans ns join u on u.id = ns.user_id where ns.created_at >= date_trunc('month', now())),
    'ai_ficha_month', (select count(*) from public.ai_usage au join u on u.id = au.user_id where au.kind = 'ficha' and au.created_at >= date_trunc('month', now())),
    'ai_resumo_month', (select count(*) from public.ai_usage au join u on u.id = au.user_id where au.kind = 'resumo' and au.created_at >= date_trunc('month', now())),
    'signups_by_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'n', coalesce(c.n, 0)) order by d), '[]'::jsonb)
      from generate_series((now() at time zone tz)::date - 29, (now() at time zone tz)::date, interval '1 day') d
      left join (select (created_at at time zone tz)::date as day, count(*) n from u group by 1) c on c.day = d::date
    )
  ) into r;
  return r;
end;
$$;

create or replace function public.admin_users(hide_tests boolean default true)
returns table (
  id uuid, email text, name text, created_at timestamptz, last_sign_in_at timestamptz, confirmed boolean,
  onboarded boolean, status text, plan_interval text, cancel_at_period_end boolean, current_period_end timestamptz,
  workouts bigint, last_workout timestamptz, ai_messages bigint
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
  select u.id, u.email::text, p.name, u.created_at, u.last_sign_in_at, u.email_confirmed_at is not null,
         p.onboarded_at is not null, coalesce(s.status, 'none'), s.plan_interval, coalesce(s.cancel_at_period_end, false), s.current_period_end,
         (select count(*) from public.sessions se where se.user_id = u.id and se.finished_at is not null),
         (select max(se.started_at) from public.sessions se where se.user_id = u.id and se.finished_at is not null),
         (select count(*) from public.ai_messages am where am.user_id = u.id and am.role = 'user')
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.subscriptions s on s.user_id = u.id
  where not (hide_tests and private.is_test(u.email))
  order by u.created_at desc;
end;
$$;

revoke all on function public.admin_overview(boolean) from public, anon;
revoke all on function public.admin_users(boolean) from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.admin_overview(boolean) to authenticated;
grant execute on function public.admin_users(boolean) to authenticated;
grant execute on function public.is_admin() to authenticated;
