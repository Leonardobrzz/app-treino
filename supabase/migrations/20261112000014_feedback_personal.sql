-- Feedback do personal: dores e profissão, avaliação em categorias, gráficos do painel e marca do personal

-- ===== perfil: profissão, dores e marca =====
alter table public.profiles
  add column if not exists profession text check (char_length(profession) <= 80),
  add column if not exists pains text[] not null default '{}',
  add column if not exists brand_color text check (brand_color ~ '^#[0-9a-fA-F]{6}$'),
  add column if not exists brand_logo text check (char_length(brand_logo) <= 300);

-- ===== avaliação: cardiorrespiratória e funcional =====
alter table public.assessments
  add column if not exists cardio jsonb,
  add column if not exists functional jsonb;

-- dores da anamnese (rótulos) -> ids usados pelo app
create or replace function private.pain_ids(labels text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(distinct id), '{}') from (
    select case
      when x ilike 'joelho%' then 'joelho'
      when x ilike 'coluna%' or x ilike 'lombar%' then 'lombar'
      when x ilike 'pesco%' then 'cervical'
      when x ilike 'ombro%' then 'ombro'
      when x ilike 'quadril%' then 'quadril'
      when x ilike 'punho%' then 'punho'
      when x ilike 'tornozelo%' then 'tornozelo'
    end as id
    from unnest(string_to_array(coalesce(labels, ''), ',')) as u(raw), lateral (select trim(raw) as x) t
  ) s where id is not null;
$$;

-- quando a anamnese é respondida, profissão e dores vão pro perfil do aluno
create or replace function private.anamnese_to_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.answered_at is not null and new.answers is not null then
    update public.profiles set
      profession = coalesce(nullif(left(trim(new.answers->>'profissao'), 80), ''), profession),
      pains = case when new.answers ? 'dores' then private.pain_ids(new.answers->>'dores') else pains end
    where id = new.student_id;
  end if;
  return new;
end;
$$;
drop trigger if exists anamnese_to_profile on public.anamneses;
create trigger anamnese_to_profile after insert or update of answers, answered_at on public.anamneses
for each row execute function private.anamnese_to_profile();

-- o personal ajusta profissão e dores do aluno
create or replace function public.trainer_set_student_info(p_student uuid, p_profession text, p_pains text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_trainer_of(p_student) then raise exception 'aluno não encontrado'; end if;
  update public.profiles set
    profession = nullif(left(trim(coalesce(p_profession, '')), 80), ''),
    pains = coalesce((select array_agg(distinct x) from unnest(p_pains) x where x in ('joelho', 'lombar', 'cervical', 'ombro', 'quadril', 'punho', 'tornozelo')), '{}')
  where id = p_student;
end;
$$;
revoke all on function public.trainer_set_student_info(uuid, text, text[]) from public, anon;
grant execute on function public.trainer_set_student_info(uuid, text, text[]) to authenticated;

-- ===== gráficos do painel do personal =====
create or replace function public.trainer_charts()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with st as (
    select student_id from public.trainer_students where trainer_id = auth.uid() and status = 'ativo'
  ),
  weeks as (
    select generate_series(date_trunc('week', now()) - interval '7 weeks', date_trunc('week', now()), interval '1 week') as w
  ),
  months as (
    select generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') as m
  ),
  last7 as (
    select st.student_id, (select count(*) from public.sessions s where s.user_id = st.student_id and s.finished_at is not null and s.started_at >= now() - interval '7 days') as n
    from st
  )
  select jsonb_build_object(
    'weeks', (select jsonb_agg(jsonb_build_object(
        'week', to_char(w, 'YYYY-MM-DD'),
        'workouts', (select count(*) from public.sessions s join st on st.student_id = s.user_id where s.finished_at is not null and s.started_at >= w and s.started_at < w + interval '1 week'),
        'active', (select count(distinct s.user_id) from public.sessions s join st on st.student_id = s.user_id where s.finished_at is not null and s.started_at >= w and s.started_at < w + interval '1 week')
      ) order by w) from weeks),
    'months', (select jsonb_agg(jsonb_build_object(
        'month', to_char(m, 'YYYY-MM'),
        'paid', coalesce((select sum(c.amount) from public.charges c where c.trainer_id = auth.uid() and c.status = 'paga' and c.due_on >= m and c.due_on < m + interval '1 month'), 0),
        'open', coalesce((select sum(c.amount) from public.charges c where c.trainer_id = auth.uid() and c.status = 'aberta' and c.due_on >= m and c.due_on < m + interval '1 month'), 0)
      ) order by m) from months),
    'freq', jsonb_build_object(
        'none', (select count(*) from last7 where n = 0),
        'low', (select count(*) from last7 where n between 1 and 2),
        'good', (select count(*) from last7 where n >= 3)),
    'goals', coalesce((select jsonb_object_agg(g, n) from (
        select coalesce(p.goal, 'Sem objetivo') g, count(*) n from st join public.profiles p on p.id = st.student_id group by 1) x), '{}'::jsonb)
  );
$$;
revoke all on function public.trainer_charts() from public, anon;
grant execute on function public.trainer_charts() to authenticated;

-- ===== marca do personal pros alunos =====
create or replace function public.my_brand()
returns table (trainer_id uuid, name text, color text, logo text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, coalesce(p.name, 'Personal'), p.brand_color, p.brand_logo
  from public.trainer_students t join public.profiles p on p.id = t.trainer_id
  where t.student_id = auth.uid() and t.status = 'ativo' and (p.brand_color is not null or p.brand_logo is not null)
  order by t.created_at
  limit 1;
$$;
revoke all on function public.my_brand() from public, anon;
grant execute on function public.my_brand() to authenticated;
