-- Pikki's Info: wardrobe archives (owner-only snapshots) + username login lookup.

-- ---------- wardrobe archives ----------
create table public.wardrobe_archives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  item_count integer not null default 0 check (item_count between 0 and 100000),
  -- { "<item id>": { "owned": n, "done": bool, "wanted"?: bool }, ... }
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 2000000),
  created_at timestamptz not null default now()
);
create index wardrobe_archives_user_idx on public.wardrobe_archives (user_id, created_at desc);
alter table public.wardrobe_archives enable row level security;

create policy "archives: read own" on public.wardrobe_archives
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "archives: insert own" on public.wardrobe_archives
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "archives: update own" on public.wardrobe_archives
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "archives: delete own" on public.wardrobe_archives
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.wardrobe_archives from anon, authenticated;
grant select, insert, delete on public.wardrobe_archives to authenticated;
grant update (name) on public.wardrobe_archives to authenticated;

-- Keep storage bounded: at most 30 archives per account.
create or replace function private.limit_archives()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.wardrobe_archives where user_id = new.user_id) >= 30 then
    raise exception 'You can keep up to 30 archives. Delete an old one first.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function private.limit_archives() from public, anon, authenticated;
create trigger wardrobe_archives_limit before insert on public.wardrobe_archives
  for each row execute function private.limit_archives();

-- ---------- username login ----------
-- Only the "login" Edge Function (service_role) may call this, so emails are never
-- exposed to browsers; the function signs the user in server-side.
create or replace function public.login_email_for_username(p_username text)
returns text language sql stable security definer set search_path = '' as $$
  select u.email::text
  from public.profiles p join auth.users u on u.id = p.id
  where p.username = lower(trim(p_username))::extensions.citext
    and u.email is not null and not coalesce(u.is_anonymous, false)
  limit 1
$$;
revoke all on function public.login_email_for_username(text) from public, anon, authenticated;
grant execute on function public.login_email_for_username(text) to service_role;
