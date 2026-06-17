-- ============================================================
-- CleanPro — Supabase schema
-- Run this in the Supabase SQL editor (or via migration).
-- ============================================================

-- ---------- LEADS ----------
create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  phone         text not null,
  address       text not null,
  note          text,
  photo_path    text,                       -- path inside the 'sofa-photos' storage bucket
  ai_analysis   jsonb,                       -- {material, seats, stain_level, confidence, ...}
  quote_mode    text,                        -- 'instant' | 'manual'
  estimate_min  int,
  estimate_max  int,
  status        text not null default 'new', -- new | quoted | needs_review | confirmed | done | cancelled
  reviewed_by_admin boolean not null default false,
  confirmed_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists leads_status_idx     on public.leads (status);
create index if not exists leads_created_at_idx  on public.leads (created_at desc);

-- ---------- RLS ----------
-- Lock the table down. All writes/reads go through API routes using the
-- SERVICE ROLE key (which bypasses RLS). The anon/public client gets nothing.
alter table public.leads enable row level security;

-- No policies for anon = anon cannot select/insert/update/delete. Good.
-- (Service role bypasses RLS, so your server routes still work.)

-- If you later add Supabase Auth for an admin dashboard, add a policy like:
-- create policy "admins read leads" on public.leads
--   for select using ( auth.jwt() ->> 'role' = 'admin' );

-- ---------- STORAGE ----------
-- Create a PRIVATE bucket for photos. Run once.
insert into storage.buckets (id, name, public)
values ('sofa-photos', 'sofa-photos', false)
on conflict (id) do nothing;

-- No storage policies for anon = uploads/reads must go through the service role
-- (server-side) or via short-lived signed URLs you generate server-side.
