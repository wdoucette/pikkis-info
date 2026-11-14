-- Pikki's Info: user-defined category groups (named sets of wardrobe categories). Owner-only.
create table public.category_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  cats text[] not null check (cardinality(cats) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index category_groups_user_name_idx on public.category_groups (user_id, lower(btrim(name)));
alter table public.category_groups enable row level security;

create policy "category_groups: read own" on public.category_groups
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "category_groups: insert own" on public.category_groups
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "category_groups: update own" on public.category_groups
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "category_groups: delete own" on public.category_groups
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.category_groups from anon, authenticated;
grant select, insert, delete on public.category_groups to authenticated;
grant update (name, cats) on public.category_groups to authenticated;

create trigger category_groups_touch before update on public.category_groups
  for each row execute function private.touch_updated_at();

create or replace function private.limit_category_groups()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.category_groups where user_id = new.user_id) >= 50 then
    raise exception 'You can keep up to 50 groups. Delete one first.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function private.limit_category_groups() from public, anon, authenticated;
create trigger category_groups_limit before insert on public.category_groups
  for each row execute function private.limit_category_groups();
