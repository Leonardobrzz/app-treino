-- Extras da área do personal: plano alimentar, metas no app do aluno, alimentação do aluno,
-- histórico de treinos enviados, IA do personal e lembrete mensal dos relatórios.

alter table public.ai_usage drop constraint ai_usage_kind_check;
alter table public.ai_usage add constraint ai_usage_kind_check check (kind in ('ficha', 'resumo', 'personal'));

-- ===== plano alimentar =====
create table public.diet_plans (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Plano alimentar' check (char_length(title) <= 80),
  targets jsonb not null default '{}',
  meals jsonb not null default '[]',
  notes text check (char_length(notes) <= 2000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (length(meals::text) <= 30000)
);
create index diet_plans_student on public.diet_plans (student_id, created_at desc);
create index diet_plans_trainer on public.diet_plans (trainer_id, student_id);
alter table public.diet_plans enable row level security;
create policy "personal ve dietas" on public.diet_plans for select to authenticated using (trainer_id = (select auth.uid()));
create policy "personal cria dieta" on public.diet_plans for insert to authenticated with check (trainer_id = (select auth.uid()) and (select private.is_trainer_of(student_id)));
create policy "personal edita dieta" on public.diet_plans for update to authenticated using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));
create policy "personal apaga dieta" on public.diet_plans for delete to authenticated using (trainer_id = (select auth.uid()));
create policy "aluno ve dieta" on public.diet_plans for select to authenticated using (student_id = (select auth.uid()));

create function private.diet_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare t_name text;
begin
  -- só uma dieta ativa por personal e aluno
  update public.diet_plans set active = false where trainer_id = new.trainer_id and student_id = new.student_id and id <> new.id and active;
  select coalesce(name, 'Seu personal') into t_name from public.profiles where id = new.trainer_id;
  perform private.notify(new.student_id, 'dieta', t_name || ' mandou um plano alimentar', 'Toque pra ver as refeições.', '/meu-personal');
  return new;
end;
$$;
create trigger diet_plans_notify after insert on public.diet_plans for each row execute function private.diet_notify();

-- metas de nutrição definidas pelo personal entram no app do aluno
create function public.trainer_apply_targets(p_student uuid, p_kcal int, p_protein int, p_carbs int, p_fat int, p_water int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_trainer_of(p_student) then raise exception 'aluno não encontrado'; end if;
  update public.profiles set
    kcal_target = coalesce(least(greatest(p_kcal, 800), 6000), kcal_target),
    protein_target = coalesce(least(greatest(p_protein, 20), 400), protein_target),
    carbs_target = coalesce(least(greatest(p_carbs, 0), 900), carbs_target),
    fat_target = coalesce(least(greatest(p_fat, 10), 300), fat_target),
    water_target_ml = coalesce(least(greatest(p_water, 500), 8000), water_target_ml)
  where id = p_student;
  perform private.notify(p_student, 'metas', 'Seu personal ajustou suas metas de alimentação', null, '/nutricao');
end;
$$;

-- o que o aluno comeu (pro personal acompanhar)
create function public.trainer_student_meals(p_student uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_trainer_of(p_student) then raise exception 'aluno não encontrado'; end if;
  return jsonb_build_object(
    'targets', (select jsonb_build_object('kcal', kcal_target, 'protein', protein_target, 'carbs', carbs_target, 'fat', fat_target, 'water', water_target_ml) from public.profiles where id = p_student),
    'meals', coalesce((select jsonb_agg(jsonb_build_object('eaten_on', m.eaten_on, 'meal', m.meal, 'name', m.name, 'portion', m.portion, 'kcal', m.kcal, 'protein', m.protein, 'carbs', m.carbs, 'fat', m.fat, 'source', m.source, 'created_at', m.created_at) order by m.eaten_on desc, m.created_at)
      from public.meals m where m.user_id = p_student and m.eaten_on between p_from and p_to), '[]'::jsonb),
    'water', coalesce((select jsonb_agg(jsonb_build_object('day', w.logged_on, 'ml', w.ml)) from (
      select logged_on, sum(ml) as ml from public.water_logs where user_id = p_student and logged_on between p_from and p_to group by logged_on) w), '[]'::jsonb)
  );
end;
$$;

-- treinos que este personal já mandou pro aluno (pra voltar numa versão anterior)
create function public.trainer_plan_history(p_student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_trainer_of(p_student) then raise exception 'aluno não encontrado'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', pl.id, 'name', pl.name, 'active', pl.active, 'created_at', pl.created_at, 'days', coalesce((
        select jsonb_agg(jsonb_build_object('weekday', d.weekday, 'title', d.title, 'exercises', coalesce((
          select jsonb_agg(jsonb_build_object('exercise_id', e.exercise_id, 'name', ex.name, 'muscle_group', ex.muscle_group, 'equipment', ex.equipment, 'sets', e.sets, 'reps', e.reps, 'target_weight', e.target_weight, 'rest_seconds', e.rest_seconds, 'notes', e.notes, 'method', e.method) order by e.position)
          from public.plan_exercises e join public.exercises ex on ex.id = e.exercise_id where e.plan_day_id = d.id), '[]'::jsonb)) order by d.weekday)
        from public.plan_days d where d.plan_id = pl.id), '[]'::jsonb)) order by pl.created_at desc)
    from public.plans pl where pl.user_id = p_student and pl.trainer_id = auth.uid()
  ), '[]'::jsonb);
end;
$$;

-- todo dia 1: lembra o personal de gerar o relatório do mês que passou
create function public.monthly_report_reminders(p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare r record; today date := (now() at time zone 'America/Sao_Paulo')::date; m text;
begin
  if p_secret is null or p_secret <> (select value from private.app_secrets where key = 'cron') then raise exception 'não autorizado'; end if;
  if extract(day from today) <> 1 then return; end if;
  m := (array['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'])[extract(month from today - 1)::int];
  for r in select t.trainer_id, count(*) as n from public.trainer_students t where t.status = 'ativo' group by t.trainer_id loop
    if not exists (select 1 from public.notifications n where n.user_id = r.trainer_id and n.kind = 'relatorios' and n.created_at::date = today) then
      insert into public.notifications (user_id, kind, title, body, url) values
        (r.trainer_id, 'relatorios', 'Relatórios de ' || m || ' prontos', 'Gere o PDF de cada aluno (' || r.n || ') e mande pra eles.', '/personal/relatorios');
    end if;
  end loop;
end;
$$;
revoke execute on function public.monthly_report_reminders(text) from public, authenticated;
grant execute on function public.monthly_report_reminders(text) to anon;

do $$
declare f text;
begin
  foreach f in array array[
    'public.trainer_apply_targets(uuid, int, int, int, int, int)', 'public.trainer_student_meals(uuid, date, date)', 'public.trainer_plan_history(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
