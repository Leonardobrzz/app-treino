-- Área do personal: vínculo com alunos, anamnese, avaliação física, treino enviado,
-- cobrança por Pix (o dinheiro vai direto pro personal), agenda, desafios, vitrine e avisos (push).
-- O personal NUNCA lê as tabelas do aluno direto: tudo passa por funções que conferem o vínculo.

-- ===== perfil do personal =====
alter table public.profiles
  add column is_trainer boolean not null default false,
  add column trainer_code text unique,
  add column cref text,
  add column trainer_bio text,
  add column trainer_city text,
  add column whatsapp text,
  add column pix_key text,
  add column pix_name text,
  add column showcase_public boolean not null default false;

create function public.become_trainer(p_cref text, p_bio text, p_city text, p_whatsapp text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare me uuid := auth.uid(); code text;
begin
  if me is null then raise exception 'não autenticado'; end if;
  select trainer_code into code from public.profiles where id = me;
  if code is null then
    loop
      code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
      exit when not exists (select 1 from public.profiles where trainer_code = code);
    end loop;
  end if;
  update public.profiles set is_trainer = true, trainer_code = code,
    cref = nullif(trim(left(p_cref, 30)), ''), trainer_bio = nullif(trim(left(p_bio, 400)), ''),
    trainer_city = nullif(trim(left(p_city, 60)), ''), whatsapp = nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), '')
  where id = me;
  return code;
end;
$$;

-- ===== vínculo personal ↔ aluno =====
create table public.trainer_students (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'ativo' check (status in ('ativo', 'encerrado')),
  fee numeric(8,2) check (fee is null or fee >= 0),
  due_day smallint check (due_day between 1 and 28),
  plan_ends_on date,
  phone text,
  notes text check (char_length(notes) <= 2000),
  ranking_opt_in boolean not null default true,
  showcase_consent boolean not null default false,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  check (trainer_id <> student_id)
);
create unique index trainer_students_active on public.trainer_students (trainer_id, student_id) where status = 'ativo';
create index trainer_students_student on public.trainer_students (student_id) where status = 'ativo';
alter table public.trainer_students enable row level security;
create policy "personal ve seus alunos" on public.trainer_students for select to authenticated using (trainer_id = (select auth.uid()));
create policy "aluno ve seus personais" on public.trainer_students for select to authenticated using (student_id = (select auth.uid()));
create policy "personal edita vinculo" on public.trainer_students for update to authenticated
  using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));
-- o personal só mexe nos campos dele (o consentimento é do aluno)
revoke update on public.trainer_students from authenticated, anon;
grant update (fee, due_day, plan_ends_on, phone, notes) on public.trainer_students to authenticated;

create function private.is_trainer_of(student uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.trainer_students t where t.trainer_id = auth.uid() and t.student_id = student and t.status = 'ativo');
$$;
create function private.is_student_of(trainer uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.trainer_students t where t.student_id = auth.uid() and t.trainer_id = trainer and t.status = 'ativo');
$$;
revoke execute on function private.is_trainer_of(uuid) from public, anon;
revoke execute on function private.is_student_of(uuid) from public, anon;
grant execute on function private.is_trainer_of(uuid) to authenticated;
grant execute on function private.is_student_of(uuid) to authenticated;

-- ===== avisos (no app + push) =====
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  kind text not null,
  title text not null check (char_length(title) <= 120),
  body text check (char_length(body) <= 400),
  url text check (char_length(url) <= 200),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  pushed_at timestamptz
);
create index notifications_user on public.notifications (user_id, created_at desc);
create index notifications_pending on public.notifications (created_at) where pushed_at is null;
create index notifications_actor on public.notifications (actor_id);
alter table public.notifications enable row level security;
create policy "ver meus avisos" on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy "marcar aviso lido" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "apagar meu aviso" on public.notifications for delete to authenticated using (user_id = (select auth.uid()));

-- cria aviso pra outra pessoa (só dentro das funções, nunca direto pelo app)
create function private.notify(p_user uuid, p_kind text, p_title text, p_body text, p_url text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, actor_id, kind, title, body, url)
  values (p_user, auth.uid(), p_kind, left(p_title, 120), left(p_body, 400), left(p_url, 200));
