-- Shifokor top: patient ratings and reviews on Supabase (PostgreSQL).
-- Run once in Supabase → SQL Editor. Safe to run again.
--
-- Anyone can read reviews and ratings. Writes go only through the functions below, which check
-- the input, refuse links, limit spam and allow one review per doctor per device.
-- The device sends a random token kept in its browser; only a one-way hash of it is stored.

create extension if not exists pgcrypto with schema extensions;

-- ---------- tables ----------
create table if not exists public.reviews (
  id          bigint generated always as identity primary key,
  doctor_id   text not null check (doctor_id ~ '^[A-Za-z0-9-]{1,100}$'),
  owner_hash  text not null,
  stars       smallint not null check (stars between 1 and 5),
  text        text not null default '' check (char_length(text) <= 800),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (doctor_id, owner_hash)
);
create index if not exists reviews_doctor_idx on public.reviews (doctor_id);
alter table public.reviews replica identity full;   -- live updates also carry doctor_id on delete

create table if not exists public.reports (
  id          bigint generated always as identity primary key,
  doctor_id   text not null,
  kind        text not null check (kind in ('fix', 'remove')),
  text        text not null default '' check (char_length(text) <= 600),
  created_at  timestamptz not null default now()
);

create table if not exists public.rate_hits (
  key text not null,
  at  timestamptz not null default now()
);
create index if not exists rate_hits_idx on public.rate_hits (key, at);

create table if not exists public.app_secret (v text not null);
insert into public.app_secret (v)
  select encode(extensions.gen_random_bytes(32), 'hex')
  where not exists (select 1 from public.app_secret);

-- ---------- access ----------
alter table public.reviews   enable row level security;
alter table public.reports   enable row level security;
alter table public.rate_hits enable row level security;
alter table public.app_secret enable row level security;

drop policy if exists "reviews are public" on public.reviews;
create policy "reviews are public" on public.reviews for select to anon, authenticated using (true);

revoke all on public.reviews, public.reports, public.rate_hits, public.app_secret from anon, authenticated;
grant select on public.reviews to anon, authenticated;

create or replace view public.ratings with (security_invoker = true) as
  select doctor_id, round(avg(stars)::numeric, 1)::float8 as avg, count(*)::int as n
  from public.reviews group by doctor_id;
grant select on public.ratings to anon, authenticated;

-- ---------- helpers (not callable from the site) ----------
create or replace function public._client_key() returns text
language plpgsql stable security definer set search_path = public, extensions as $$
declare h json; ip text;
begin
  begin h := nullif(current_setting('request.headers', true), '')::json; exception when others then h := null; end;
  ip := coalesce(h->>'cf-connecting-ip', h->>'x-real-ip', split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1), 'unknown');
  return 'ip:' || encode(digest((select v from app_secret limit 1) || ':' || btrim(ip), 'sha256'), 'hex');
end $$;

create or replace function public._allow(p_key text, p_limit int, p_window interval) returns boolean
language plpgsql security definer set search_path = public as $$
declare c int;
begin
  if random() < 0.02 then delete from rate_hits where at < now() - interval '2 days'; end if;
  select count(*) into c from rate_hits where key = p_key and at > now() - p_window;
  if c >= p_limit then return false; end if;
  insert into rate_hits (key) values (p_key);
  return true;
end $$;

revoke all on function public._client_key() from public, anon, authenticated;
revoke all on function public._allow(text, int, interval) from public, anon, authenticated;

-- ---------- what the site calls ----------
create or replace function public.submit_review(p_doctor text, p_stars int, p_text text, p_token text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_text text; v_owner text;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9-]{16,64}$' then raise exception 'device_required'; end if;
  if p_doctor is null or p_doctor !~ '^[A-Za-z0-9-]{1,100}$' then raise exception 'doctor_not_found'; end if;
  if p_stars is null or p_stars < 1 or p_stars > 5 then raise exception 'bad_stars'; end if;
  v_text := left(btrim(regexp_replace(coalesce(p_text, ''), '[[:cntrl:]]', ' ', 'g')), 800);
  if v_text ~* '(https?://|www\.|t\.me/|@[a-z0-9_]{5,}|\m[a-z0-9-]+\.(uz|ru|com|net|org|me|io)\M)' then
    raise exception 'links_not_allowed';
  end if;
  if not _allow('tok:' || encode(digest(p_token, 'sha256'), 'hex'), 30, interval '1 hour')
     or not _allow(_client_key(), 150, interval '1 day') then
    raise exception 'too_many';
  end if;
  v_owner := encode(digest(p_doctor || ':' || p_token, 'sha256'), 'hex');
  insert into reviews (doctor_id, owner_hash, stars, text) values (p_doctor, v_owner, p_stars, v_text)
  on conflict (doctor_id, owner_hash) do update
    set stars = excluded.stars, text = excluded.text, updated_at = now();
end $$;

create or replace function public.delete_my_review(p_doctor text, p_token text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9-]{16,64}$' then raise exception 'device_required'; end if;
  delete from reviews where doctor_id = p_doctor and owner_hash = encode(digest(p_doctor || ':' || p_token, 'sha256'), 'hex');
end $$;

create or replace function public.submit_report(p_doctor text, p_kind text, p_text text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_text text := left(btrim(coalesce(p_text, '')), 600);
begin
  if p_doctor is null or p_doctor !~ '^[A-Za-z0-9-]{1,100}$' then raise exception 'doctor_not_found'; end if;
  if p_kind not in ('fix', 'remove') then raise exception 'bad_kind'; end if;
  if p_kind = 'fix' and v_text = '' then raise exception 'text_required'; end if;
  if not _allow(_client_key() || ':rp', 10, interval '1 hour') then raise exception 'too_many'; end if;
  insert into reports (doctor_id, kind, text) values (p_doctor, p_kind, v_text);
end $$;

revoke all on function public.submit_review(text, int, text, text) from public;
revoke all on function public.delete_my_review(text, text) from public;
revoke all on function public.submit_report(text, text, text) from public;
grant execute on function public.submit_review(text, int, text, text) to anon, authenticated;
grant execute on function public.delete_my_review(text, text) to anon, authenticated;
grant execute on function public.submit_report(text, text, text) to anon, authenticated;

-- ---------- live updates ----------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reviews') then
    alter publication supabase_realtime add table public.reviews;
  end if;
end $$;
