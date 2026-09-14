-- Festacol prototype — migration: question bank tables
-- Run this in Supabase Dashboard → SQL Editor.
-- (The base schema in schema.sql already includes these tables for fresh installs.)

create table if not exists public.question_bank_meta (
  id integer primary key,
  question_set_id text not null,
  subject_catalog jsonb not null,
  assessment_alignment jsonb,
  question_count integer not null default 0,
  updated_at bigint not null
);
create table if not exists public.question_bank_items (
  id bigint primary key,
  data jsonb not null,
  subject_code text not null default '',
  updated_at bigint not null
);
create index if not exists question_bank_items_subject_idx on public.question_bank_items (subject_code);

alter table public.question_bank_meta enable row level security;
alter table public.question_bank_items enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'prototype anon all question_bank_meta') then
    create policy "prototype anon all question_bank_meta" on public.question_bank_meta for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'prototype anon all question_bank_items') then
    create policy "prototype anon all question_bank_items" on public.question_bank_items for all to anon using (true) with check (true);
  end if;
end $$;