$$;
revoke execute on function private.notify(uuid, text, text, text, text) from public, anon, authenticated;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy "minhas inscricoes" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- o servidor pega os pushes que ESTA pessoa gerou e ainda não foram enviados
create function public.take_my_pushes()
returns table (notification_id uuid, title text, body text, url text, endpoint text, key_p256dh text, key_auth text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
    with pend as (
      update public.notifications n set pushed_at = now()
      where n.actor_id = auth.uid() and n.pushed_at is null and n.created_at > now() - interval '15 minutes'
      returning n.id, n.user_id, n.title, n.body, n.url
    )
    select pend.id, pend.title, pend.body, pend.url, s.endpoint, s.p256dh, s.auth
    from pend join public.push_subscriptions s on s.user_id = pend.user_id;
end;
$$;
revoke execute on function public.take_my_pushes() from public, anon;
grant execute on function public.take_my_pushes() to authenticated;

-- inscrição que deu erro 404/410 no envio
create function public.drop_push_endpoint(p_secret text, p_endpoint text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_secret is null or p_secret <> (select value from private.app_secrets where key = 'cron') then raise exception 'não autorizado'; end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
end;
$$;
revoke execute on function public.drop_push_endpoint(text, text) from public, authenticated;
grant execute on function public.drop_push_endpoint(text, text) to anon;

-- ===== convite: o aluno entra pelo código do personal =====
create function public.trainer_by_code(p_code text)
returns table (trainer_id uuid, name text, cref text, bio text, city text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, coalesce(p.name, 'Personal'), p.cref, p.trainer_bio, p.trainer_city
  from public.profiles p where p.is_trainer and p.trainer_code = upper(trim(p_code));
$$;
revoke execute on function public.trainer_by_code(text) from public, anon;
grant execute on function public.trainer_by_code(text) to authenticated;

create function public.join_trainer(p_code text, p_ranking boolean default true)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare me uuid := auth.uid(); t uuid; t_name text; s_name text;
begin
  if me is null then raise exception 'não autenticado'; end if;
  select id, coalesce(name, 'Seu personal') into t, t_name from public.profiles where is_trainer and trainer_code = upper(trim(p_code));
  if t is null then raise exception 'convite inválido'; end if;
  if t = me then raise exception 'esse é o seu próprio convite'; end if;
  if exists (select 1 from public.trainer_students where trainer_id = t and student_id = me and status = 'ativo') then return t_name; end if;
  insert into public.trainer_students (trainer_id, student_id, ranking_opt_in) values (t, me, coalesce(p_ranking, true));
  select coalesce(name, 'Novo aluno') into s_name from public.profiles where id = me;
  perform private.notify(t, 'novo_aluno', s_name || ' entrou como seu aluno', 'Toque pra ver o perfil e mandar a anamnese.', '/personal/alunos');
  return t_name;
end;
$$;
revoke execute on function public.join_trainer(text, boolean) from public, anon;
grant execute on function public.join_trainer(text, boolean) to authenticated;

-- aluno muda as próprias permissões ou sai
create function public.student_link_update(p_trainer uuid, p_ranking boolean, p_showcase boolean, p_leave boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare me uuid := auth.uid(); s_name text;
begin
  if not private.is_student_of(p_trainer) then raise exception 'vínculo não encontrado'; end if;
  if p_leave then
    update public.trainer_students set status = 'encerrado', ended_at = now() where trainer_id = p_trainer and student_id = me and status = 'ativo';
    select coalesce(name, 'Um aluno') into s_name from public.profiles where id = me;
    perform private.notify(p_trainer, 'aluno_saiu', s_name || ' saiu da sua lista de alunos', null, '/personal/alunos');
    delete from public.showcase_items where trainer_id = p_trainer and student_id = me;
  else
    update public.trainer_students set ranking_opt_in = coalesce(p_ranking, ranking_opt_in), showcase_consent = coalesce(p_showcase, showcase_consent)
    where trainer_id = p_trainer and student_id = me and status = 'ativo';
    if p_showcase is false then delete from public.showcase_items where trainer_id = p_trainer and student_id = me; end if;
  end if;
end;
$$;
revoke execute on function public.student_link_update(uuid, boolean, boolean, boolean) from public, anon;
grant execute on function public.student_link_update(uuid, boolean, boolean, boolean) to authenticated;

-- personal encerra o vínculo
create function public.trainer_end_student(p_student uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_trainer_of(p_student) then raise exception 'aluno não encontrado'; end if;
  update public.trainer_students set status = 'encerrado', ended_at = now() where trainer_id = auth.uid() and student_id = p_student and status = 'ativo';
  delete from public.showcase_items where trainer_id = auth.uid() and student_id = p_student;
end;
$$;
revoke execute on function public.trainer_end_student(uuid) from public, anon;
grant execute on function public.trainer_end_student(uuid) to authenticated;

-- o aluno vê os dados públicos dos seus personais
create function public.my_trainers()
returns table (trainer_id uuid, name text, cref text, bio text, city text, whatsapp text, pix_key text, pix_name text, since timestamptz, ranking_opt_in boolean, showcase_consent boolean, plan_ends_on date)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, coalesce(p.name, 'Personal'), p.cref, p.trainer_bio, p.trainer_city, p.whatsapp, p.pix_key, coalesce(p.pix_name, p.name), t.created_at, t.ranking_opt_in, t.showcase_consent, t.plan_ends_on
  from public.trainer_students t join public.profiles p on p.id = t.trainer_id
  where t.student_id = auth.uid() and t.status = 'ativo'
  order by t.created_at;
$$;
revoke execute on function public.my_trainers() from public, anon;
grant execute on function public.my_trainers() to authenticated;

-- ===== detalhes do aluno pro personal =====
create function public.trainer_student(p_student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare r jsonb;
begin
  if not private.is_trainer_of(p_student) then raise exception 'aluno não encontrado'; end if;
  select jsonb_build_object(
    'profile', (select to_jsonb(p) - 'friend_code' - 'trainer_code' - 'pix_key' - 'pix_name' from public.profiles p where p.id = p_student),
    'link', (select to_jsonb(t) from public.trainer_students t where t.trainer_id = auth.uid() and t.student_id = p_student and t.status = 'ativo'),
    'sessions', coalesce((select jsonb_agg(x order by x.started_at desc) from (
        select s.id, s.title, s.started_at, s.finished_at,
          (select count(*) from public.session_sets ss where ss.session_id = s.id and ss.done) as sets,
          (select coalesce(sum(ss.weight * ss.reps), 0) from public.session_sets ss where ss.session_id = s.id and ss.done) as volume
        from public.sessions s where s.user_id = p_student and s.finished_at is not null and s.started_at >= now() - interval '120 days'
      ) x), '[]'::jsonb),
    'weights', coalesce((select jsonb_agg(to_jsonb(w) order by w.measured_on) from public.body_weights w where w.user_id = p_student), '[]'::jsonb),
    'measurements', coalesce((select jsonb_agg(to_jsonb(m) order by m.measured_on) from public.body_measurements m where m.user_id = p_student), '[]'::jsonb),
    'photos', coalesce((select jsonb_agg(to_jsonb(f) order by f.taken_on) from public.progress_photos f where f.user_id = p_student), '[]'::jsonb),
    'plan', (select jsonb_build_object('id', pl.id, 'name', pl.name, 'trainer_id', pl.trainer_id, 'created_at', pl.created_at, 'days', coalesce((
        select jsonb_agg(jsonb_build_object('weekday', d.weekday, 'title', d.title, 'exercises', coalesce((
          select jsonb_agg(jsonb_build_object('exercise_id', e.exercise_id, 'name', ex.name, 'muscle_group', ex.muscle_group, 'equipment', ex.equipment, 'sets', e.sets, 'reps', e.reps, 'target_weight', e.target_weight, 'rest_seconds', e.rest_seconds, 'notes', e.notes, 'method', e.method) order by e.position)
          from public.plan_exercises e join public.exercises ex on ex.id = e.exercise_id where e.plan_day_id = d.id), '[]'::jsonb)) order by d.weekday)
        from public.plan_days d where d.plan_id = pl.id), '[]'::jsonb))
      from public.plans pl where pl.user_id = p_student and pl.active order by pl.created_at desc limit 1)
  ) into r;
  return r;
end;
$$;

-- últimas séries de um exercício (pro personal ver a carga atual)
create function public.trainer_student_sets(p_student uuid, p_session uuid)
returns table (exercise text, set_number smallint, weight numeric, reps smallint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_trainer_of(p_student) then raise exception 'aluno não encontrado'; end if;
  return query select ex.name, ss.set_number, ss.weight, ss.reps
    from public.session_sets ss join public.sessions s on s.id = ss.session_id join public.exercises ex on ex.id = ss.exercise_id
    where s.id = p_session and s.user_id = p_student and ss.done order by ss.created_at, ss.set_number;
end;
$$;

-- dados crus do relatório em PDF de um aluno
create function public.trainer_report_raw(p_student uuid, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare ids uuid[];
begin
  if not private.is_trainer_of(p_student) then raise exception 'aluno não encontrado'; end if;
  select array_agg(id) into ids from public.sessions where user_id = p_student and finished_at is not null and started_at <= (p_to + 1)::timestamptz;
  return jsonb_build_object(
    'profile', (select to_jsonb(p) - 'friend_code' - 'trainer_code' - 'pix_key' from public.profiles p where p.id = p_student),
    'sessions', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'started_at', s.started_at, 'finished_at', s.finished_at) order by s.started_at) from public.sessions s where s.id = any(ids)), '[]'::jsonb),
    'sets', coalesce((select jsonb_agg(jsonb_build_object('weight', ss.weight, 'reps', ss.reps, 'exercise_id', ss.exercise_id, 'session_id', ss.session_id, 'exercises', jsonb_build_object('name', ex.name, 'muscle_group', ex.muscle_group)))
       from public.session_sets ss join public.exercises ex on ex.id = ss.exercise_id where ss.session_id = any(ids) and ss.done), '[]'::jsonb),
    'measurements', coalesce((select jsonb_agg(to_jsonb(m) order by m.measured_on) from public.body_measurements m where m.user_id = p_student), '[]'::jsonb),
    'weights', coalesce((select jsonb_agg(to_jsonb(w) order by w.measured_on) from public.body_weights w where w.user_id = p_student), '[]'::jsonb),
    'meals', coalesce((select jsonb_agg(jsonb_build_object('eaten_on', m.eaten_on, 'kcal', m.kcal, 'protein', m.protein, 'carbs', m.carbs, 'fat', m.fat)) from public.meals m where m.user_id = p_student and m.eaten_on <= p_to), '[]'::jsonb),
    'photos', coalesce((select jsonb_agg(to_jsonb(f) order by f.taken_on) from public.progress_photos f where f.user_id = p_student and f.pose = 'frente'), '[]'::jsonb)
  );
end;
$$;

-- fotos de progresso do aluno: o personal pode abrir
create policy "personal ver fotos do aluno" on storage.objects for select to authenticated
  using (bucket_id = 'progresso' and (select private.is_trainer_of(((storage.foldername(name))[1])::uuid)));

-- ===== treino enviado pelo personal =====
alter table public.plans add column trainer_id uuid references auth.users(id) on delete set null;
alter table public.plan_exercises add column method text check (method in ('biset', 'triset', 'drop', 'piramide', 'restpause', 'cluster', 'isometria', 'cadencia'));

create function public.trainer_send_plan(p_student uuid, p_plan jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare me uuid := auth.uid(); pid uuid; did uuid; d jsonb; e jsonb; i int; t_name text; seen int[] := '{}';
begin
  if not private.is_trainer_of(p_student) then raise exception 'aluno não encontrado'; end if;
  update public.plans set active = false where user_id = p_student and active;
  insert into public.plans (user_id, name, active, trainer_id) values (p_student, left(coalesce(nullif(trim(p_plan->>'name'), ''), 'Treino do personal'), 80), true, me) returning id into pid;
  for d in select * from jsonb_array_elements(coalesce(p_plan->'days', '[]'::jsonb)) loop
    if (d->>'weekday')::int not between 0 and 6 or (d->>'weekday')::int = any(seen) then continue; end if;
    seen := seen || (d->>'weekday')::int;
    insert into public.plan_days (user_id, plan_id, weekday, title) values (p_student, pid, (d->>'weekday')::int, left(coalesce(nullif(trim(d->>'title'), ''), 'Treino'), 80)) returning id into did;
    i := 0;
    for e in select * from jsonb_array_elements(coalesce(d->'exercises', '[]'::jsonb)) loop
      -- só exercícios do catálogo (o aluno não enxerga exercício criado por outra pessoa)
      if not exists (select 1 from public.exercises x where x.id = (e->>'exercise_id')::uuid and x.created_by is null) then continue; end if;
      insert into public.plan_exercises (user_id, plan_day_id, exercise_id, position, sets, reps, target_weight, rest_seconds, notes, method)
      values (p_student, did, (e->>'exercise_id')::uuid, i,
        least(10, greatest(1, coalesce((e->>'sets')::int, 3))), left(coalesce(nullif(e->>'reps', ''), '10'), 8),
        nullif(e->>'target_weight', '')::numeric, least(600, greatest(15, coalesce((e->>'rest_seconds')::int, 90))),
        nullif(left(e->>'notes', 200), ''), nullif(e->>'method', ''));
      i := i + 1;
    end loop;
  end loop;
  select coalesce(name, 'Seu personal') into t_name from public.profiles where id = me;
  perform private.notify(p_student, 'treino_novo', t_name || ' mandou um treino novo', 'Abra pra ver a sua semana.', '/treinos');
  return pid;
end;
$$;

-- ===== anamnese =====
create table public.anamneses (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  extra_questions text[] not null default '{}',
  answers jsonb,
  requested_at timestamptz not null default now(),
  answered_at timestamptz
);
create index anamneses_student on public.anamneses (student_id, requested_at desc);
create index anamneses_trainer on public.anamneses (trainer_id, student_id);
alter table public.anamneses enable row level security;
create policy "personal ve anamnese" on public.anamneses for select to authenticated using (trainer_id = (select auth.uid()) and (select private.is_trainer_of(student_id)));
create policy "aluno ve anamnese" on public.anamneses for select to authenticated using (student_id = (select auth.uid()));

create function public.request_anamnese(p_student uuid, p_extra text[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare aid uuid; t_name text;
begin
  if not private.is_trainer_of(p_student) then raise exception 'aluno não encontrado'; end if;
  insert into public.anamneses (trainer_id, student_id, extra_questions)
  values (auth.uid(), p_student, coalesce((select array_agg(left(q, 200)) from unnest(p_extra[1:15]) q where trim(q) <> ''), '{}'))
  returning id into aid;
  select coalesce(name, 'Seu personal') into t_name from public.profiles where id = auth.uid();
  perform private.notify(p_student, 'anamnese', t_name || ' pediu sua anamnese', 'São perguntas rápidas sobre sua saúde e objetivos.', '/meu-personal/anamnese/' || aid);
  return aid;
end;
$$;

create function public.answer_anamnese(p_id uuid, p_answers jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare t uuid; s_name text;
begin
  if length(p_answers::text) > 20000 then raise exception 'respostas grandes demais'; end if;
  update public.anamneses set answers = p_answers, answered_at = now() where id = p_id and student_id = auth.uid() returning trainer_id into t;
  if t is null then raise exception 'anamnese não encontrada'; end if;
  select coalesce(name, 'Seu aluno') into s_name from public.profiles where id = auth.uid();
  perform private.notify(t, 'anamnese_ok', s_name || ' respondeu a anamnese', null, '/personal/aluno/' || auth.uid() || '?aba=anamnese');
end;
$$;

-- ===== avaliação física =====
create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  assessed_on date not null default current_date,
  sex text check (sex in ('masculino', 'feminino')),
  age smallint check (age between 5 and 110),
  weight numeric(5,1),
  height numeric(5,1),
  protocol text not null default 'nenhum' check (protocol in ('nenhum', 'pollock3', 'pollock7')),
  skinfolds jsonb not null default '{}',
  circumferences jsonb not null default '{}',
  body_fat numeric(4,1),
  fat_mass numeric(5,1),
  lean_mass numeric(5,1),
  posture jsonb not null default '{}',
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now()
);
create index assessments_student on public.assessments (student_id, assessed_on desc);
create index assessments_trainer on public.assessments (trainer_id, student_id);
alter table public.assessments enable row level security;
create policy "personal ve avaliacoes" on public.assessments for select to authenticated using (trainer_id = (select auth.uid()));
create policy "personal cria avaliacao" on public.assessments for insert to authenticated with check (trainer_id = (select auth.uid()) and (select private.is_trainer_of(student_id)));
create policy "personal edita avaliacao" on public.assessments for update to authenticated using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()) and (select private.is_trainer_of(student_id)));
create policy "personal apaga avaliacao" on public.assessments for delete to authenticated using (trainer_id = (select auth.uid()));
create policy "aluno ve avaliacoes" on public.assessments for select to authenticated using (student_id = (select auth.uid()));

create function private.assessment_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify(new.student_id, 'avaliacao', 'Sua avaliação física está pronta', coalesce('Gordura corporal: ' || new.body_fat || '%', 'Toque pra ver os resultados.'), '/meu-personal');
  return new;
end;
$$;
create trigger assessments_notify after insert on public.assessments for each row execute function private.assessment_notify();

-- fotos da avaliação postural: pasta = aluno; o personal envia, os dois veem
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avaliacoes', 'avaliacoes', false, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy "avaliacoes ver" on storage.objects for select to authenticated
  using (bucket_id = 'avaliacoes' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_trainer_of(((storage.foldername(name))[1])::uuid))));
create policy "avaliacoes enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avaliacoes' and (select private.is_trainer_of(((storage.foldername(name))[1])::uuid)));
create policy "avaliacoes apagar" on storage.objects for delete to authenticated
  using (bucket_id = 'avaliacoes' and (select private.is_trainer_of(((storage.foldername(name))[1])::uuid)));

-- ===== cobranças (Pix direto pro personal; o Carga só organiza) =====
create table public.charges (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(8,2) not null check (amount > 0),
  due_on date not null,
  description text check (char_length(description) <= 120),
  status text not null default 'aberta' check (status in ('aberta', 'paga', 'cancelada')),
  paid_at timestamptz,
  receipt_path text,
  receipt_sent_at timestamptz,
  reminded_on date,
  created_at timestamptz not null default now()
);
create unique index charges_once on public.charges (trainer_id, student_id, due_on) where status <> 'cancelada';
create index charges_student on public.charges (student_id, due_on desc);
create index charges_trainer on public.charges (trainer_id, due_on desc);
alter table public.charges enable row level security;
create policy "personal ve cobrancas" on public.charges for select to authenticated using (trainer_id = (select auth.uid()));
create policy "personal cria cobranca" on public.charges for insert to authenticated with check (trainer_id = (select auth.uid()) and (select private.is_trainer_of(student_id)));
create policy "personal edita cobranca" on public.charges for update to authenticated using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));
create policy "personal apaga cobranca" on public.charges for delete to authenticated using (trainer_id = (select auth.uid()) and status <> 'paga');
create policy "aluno ve cobrancas" on public.charges for select to authenticated using (student_id = (select auth.uid()));

create function private.charge_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status = 'aberta' then
    perform private.notify(new.student_id, 'cobranca', 'Nova cobrança: R$ ' || to_char(new.amount, 'FM999G990D00'), coalesce(new.description || ' · ', '') || 'vence em ' || to_char(new.due_on, 'DD/MM'), '/meu-personal');
  elsif tg_op = 'UPDATE' and new.status = 'paga' and old.status <> 'paga' then
    perform private.notify(new.student_id, 'pagamento_ok', 'Pagamento confirmado ✅', 'R$ ' || to_char(new.amount, 'FM999G990D00') || ' de ' || to_char(new.due_on, 'DD/MM'), '/meu-personal');
  end if;
  return new;
end;
$$;
create trigger charges_notify after insert or update of status on public.charges for each row execute function private.charge_notify();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprovantes', 'comprovantes', false, 4194304, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
create policy "comprovante enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'comprovantes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "comprovante ver" on storage.objects for select to authenticated
  using (bucket_id = 'comprovantes' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_trainer_of(((storage.foldername(name))[1])::uuid))));

