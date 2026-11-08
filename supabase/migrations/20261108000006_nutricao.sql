-- Nutrição: refeições, água, metas e controle de uso da análise por IA

alter table public.profiles
  add column kcal_target smallint check (kcal_target between 800 and 6000),
  add column protein_target smallint check (protein_target between 0 and 500),
  add column carbs_target smallint check (carbs_target between 0 and 1000),
  add column fat_target smallint check (fat_target between 0 and 400),
  add column water_target_ml smallint check (water_target_ml between 500 and 8000);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  eaten_on date not null default current_date,
  meal text not null check (meal in ('cafe', 'almoco', 'lanche', 'jantar')),
  name text not null check (char_length(name) between 1 and 120),
  portion text check (char_length(portion) <= 80),
  kcal numeric(7,1) not null default 0 check (kcal >= 0 and kcal <= 10000),
  protein numeric(6,1) not null default 0 check (protein >= 0 and protein <= 1000),
  carbs numeric(6,1) not null default 0 check (carbs >= 0 and carbs <= 1000),
  fat numeric(6,1) not null default 0 check (fat >= 0 and fat <= 1000),
  source text not null default 'manual' check (source in ('manual', 'foto', 'texto', 'chat', 'recente')),
  created_at timestamptz not null default now()
);
create index meals_user_day on public.meals (user_id, eaten_on);

create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  logged_on date not null default current_date,
  ml smallint not null check (ml > 0 and ml <= 3000),
  created_at timestamptz not null default now()
);
create index water_logs_user_day on public.water_logs (user_id, logged_on);

create table public.nutrition_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('foto', 'texto')),
  created_at timestamptz not null default now()
);
create index nutrition_scans_user_time on public.nutrition_scans (user_id, created_at);

alter table public.meals enable row level security;
alter table public.water_logs enable row level security;
alter table public.nutrition_scans enable row level security;

create policy "refeicoes proprias" on public.meals for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "agua propria" on public.water_logs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- o uso da análise só pode ser lido e registrado, nunca apagado (senão zeraria o limite diário)
create policy "ver analises proprias" on public.nutrition_scans for select to authenticated
  using (user_id = (select auth.uid()));
create policy "registrar analise propria" on public.nutrition_scans for insert to authenticated
  with check (user_id = (select auth.uid()));
