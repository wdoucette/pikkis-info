-- Contact form inbox. Anyone may INSERT; nobody can read via the Data API (read in the dashboard / SQL).
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  topic text not null default 'other' check (topic in ('bug', 'data', 'suggestion', 'other')),
  name text check (name is null or char_length(name) <= 80),
  reply_email text check (reply_email is null or (char_length(reply_email) <= 254 and reply_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  message text not null check (char_length(btrim(message)) between 1 and 4000),
  page_url text check (page_url is null or char_length(page_url) <= 500),
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  ip_hash text,
  user_agent text
);
create index contact_messages_created_at_idx on public.contact_messages (created_at desc);
create index contact_messages_ip_hash_idx on public.contact_messages (ip_hash, created_at desc);
create index contact_messages_user_id_idx on public.contact_messages (user_id);
alter table public.contact_messages enable row level security;

create policy "contact: anyone may submit" on public.contact_messages
  for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));

revoke all on public.contact_messages from anon, authenticated;
grant insert (topic, name, reply_email, message, page_url) on public.contact_messages to anon, authenticated;

-- Per-project random salt for hashing IPs (kept out of the repo and the Data API).
create table private.app_secrets (key text primary key, value text not null);
revoke all on private.app_secrets from public, anon, authenticated;
insert into private.app_secrets (key, value) values ('ip_salt', encode(extensions.gen_random_bytes(32), 'hex'));

-- Fill server-side fields and rate-limit: max 5 per hour per hashed IP, max 30 per minute overall.
create or replace function private.contact_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  hdrs json := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  ip text := btrim(split_part(coalesce(hdrs ->> 'x-forwarded-for', hdrs ->> 'x-real-ip', 'unknown'), ',', 1));
  salt text := (select value from private.app_secrets where key = 'ip_salt');
begin
  new.id := gen_random_uuid();
  new.created_at := now();
  new.user_id := auth.uid();
  new.ip_hash := encode(extensions.digest(ip || coalesce(salt, ''), 'sha256'), 'hex');
  new.user_agent := left(hdrs ->> 'user-agent', 300);
  new.name := nullif(btrim(new.name), '');
  new.reply_email := nullif(btrim(new.reply_email), '');
  if (select count(*) from public.contact_messages
      where ip_hash = new.ip_hash and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many messages, please try again later' using errcode = 'P0429';
  end if;
  if (select count(*) from public.contact_messages where created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Too many messages, please try again later' using errcode = 'P0429';
  end if;
  return new;
end $$;
revoke all on function private.contact_before_insert() from public, anon, authenticated;

create trigger contact_before_insert before insert on public.contact_messages
  for each row execute function private.contact_before_insert();
