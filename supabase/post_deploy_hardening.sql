-- GymOS post-deploy hardening
-- Run in Supabase SQL Editor

-- 1) UNIQUE indexes per user
create unique index if not exists uq_settings_user_key
  on public.settings(user_id, key);

create unique index if not exists uq_athlete_state_user
  on public.athlete_state(user_id);

create unique index if not exists uq_anchor_targets_user_exercise
  on public.anchor_targets(user_id, exercise_id);

create unique index if not exists uq_routine_folders_user_name
  on public.routine_folders(user_id, name);

-- 2) Performance indexes for multi-user queries
create index if not exists idx_workouts_user_date
  on public.workouts(user_id, date);

create index if not exists idx_plans_user_date
  on public.plans(user_id, start_date);

create index if not exists idx_routines_user_folder
  on public.routines(user_id, folder_id);

create index if not exists idx_routine_folders_user_sort
  on public.routine_folders(user_id, sort_order);

create index if not exists idx_anchor_targets_user_exercise
  on public.anchor_targets(user_id, exercise_id);

create index if not exists idx_workouts_training_type
  on public.workouts(training_type);

create index if not exists idx_routines_training_type
  on public.routines(training_type);

-- 3) Enable RLS on ownership tables
alter table if exists public.workouts enable row level security;
alter table if exists public.plans enable row level security;
alter table if exists public.settings enable row level security;
alter table if exists public.athlete_state enable row level security;
alter table if exists public.routines enable row level security;
alter table if exists public.routine_folders enable row level security;
alter table if exists public.anchor_targets enable row level security;

-- 4) Create policies if missing
do $$
begin
  if to_regclass('public.workouts') is not null then
    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='workouts' and policyname='workouts_owner_select'
    ) then
      create policy workouts_owner_select
        on public.workouts for select
        using (auth.uid()::text = user_id);
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='workouts' and policyname='workouts_owner_write'
    ) then
      create policy workouts_owner_write
        on public.workouts for all
        using (auth.uid()::text = user_id)
        with check (auth.uid()::text = user_id);
    end if;
  end if;

  if to_regclass('public.plans') is not null then
    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='plans' and policyname='plans_owner_select'
    ) then
      create policy plans_owner_select
        on public.plans for select
        using (auth.uid()::text = user_id);
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='plans' and policyname='plans_owner_write'
    ) then
      create policy plans_owner_write
        on public.plans for all
        using (auth.uid()::text = user_id)
        with check (auth.uid()::text = user_id);
    end if;
  end if;

  if to_regclass('public.settings') is not null then
    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='settings' and policyname='settings_owner_select'
    ) then
      create policy settings_owner_select
        on public.settings for select
        using (auth.uid()::text = user_id);
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='settings' and policyname='settings_owner_write'
    ) then
      create policy settings_owner_write
        on public.settings for all
        using (auth.uid()::text = user_id)
        with check (auth.uid()::text = user_id);
    end if;
  end if;

  if to_regclass('public.athlete_state') is not null then
    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='athlete_state' and policyname='athlete_state_owner_select'
    ) then
      create policy athlete_state_owner_select
        on public.athlete_state for select
        using (auth.uid()::text = user_id);
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='athlete_state' and policyname='athlete_state_owner_write'
    ) then
      create policy athlete_state_owner_write
        on public.athlete_state for all
        using (auth.uid()::text = user_id)
        with check (auth.uid()::text = user_id);
    end if;
  end if;

  if to_regclass('public.routines') is not null then
    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='routines' and policyname='routines_owner_select'
    ) then
      create policy routines_owner_select
        on public.routines for select
        using (auth.uid()::text = user_id);
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='routines' and policyname='routines_owner_write'
    ) then
      create policy routines_owner_write
        on public.routines for all
        using (auth.uid()::text = user_id)
        with check (auth.uid()::text = user_id);
    end if;
  end if;

  if to_regclass('public.routine_folders') is not null then
    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='routine_folders' and policyname='routine_folders_owner_select'
    ) then
      create policy routine_folders_owner_select
        on public.routine_folders for select
        using (auth.uid()::text = user_id);
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='routine_folders' and policyname='routine_folders_owner_write'
    ) then
      create policy routine_folders_owner_write
        on public.routine_folders for all
        using (auth.uid()::text = user_id)
        with check (auth.uid()::text = user_id);
    end if;
  end if;

  if to_regclass('public.anchor_targets') is not null then
    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='anchor_targets' and policyname='anchor_targets_owner_select'
    ) then
      create policy anchor_targets_owner_select
        on public.anchor_targets for select
        using (auth.uid()::text = user_id);
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='anchor_targets' and policyname='anchor_targets_owner_write'
    ) then
      create policy anchor_targets_owner_write
        on public.anchor_targets for all
        using (auth.uid()::text = user_id)
        with check (auth.uid()::text = user_id);
    end if;
  end if;
end
$$;

-- 5) Quick verification queries
select tablename, rowsecurity
from pg_tables
where schemaname='public'
  and tablename in ('workouts','plans','settings','athlete_state','routines','routine_folders','anchor_targets')
order by tablename;

select tablename, policyname
from pg_policies
where schemaname='public'
order by tablename, policyname;
