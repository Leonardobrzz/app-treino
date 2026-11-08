create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  goal text,
  weekly_goal smallint not null default 4,
  created_at timestamptz not null default now()
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  muscle_group text not null,
  secondary text[] not null default '{}',
  equipment text not null,
  created_by uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index exercises_global_name on public.exercises (lower(name)) where created_by is null;
create index exercises_created_by on public.exercises (created_by);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index plans_user on public.plans (user_id);

create table public.plan_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  title text not null,
  created_at timestamptz not null default now()
);
create index plan_days_plan on public.plan_days (plan_id);
create index plan_days_user on public.plan_days (user_id);

create table public.plan_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  plan_day_id uuid not null references public.plan_days(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  position smallint not null default 0,
  sets smallint not null default 3,
  reps text not null default '10',
  target_weight numeric(6,2),
  rest_seconds smallint not null default 90,
  notes text
);
create index plan_exercises_day on public.plan_exercises (plan_day_id);
create index plan_exercises_user on public.plan_exercises (user_id);
create index plan_exercises_exercise on public.plan_exercises (exercise_id);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  plan_day_id uuid references public.plan_days(id) on delete set null,
  title text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index sessions_user on public.sessions (user_id, started_at desc);
create index sessions_plan_day on public.sessions (plan_day_id);

create table public.session_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  set_number smallint not null,
  weight numeric(6,2) not null default 0,
  reps smallint not null default 0,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index session_sets_session on public.session_sets (session_id);
create index session_sets_user_ex on public.session_sets (user_id, exercise_id, created_at desc);
create index session_sets_exercise on public.session_sets (exercise_id);

create table public.body_weights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  measured_on date not null default current_date,
  weight numeric(5,2) not null,
  body_fat numeric(4,1),
  unique (user_id, measured_on)
);

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  measured_on date not null default current_date,
  pescoco numeric(5,1), peito numeric(5,1), cintura numeric(5,1), quadril numeric(5,1),
  braco numeric(5,1), antebraco numeric(5,1), coxa numeric(5,1), panturrilha numeric(5,1),
  unique (user_id, measured_on)
);

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  checked_on date not null default current_date,
  unique (user_id, checked_on)
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index ai_messages_user on public.ai_messages (user_id, created_at);

-- RLS: cada usuário só enxerga os próprios dados
alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.plans enable row level security;
alter table public.plan_days enable row level security;
alter table public.plan_exercises enable row level security;
alter table public.sessions enable row level security;
alter table public.session_sets enable row level security;
alter table public.body_weights enable row level security;
alter table public.body_measurements enable row level security;
alter table public.checkins enable row level security;
alter table public.ai_messages enable row level security;

create policy "perfil proprio" on public.profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "ver exercicios" on public.exercises for select to authenticated
  using (created_by is null or created_by = (select auth.uid()));
create policy "criar exercicio proprio" on public.exercises for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "editar exercicio proprio" on public.exercises for update to authenticated
  using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy "apagar exercicio proprio" on public.exercises for delete to authenticated
  using (created_by = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['plans','plan_days','plan_exercises','sessions','session_sets','body_weights','body_measurements','checkins','ai_messages']
  loop
    execute format('create policy "dono" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- perfil criado automaticamente junto com a conta
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name) values (new.id, new.raw_user_meta_data->>'name');
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
