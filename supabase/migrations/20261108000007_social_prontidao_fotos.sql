-- Prontidão do dia, uso de IA, resumo semanal, amigos com ranking e fotos de progresso

-- "Como você está hoje?" fica guardado na sessão
alter table public.sessions add column readiness jsonb;

-- uso das funções de IA que têm limite (importar ficha, resumo da semana)
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('ficha', 'resumo')),
  created_at timestamptz not null default now()
);
create index ai_usage_user_time on public.ai_usage (user_id, kind, created_at);
alter table public.ai_usage enable row level security;
create policy "ver uso proprio" on public.ai_usage for select to authenticated using (user_id = (select auth.uid()));
create policy "registrar uso proprio" on public.ai_usage for insert to authenticated with check (user_id = (select auth.uid()));

-- resumo da semana (texto da IA guardado pra não gerar de novo)
create table public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week_start date not null,
  text text not null,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);
alter table public.weekly_reports enable row level security;
create policy "resumos proprios" on public.weekly_reports for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- amigos: cada perfil tem um código de convite; a amizade é criada por quem abre o link
alter table public.profiles add column friend_code text unique default upper(substr(md5(gen_random_uuid()::text), 1, 8));
update public.profiles set friend_code = upper(substr(md5(gen_random_uuid()::text), 1, 8)) where friend_code is null;
alter table public.profiles alter column friend_code set not null;

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_a <> user_b)
);
create unique index friendships_pair on public.friendships (least(user_a, user_b), greatest(user_a, user_b));
create index friendships_b on public.friendships (user_b);
alter table public.friendships enable row level security;
create policy "ver minhas amizades" on public.friendships for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));
create policy "desfazer amizade" on public.friendships for delete to authenticated
  using ((select auth.uid()) in (user_a, user_b));

-- aceitar convite pelo código (não dá pra inserir amizade direto na tabela)
create function public.add_friend(p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  other uuid;
  other_name text;
begin
  if me is null then raise exception 'não autenticado'; end if;
  select id, coalesce(name, 'Seu amigo') into other, other_name from public.profiles where friend_code = upper(trim(p_code));
  if other is null then raise exception 'convite inválido'; end if;
  if other = me then raise exception 'esse é o seu próprio convite'; end if;
  insert into public.friendships (user_a, user_b) values (other, me) on conflict do nothing;
  return other_name;
end;
$$;
revoke execute on function public.add_friend(text) from public, anon;
grant execute on function public.add_friend(text) to authenticated;

-- ranking: só números agregados dos amigos (nada de treino detalhado, peso ou medidas)
create function public.friends_leaderboard(p_since timestamptz)
returns table (user_id uuid, name text, is_me boolean, workouts int, sets int, volume numeric, last_workout timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with people as (
    select auth.uid() as uid
    union
    select case when f.user_a = auth.uid() then f.user_b else f.user_a end
    from public.friendships f
    where auth.uid() in (f.user_a, f.user_b)
  )
  select
    p.uid,
    coalesce(pr.name, 'Sem nome'),
    p.uid = auth.uid(),
    (select count(distinct (s.started_at at time zone 'America/Sao_Paulo')::date)::int from public.sessions s where s.user_id = p.uid and s.finished_at is not null and s.started_at >= p_since),
    (select count(*)::int from public.session_sets ss join public.sessions s on s.id = ss.session_id
       where s.user_id = p.uid and ss.done and s.finished_at is not null and s.started_at >= p_since),
    (select coalesce(sum(ss.weight * ss.reps), 0) from public.session_sets ss join public.sessions s on s.id = ss.session_id
       where s.user_id = p.uid and ss.done and s.finished_at is not null and s.started_at >= p_since),
    (select max(s.finished_at) from public.sessions s where s.user_id = p.uid and s.finished_at is not null)
  from people p
  join public.profiles pr on pr.id = p.uid
  where auth.uid() is not null;
$$;
revoke execute on function public.friends_leaderboard(timestamptz) from public, anon;
grant execute on function public.friends_leaderboard(timestamptz) to authenticated;

-- fotos de progresso (bucket privado, cada um só acessa a própria pasta)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progresso', 'progresso', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "ver fotos proprias" on storage.objects for select to authenticated
  using (bucket_id = 'progresso' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "enviar fotos proprias" on storage.objects for insert to authenticated
  with check (bucket_id = 'progresso' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "apagar fotos proprias" on storage.objects for delete to authenticated
  using (bucket_id = 'progresso' and (storage.foldername(name))[1] = (select auth.uid())::text);

create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  taken_on date not null default current_date,
  pose text not null check (pose in ('frente', 'lado', 'costas')),
  path text not null,
  created_at timestamptz not null default now()
);
create index progress_photos_user on public.progress_photos (user_id, taken_on);
alter table public.progress_photos enable row level security;
create policy "fotos proprias" on public.progress_photos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
