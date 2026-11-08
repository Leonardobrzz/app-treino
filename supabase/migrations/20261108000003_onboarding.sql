alter table public.profiles
  add column sex text check (sex in ('masculino','feminino','outro')),
  add column body_type smallint,
  add column birth_date date,
  add column height_cm smallint check (height_cm between 100 and 250),
  add column target_weight numeric(5,1),
  add column pace text check (pace in ('lento','moderado','rapido')),
  add column level text check (level in ('iniciante','intermediario','avancado')),
  add column priority_muscles text[] not null default '{}',
  add column training_days smallint[] not null default '{}',
  add column location text check (location in ('academia','casa','corpo')),
  add column session_minutes smallint,
  add column onboarded_at timestamptz;