create function public.send_receipt(p_charge uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare c record; s_name text;
begin
  if split_part(p_path, '/', 1) <> auth.uid()::text then raise exception 'arquivo inválido'; end if;
  update public.charges set receipt_path = p_path, receipt_sent_at = now() where id = p_charge and student_id = auth.uid() and status = 'aberta' returning * into c;
  if c.id is null then raise exception 'cobrança não encontrada'; end if;
  select coalesce(name, 'Seu aluno') into s_name from public.profiles where id = auth.uid();
  perform private.notify(c.trainer_id, 'comprovante', s_name || ' mandou o comprovante', 'R$ ' || to_char(c.amount, 'FM999G990D00') || ' · confira e marque como pago.', '/personal/cobrancas');
end;
$$;

-- ===== agenda =====
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  starts_at timestamptz not null,
  minutes smallint not null default 60 check (minutes between 15 and 240),
  status text not null default 'marcada' check (status in ('marcada', 'feita', 'cancelada')),
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);
create index appointments_trainer on public.appointments (trainer_id, starts_at);
create index appointments_student on public.appointments (student_id, starts_at);
alter table public.appointments enable row level security;
create policy "personal ve agenda" on public.appointments for select to authenticated using (trainer_id = (select auth.uid()));
create policy "personal marca" on public.appointments for insert to authenticated with check (trainer_id = (select auth.uid()) and (select private.is_trainer_of(student_id)));
create policy "personal edita agenda" on public.appointments for update to authenticated using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));
create policy "personal apaga agenda" on public.appointments for delete to authenticated using (trainer_id = (select auth.uid()));
create policy "aluno ve agenda" on public.appointments for select to authenticated using (student_id = (select auth.uid()));

