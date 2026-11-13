-- Pikki's Info: accounts, cloud wardrobes, collections. RLS on every table.
create extension if not exists citext with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username extensions.citext unique
    check (username is null or username::text ~ '^[a-z0-9_]{3,24}$'),
  display_name text check (display_name is null or char_length(display_name) <= 40),
  avatar_url text check (avatar_url is null or avatar_url ~ '^https://'),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profiles: read own or public" on public.profiles
  for select to anon, authenticated
  using (is_public or (select auth.uid()) = id);
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
-- Rows are created by the signup trigger; deleted by cascade from auth.users.

-- ---------- wardrobe ----------
create table public.wardrobe_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id text not null check (char_length(item_id) between 1 and 32),
  status text not null default 'owned' check (status in ('owned', 'wanted', 'none')),
  count integer not null default 1 check (count between 0 and 9999),
  done boolean not null default false,
  note text check (note is null or char_length(note) <= 500),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
alter table public.wardrobe_items enable row level security;

create policy "wardrobe: read own or public profile" on public.wardrobe_items
  for select to anon, authenticated
  using (
    (select auth.uid()) = user_id
    or exists (select 1 from public.profiles p where p.id = user_id and p.is_public)
  );
create policy "wardrobe: insert own" on public.wardrobe_items
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "wardrobe: update own" on public.wardrobe_items
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "wardrobe: delete own" on public.wardrobe_items
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- collections ----------
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  filter_state jsonb not null default '{}'::jsonb check (jsonb_typeof(filter_state) = 'object'),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index collections_user_id_idx on public.collections (user_id);
alter table public.collections enable row level security;

create policy "collections: read own or public" on public.collections
  for select to anon, authenticated
  using (
    (select auth.uid()) = user_id
    or (is_public and exists (select 1 from public.profiles p where p.id = user_id and p.is_public))
  );
create policy "collections: insert own" on public.collections
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "collections: update own" on public.collections
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "collections: delete own" on public.collections
  for delete to authenticated using ((select auth.uid()) = user_id);

create table public.collection_items (
  collection_id uuid not null references public.collections (id) on delete cascade,
  item_id text not null check (char_length(item_id) between 1 and 32),
  added_at timestamptz not null default now(),
  primary key (collection_id, item_id)
);
alter table public.collection_items enable row level security;

create policy "collection_items: read via collection" on public.collection_items
  for select to anon, authenticated
  using (exists (select 1 from public.collections c where c.id = collection_id));
create policy "collection_items: insert own" on public.collection_items
  for insert to authenticated
  with check (exists (select 1 from public.collections c where c.id = collection_id and c.user_id = (select auth.uid())));
create policy "collection_items: delete own" on public.collection_items
  for delete to authenticated
  using (exists (select 1 from public.collections c where c.id = collection_id and c.user_id = (select auth.uid())));

-- ---------- grants (Data API) ----------
revoke all on public.profiles, public.wardrobe_items, public.collections, public.collection_items from anon, authenticated;
grant select on public.profiles, public.wardrobe_items, public.collections, public.collection_items to anon, authenticated;
grant update (username, display_name, avatar_url, settings, is_public) on public.profiles to authenticated;
grant insert, update, delete on public.wardrobe_items, public.collections to authenticated;
grant insert, delete on public.collection_items to authenticated;

-- ---------- triggers ----------
create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();
create trigger wardrobe_touch before update on public.wardrobe_items
  for each row execute function private.touch_updated_at();
create trigger collections_touch before update on public.collections
  for each row execute function private.touch_updated_at();

-- Create a profile row for every new auth user. Username comes from signup metadata
-- when valid and free; otherwise null (user picks one on the account page).
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  wanted text := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
begin
  if wanted !~ '^[a-z0-9_]{3,24}$'
     or exists (select 1 from public.profiles where username = wanted::extensions.citext) then
    wanted := null;
  end if;
  insert into public.profiles (id, username, display_name)
  values (new.id, wanted, left(nullif(new.raw_user_meta_data ->> 'display_name', ''), 40));
  return new;
end $$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();
