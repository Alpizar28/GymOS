-- Enable RLS and create owner policies safely.
-- This script is idempotent and skips missing tables.

alter table if exists workouts enable row level security;
alter table if exists plans enable row level security;
alter table if exists settings enable row level security;
alter table if exists athlete_state enable row level security;
alter table if exists routines enable row level security;
alter table if exists routine_folders enable row level security;
alter table if exists anchor_targets enable row level security;

do $$
begin
  if to_regclass('public.workouts') is not null then
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'workouts' and policyname = 'workouts_owner_select') then
      create policy workouts_owner_select on workouts for select using (auth.uid()::text = user_id);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'workouts' and policyname = 'workouts_owner_write') then
      create policy workouts_owner_write on workouts for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
    end if;
  end if;

  if to_regclass('public.plans') is not null then
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'plans' and policyname = 'plans_owner_select') then
      create policy plans_owner_select on plans for select using (auth.uid()::text = user_id);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'plans' and policyname = 'plans_owner_write') then
      create policy plans_owner_write on plans for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
    end if;
  end if;

  if to_regclass('public.settings') is not null then
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'settings' and policyname = 'settings_owner_select') then
      create policy settings_owner_select on settings for select using (auth.uid()::text = user_id);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'settings' and policyname = 'settings_owner_write') then
      create policy settings_owner_write on settings for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
    end if;
  end if;

  if to_regclass('public.athlete_state') is not null then
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'athlete_state' and policyname = 'athlete_state_owner_select') then
      create policy athlete_state_owner_select on athlete_state for select using (auth.uid()::text = user_id);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'athlete_state' and policyname = 'athlete_state_owner_write') then
      create policy athlete_state_owner_write on athlete_state for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
    end if;
  end if;

  if to_regclass('public.routines') is not null then
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'routines' and policyname = 'routines_owner_select') then
      create policy routines_owner_select on routines for select using (auth.uid()::text = user_id);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'routines' and policyname = 'routines_owner_write') then
      create policy routines_owner_write on routines for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
    end if;
  end if;

  if to_regclass('public.routine_folders') is not null then
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'routine_folders' and policyname = 'routine_folders_owner_select') then
      create policy routine_folders_owner_select on routine_folders for select using (auth.uid()::text = user_id);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'routine_folders' and policyname = 'routine_folders_owner_write') then
      create policy routine_folders_owner_write on routine_folders for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
    end if;
  end if;

  if to_regclass('public.anchor_targets') is not null then
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'anchor_targets' and policyname = 'anchor_targets_owner_select') then
      create policy anchor_targets_owner_select on anchor_targets for select using (auth.uid()::text = user_id);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'anchor_targets' and policyname = 'anchor_targets_owner_write') then
      create policy anchor_targets_owner_write on anchor_targets for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
    end if;
  end if;
end
$$;