create function private.appointment_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.notify(new.student_id, 'aula', 'Aula marcada: ' || to_char(new.starts_at at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI'), new.note, '/meu-personal');
  elsif new.status = 'cancelada' and old.status <> 'cancelada' then
    perform private.notify(new.student_id, 'aula', 'Aula cancelada: ' || to_char(new.starts_at at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI'), null, '/meu-personal');
  elsif new.starts_at <> old.starts_at then
    perform private.notify(new.student_id, 'aula', 'Aula remarcada pra ' || to_char(new.starts_at at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI'), null, '/meu-personal');
  end if;
  return new;
end;
$$;
create trigger appointments_notify after insert or update on public.appointments for each row execute function private.appointment_notify();

-- ===== desafios entre os alunos do mesmo personal =====
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  metric text not null check (metric in ('treinos', 'volume', 'series')),
  starts_on date not null,
  ends_on date not null,
  prize text check (char_length(prize) <= 120),
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index challenges_trainer on public.challenges (trainer_id, ends_on desc);
alter table public.challenges enable row level security;
create policy "personal gerencia desafios" on public.challenges for all to authenticated
  using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()) and (select is_trainer from public.profiles where id = (select auth.uid())));
create policy "aluno ve desafios" on public.challenges for select to authenticated using ((select private.is_student_of(trainer_id)));

create function private.challenge_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare s uuid;
begin
  for s in select student_id from public.trainer_students where trainer_id = new.trainer_id and status = 'ativo' and ranking_opt_in loop
    perform private.notify(s, 'desafio', 'Novo desafio: ' || new.title, 'De ' || to_char(new.starts_on, 'DD/MM') || ' a ' || to_char(new.ends_on, 'DD/MM') || coalesce(' · prêmio: ' || new.prize, ''), '/meu-personal');
  end loop;
  return new;
end;
$$;
create trigger challenges_notify after insert on public.challenges for each row execute function private.challenge_notify();

-- ranking: o personal vê todos; o aluno vê só quem aceitou aparecer
create function public.challenge_ranking(p_challenge uuid)
returns table (student_id uuid, name text, is_me boolean, workouts int, sets int, volume numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare c record; mine boolean;
begin
  select * into c from public.challenges where id = p_challenge;
  if c.id is null then raise exception 'desafio não encontrado'; end if;
  mine := c.trainer_id = auth.uid();
  if not mine and not private.is_student_of(c.trainer_id) then raise exception 'desafio não encontrado'; end if;
  return query
    select t.student_id, coalesce(p.name, 'Sem nome'), t.student_id = auth.uid(),
      (select count(distinct (s.started_at at time zone 'America/Sao_Paulo')::date)::int from public.sessions s where s.user_id = t.student_id and s.finished_at is not null and (s.started_at at time zone 'America/Sao_Paulo')::date between c.starts_on and c.ends_on),
      (select count(*)::int from public.session_sets ss join public.sessions s on s.id = ss.session_id where s.user_id = t.student_id and ss.done and s.finished_at is not null and (s.started_at at time zone 'America/Sao_Paulo')::date between c.starts_on and c.ends_on),
      (select coalesce(sum(ss.weight * ss.reps), 0) from public.session_sets ss join public.sessions s on s.id = ss.session_id where s.user_id = t.student_id and ss.done and s.finished_at is not null and (s.started_at at time zone 'America/Sao_Paulo')::date between c.starts_on and c.ends_on)
    from public.trainer_students t join public.profiles p on p.id = t.student_id
    where t.trainer_id = c.trainer_id and t.status = 'ativo' and (mine or t.ranking_opt_in or t.student_id = auth.uid());
end;
$$;

-- ===== vitrine pública =====
create table public.showcase_items (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  before_path text not null,
  after_path text not null,
  caption text check (char_length(caption) <= 160),
  created_at timestamptz not null default now()
);
create index showcase_items_trainer on public.showcase_items (trainer_id, created_at desc);
create index showcase_items_student on public.showcase_items (student_id);
alter table public.showcase_items enable row level security;
create policy "personal ve vitrine" on public.showcase_items for select to authenticated using (trainer_id = (select auth.uid()));
create policy "aluno ve vitrine com ele" on public.showcase_items for select to authenticated using (student_id = (select auth.uid()));
create policy "personal poe na vitrine" on public.showcase_items for insert to authenticated with check (
  trainer_id = (select auth.uid())
  and exists (select 1 from public.trainer_students t where t.trainer_id = (select auth.uid()) and t.student_id = showcase_items.student_id and t.status = 'ativo' and t.showcase_consent)
  and split_part(before_path, '/', 1) = (select auth.uid())::text and split_part(after_path, '/', 1) = (select auth.uid())::text
);
create policy "personal tira da vitrine" on public.showcase_items for delete to authenticated using (trainer_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vitrine', 'vitrine', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy "vitrine enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'vitrine' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "vitrine apagar" on storage.objects for delete to authenticated
  using (bucket_id = 'vitrine' and (storage.foldername(name))[1] = (select auth.uid())::text);

create function public.showcase(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', coalesce(p.name, 'Personal'), 'cref', p.cref, 'bio', p.trainer_bio, 'city', p.trainer_city, 'whatsapp', p.whatsapp, 'code', p.trainer_code,
    'students', (select count(*) from public.trainer_students t where t.trainer_id = p.id and t.status = 'ativo'),
    'items', coalesce((select jsonb_agg(jsonb_build_object('before', i.before_path, 'after', i.after_path, 'caption', i.caption) order by i.created_at desc)
      from public.showcase_items i join public.trainer_students t on t.trainer_id = i.trainer_id and t.student_id = i.student_id and t.status = 'ativo' and t.showcase_consent
      where i.trainer_id = p.id), '[]'::jsonb)
  )
  from public.profiles p where p.is_trainer and p.showcase_public and p.trainer_code = upper(trim(p_code));
$$;
grant execute on function public.showcase(text) to anon, authenticated;

-- ===== lembretes diários (chamado pelo cron da Vercel) =====
create function public.daily_reminders(p_secret text)
returns table (notification_id uuid, title text, body text, url text, endpoint text, key_p256dh text, key_auth text)
language plpgsql
security definer
set search_path = ''
as $$
declare r record; today date := (now() at time zone 'America/Sao_Paulo')::date; due date;
begin
  if p_secret is null or p_secret <> (select value from private.app_secrets where key = 'cron') then raise exception 'não autorizado'; end if;

  -- 1) gera a mensalidade 5 dias antes do vencimento
  for r in select * from public.trainer_students where status = 'ativo' and fee > 0 and due_day is not null loop
    due := make_date(extract(year from today)::int, extract(month from today)::int, r.due_day);
    if due < today then due := (due + interval '1 month')::date; end if;
    if due - today <= 5 and not exists (select 1 from public.charges c where c.trainer_id = r.trainer_id and c.student_id = r.student_id and c.due_on = due and c.status <> 'cancelada') then
      insert into public.charges (trainer_id, student_id, amount, due_on, description) values (r.trainer_id, r.student_id, r.fee, due, 'Mensalidade');
    end if;
  end loop;

  -- 2) cobrança vencendo hoje ou atrasada (aviso no máximo a cada 3 dias)
  for r in select c.*, coalesce(p.name, 'Um aluno') as sname from public.charges c join public.profiles p on p.id = c.student_id
    where c.status = 'aberta' and c.receipt_path is null and c.due_on <= today and (c.reminded_on is null or c.reminded_on <= today - 3) loop
    insert into public.notifications (user_id, actor_id, kind, title, body, url) values
      (r.student_id, r.trainer_id, 'cobranca', case when r.due_on = today then 'Sua mensalidade vence hoje' else 'Mensalidade em atraso' end,
       'R$ ' || to_char(r.amount, 'FM999G990D00') || ' · pague pelo Pix no app.', '/meu-personal');
    if r.due_on < today then
      insert into public.notifications (user_id, kind, title, body, url) values
        (r.trainer_id, 'cobranca', r.sname || ' está com a mensalidade atrasada', 'R$ ' || to_char(r.amount, 'FM999G990D00') || ' venceu em ' || to_char(r.due_on, 'DD/MM'), '/personal/cobrancas');
    end if;
    update public.charges set reminded_on = today where id = r.id;
  end loop;

  -- 3) plano do aluno acabando em 7 dias
  for r in select t.*, coalesce(p.name, 'Um aluno') as sname from public.trainer_students t join public.profiles p on p.id = t.student_id
    where t.status = 'ativo' and t.plan_ends_on = today + 7 loop
    insert into public.notifications (user_id, kind, title, body, url) values
      (r.trainer_id, 'plano', 'O plano de ' || r.sname || ' acaba em 7 dias', 'Boa hora pra conversar sobre a renovação.', '/personal/aluno/' || r.student_id),
      (r.student_id, 'plano', 'Seu plano com o personal acaba em 7 dias', 'Fale com ele pra renovar.', '/meu-personal');
  end loop;

  -- 4) aluno sumido há 7 dias (avisa o personal uma vez)
  for r in select t.*, coalesce(p.name, 'Um aluno') as sname from public.trainer_students t join public.profiles p on p.id = t.student_id
    where t.status = 'ativo' and t.created_at < now() - interval '7 days'
      and coalesce((select max(s.finished_at) from public.sessions s where s.user_id = t.student_id), t.created_at)::date = today - 7 loop
    insert into public.notifications (user_id, kind, title, body, url) values
      (r.trainer_id, 'sumido', r.sname || ' não treina há 7 dias', 'Que tal mandar uma mensagem?', '/personal/aluno/' || r.student_id);
  end loop;

  -- 5) aula amanhã
  for r in select a.* from public.appointments a where a.status = 'marcada' and (a.starts_at at time zone 'America/Sao_Paulo')::date = today + 1 loop
    insert into public.notifications (user_id, actor_id, kind, title, body, url) values
      (r.student_id, r.trainer_id, 'aula', 'Lembrete: aula amanhã às ' || to_char(r.starts_at at time zone 'America/Sao_Paulo', 'HH24:MI'), r.note, '/meu-personal');
  end loop;

  return query
    with pend as (
      update public.notifications n set pushed_at = now()
      where n.pushed_at is null and n.created_at > now() - interval '1 day'
      returning n.id, n.user_id, n.title, n.body, n.url
    )
    select pend.id, pend.title, pend.body, pend.url, s.endpoint, s.p256dh, s.auth
    from pend join public.push_subscriptions s on s.user_id = pend.user_id;
end;
$$;
revoke execute on function public.daily_reminders(text) from public, authenticated;
grant execute on function public.daily_reminders(text) to anon;

-- ===== painel do personal (radar) =====
create function public.trainer_dashboard()
returns table (
  student_id uuid, name text, since timestamptz, fee numeric, due_day smallint, plan_ends_on date, phone text,
  last_workout timestamptz, workouts_7d int, workouts_30d int, volume_14d numeric, volume_prev_14d numeric, prs_14d int,
  open_charges int, overdue_charges int, anamnese text, last_assessment date
)
language sql
stable
security definer
set search_path = ''
as $$
  with st as (
    select t.* from public.trainer_students t where t.trainer_id = auth.uid() and t.status = 'ativo'
  ),
  best as (
    -- melhor 1RM estimado por exercício: nos últimos 14 dias e antes disso
    select s.user_id, ss.exercise_id,
      max(case when s.started_at >= now() - interval '14 days' then ss.weight * (1 + ss.reps / 30.0) end) as recent,
      max(case when s.started_at < now() - interval '14 days' then ss.weight * (1 + ss.reps / 30.0) end) as before
    from public.session_sets ss join public.sessions s on s.id = ss.session_id
    where s.user_id in (select student_id from st) and ss.done and s.finished_at is not null
    group by s.user_id, ss.exercise_id
  )
  select st.student_id, coalesce(p.name, 'Sem nome'), st.created_at, st.fee, st.due_day, st.plan_ends_on, st.phone,
    (select max(s.finished_at) from public.sessions s where s.user_id = st.student_id and s.finished_at is not null),
    (select count(*)::int from public.sessions s where s.user_id = st.student_id and s.finished_at is not null and s.started_at >= now() - interval '7 days'),
    (select count(*)::int from public.sessions s where s.user_id = st.student_id and s.finished_at is not null and s.started_at >= now() - interval '30 days'),
    (select coalesce(sum(ss.weight * ss.reps), 0) from public.session_sets ss join public.sessions s on s.id = ss.session_id
       where s.user_id = st.student_id and ss.done and s.finished_at is not null and s.started_at >= now() - interval '14 days'),
    (select coalesce(sum(ss.weight * ss.reps), 0) from public.session_sets ss join public.sessions s on s.id = ss.session_id
       where s.user_id = st.student_id and ss.done and s.finished_at is not null and s.started_at >= now() - interval '28 days' and s.started_at < now() - interval '14 days'),
    (select count(*)::int from best b where b.user_id = st.student_id and b.recent > coalesce(b.before, 0) and b.before is not null),
    (select count(*)::int from public.charges c where c.trainer_id = auth.uid() and c.student_id = st.student_id and c.status = 'aberta'),
    (select count(*)::int from public.charges c where c.trainer_id = auth.uid() and c.student_id = st.student_id and c.status = 'aberta' and c.due_on < current_date),
    (select case when a.answered_at is not null then 'respondida' else 'pendente' end from public.anamneses a where a.trainer_id = auth.uid() and a.student_id = st.student_id order by a.requested_at desc limit 1),
    (select max(x.assessed_on) from public.assessments x where x.trainer_id = auth.uid() and x.student_id = st.student_id)
  from st join public.profiles p on p.id = st.student_id
  order by p.name;
$$;

-- ===== permissões das funções =====
do $$
declare f text;
begin
  foreach f in array array[
    'public.become_trainer(text, text, text, text)', 'public.trainer_dashboard()', 'public.trainer_student(uuid)',
    'public.trainer_student_sets(uuid, uuid)', 'public.trainer_report_raw(uuid, date)', 'public.trainer_send_plan(uuid, jsonb)',
    'public.request_anamnese(uuid, text[])', 'public.answer_anamnese(uuid, jsonb)', 'public.send_receipt(uuid, text)',
    'public.challenge_ranking(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
