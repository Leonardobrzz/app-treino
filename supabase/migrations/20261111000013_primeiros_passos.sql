-- Primeiros passos do personal: o que ele já fez no app
create or replace function public.trainer_onboarding()
returns table (sent_plan boolean, assessed boolean, charged boolean, anamnese boolean)
language sql stable security definer set search_path = '' as $$
  select
    exists (select 1 from public.plans where trainer_id = auth.uid()),
    exists (select 1 from public.assessments where trainer_id = auth.uid()),
    exists (select 1 from public.charges where trainer_id = auth.uid()),
    exists (select 1 from public.anamneses where trainer_id = auth.uid());
$$;
revoke all on function public.trainer_onboarding() from public, anon;
grant execute on function public.trainer_onboarding() to authenticated;
