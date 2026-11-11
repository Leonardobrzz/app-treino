-- Aluno sem app: o personal cadastra o aluno só com o nome e já usa avaliação, fotos, treino e cobrança.
-- Por baixo é uma conta "fantasma" (sem senha, não dá pra entrar). Quando o aluno cria a conta dele
-- e abre o link de vínculo, tudo é transferido pra conta dele e a fantasma é apagada.

create table public.guest_students (
  id uuid primary key,
  trainer_id uuid not null references auth.users(id) on delete cascade,
  claim_code text not null unique,
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);
create index guest_students_trainer on public.guest_students (trainer_id);
create index guest_students_claimed on public.guest_students (claimed_by);
alter table public.guest_students enable row level security;
create policy "personal ve alunos sem app" on public.guest_students for select to authenticated using (trainer_id = (select auth.uid()));

-- contas fantasma não entram nas contas de teste nem nos números do painel do dono por padrão
create or replace function private.is_test(email text)
returns boolean
language sql
immutable
set search_path = ''
as $$ select coalesce(email, '') like '%@carga.app' or coalesce(email, '') like '%@sem-app.carga.app.br' $$;

create function public.trainer_add_guest(p_name text, p_phone text, p_sex text, p_birth date, p_height int)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare me uuid := auth.uid(); gid uuid := gen_random_uuid(); code text;
begin
  if me is null or not coalesce((select is_trainer from public.profiles where id = me), false) then raise exception 'só personal'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'nome obrigatório'; end if;
  if (select count(*) from public.guest_students where trainer_id = me and claimed_by is null) >= 200 then raise exception 'limite de alunos sem app'; end if;
  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', gid, 'authenticated', 'authenticated', 'aluno-' || gid || '@sem-app.carga.app.br',
          '{"provider":"guest","providers":[]}'::jsonb, jsonb_build_object('name', left(trim(p_name), 60)), now(), now());
  update public.profiles set
    sex = case when p_sex in ('masculino', 'feminino') then p_sex else sex end,
    birth_date = p_birth,
    height_cm = case when p_height between 80 and 250 then p_height else null end
  where id = gid;
  loop
    code := upper(substr(md5(gen_random_uuid()::text), 1, 8));
    exit when not exists (select 1 from public.guest_students where claim_code = code);
  end loop;
  insert into public.guest_students (id, trainer_id, claim_code) values (gid, me, code);
  insert into public.trainer_students (trainer_id, student_id, phone) values (me, gid, nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''));
  return gid;
end;
$$;

-- o personal edita os dados básicos do aluno sem app
create function public.trainer_update_guest(p_student uuid, p_name text, p_sex text, p_birth date, p_height int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.guest_students g where g.id = p_student and g.trainer_id = auth.uid() and g.claimed_by is null) then raise exception 'aluno não encontrado'; end if;
  update public.profiles set
    name = coalesce(nullif(left(trim(p_name), 60), ''), name),
    sex = case when p_sex in ('masculino', 'feminino') then p_sex else sex end,
    birth_date = p_birth,
    height_cm = case when p_height between 80 and 250 then p_height else null end
  where id = p_student;
end;
$$;

-- o personal responde a anamnese junto com o aluno sem app
create function public.trainer_answer_anamnese(p_id uuid, p_answers jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if length(p_answers::text) > 20000 then raise exception 'respostas grandes demais'; end if;
  update public.anamneses a set answers = p_answers, answered_at = now()
  where a.id = p_id and a.trainer_id = auth.uid()
    and exists (select 1 from public.guest_students g where g.id = a.student_id and g.trainer_id = auth.uid() and g.claimed_by is null);
  if not found then raise exception 'anamnese não encontrada'; end if;
end;
$$;

-- dados do convite de vínculo (pra mostrar antes de aceitar)
create function public.guest_by_code(p_claim text)
returns table (trainer_code text, trainer_name text, student_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.trainer_code, coalesce(t.name, 'Personal'), coalesce(s.name, 'Aluno')
  from public.guest_students g
  join public.profiles t on t.id = g.trainer_id
  join public.profiles s on s.id = g.id
  where g.claim_code = upper(trim(p_claim)) and g.claimed_by is null;
$$;

-- o aluno assume o cadastro feito pelo personal: tudo vai pra conta dele
create function public.claim_guest(p_claim text, p_ranking boolean default true)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare me uuid := auth.uid(); g record; t_name text; s_name text; has_plan boolean;
begin
  if me is null then raise exception 'não autenticado'; end if;
  select * into g from public.guest_students where claim_code = upper(trim(p_claim)) and claimed_by is null for update;
  if g.id is null then raise exception 'convite inválido'; end if;
  if g.trainer_id = me then raise exception 'esse é o seu próprio convite'; end if;

  -- vínculo
  if exists (select 1 from public.trainer_students where trainer_id = g.trainer_id and student_id = me and status = 'ativo') then
    delete from public.trainer_students where student_id = g.id;
  else
    update public.trainer_students set student_id = me, ranking_opt_in = coalesce(p_ranking, true) where student_id = g.id;
  end if;

  -- o que o personal já cadastrou
  update public.assessments set student_id = me where student_id = g.id;
  update public.anamneses set student_id = me where student_id = g.id;
  update public.charges set student_id = me where student_id = g.id;
  update public.appointments set student_id = me where student_id = g.id;
  update public.diet_plans set student_id = me where student_id = g.id;
  update public.progress_photos set user_id = me where user_id = g.id;
  update public.body_weights set user_id = me where user_id = g.id;
  update public.body_measurements set user_id = me where user_id = g.id;

  -- treino do personal vira o treino ativo
  has_plan := exists (select 1 from public.plans where user_id = g.id and active);
  if has_plan then update public.plans set active = false where user_id = me and active; end if;
  update public.plans set user_id = me where user_id = g.id;
  update public.plan_days set user_id = me where user_id = g.id;
  update public.plan_exercises set user_id = me where user_id = g.id;

  -- completa o perfil com o que o personal anotou
  update public.profiles p set
    sex = coalesce(p.sex, gp.sex), birth_date = coalesce(p.birth_date, gp.birth_date), height_cm = coalesce(p.height_cm, gp.height_cm)
  from public.profiles gp where p.id = me and gp.id = g.id;

  update public.guest_students set claimed_by = me, claimed_at = now() where id = g.id;
  delete from auth.users where id = g.id;

  select coalesce(name, 'Seu personal') into t_name from public.profiles where id = g.trainer_id;
  select coalesce(name, 'Seu aluno') into s_name from public.profiles where id = me;
  perform private.notify(g.trainer_id, 'novo_aluno', s_name || ' entrou no app', 'O cadastro que você fez agora está na conta dele.', '/personal/aluno/' || me);
  return t_name;
end;
$$;

-- arquivos guardados na pasta do aluno sem app continuam visíveis depois do vínculo
create function private.guest_folder_ok(folder text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.guest_students g where g.id::text = folder and (g.claimed_by = auth.uid() or g.trainer_id = auth.uid()));
$$;
revoke execute on function private.guest_folder_ok(text) from public, anon;
grant execute on function private.guest_folder_ok(text) to authenticated;

create policy "avaliacoes ver (aluno sem app)" on storage.objects for select to authenticated
  using (bucket_id = 'avaliacoes' and (select private.guest_folder_ok((storage.foldername(name))[1])));
create policy "progresso ver (aluno sem app)" on storage.objects for select to authenticated
  using (bucket_id = 'progresso' and (select private.guest_folder_ok((storage.foldername(name))[1])));

-- o personal também pode tirar fotos de progresso dos alunos
create policy "personal envia fotos de progresso" on storage.objects for insert to authenticated
  with check (bucket_id = 'progresso' and (select private.is_trainer_of(((storage.foldername(name))[1])::uuid)));
create policy "personal registra foto de progresso" on public.progress_photos for insert to authenticated
  with check ((select private.is_trainer_of(user_id)) and split_part(path, '/', 1) = user_id::text);

do $$
declare f text;
begin
  foreach f in array array[
    'public.trainer_add_guest(text, text, text, date, int)', 'public.trainer_update_guest(uuid, text, text, date, int)',
    'public.trainer_answer_anamnese(uuid, jsonb)', 'public.guest_by_code(text)', 'public.claim_guest(text, boolean)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
