-- 03-realtime-webhooks.sql — run THIRD in Supabase SQL editor.
-- Server-side listener: DB changes POST to /api/realtime/webhook, which
-- revalidates the affected Next.js routes. Uses pg_net (net.http_post),
-- the wrapper present in current Supabase projects.
-- Replace <APP_URL> (https, publicly reachable) and <SECRET> (must equal
-- SUPABASE_WEBHOOK_SECRET). Re-run only the function block to rotate.

create extension if not exists pg_net;
create schema if not exists private;

create or replace function private.notify_festacol_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
declare
  payload jsonb;
begin
  payload := jsonb_build_object(
    'table', TG_TABLE_NAME,
    'type', TG_OP,
    'record', to_jsonb(case when TG_OP = 'DELETE' then OLD else NEW end)
  );
   perform supabase_functions.http_request(
    'https://dev.blueeagle.ltd/api/realtime/webhook',
    'POST',
    jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', '7a0411cfc1fada9ae553ea01e99563f0ee7c06530feeb84f6b88208d6ab1f616'
    ),
    payload,
    1000
  );
  if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
end;
$$;

drop trigger if exists festacol_webhook_exam_sessions on public.exam_sessions;
create trigger festacol_webhook_exam_sessions
  after insert or update or delete on public.exam_sessions
  for each row execute function private.notify_festacol_webhook();

drop trigger if exists festacol_webhook_exam_attempts on public.exam_attempts;
create trigger festacol_webhook_exam_attempts
  after insert or update or delete on public.exam_attempts
  for each row execute function private.notify_festacol_webhook();

drop trigger if exists festacol_webhook_users on public.users;
create trigger festacol_webhook_users
  after insert or update or delete on public.users
  for each row execute function private.notify_festacol_webhook();

drop trigger if exists festacol_webhook_classes on public.classes;
create trigger festacol_webhook_classes
  after insert or update or delete on public.classes
  for each row execute function private.notify_festacol_webhook();

drop trigger if exists festacol_webhook_questions on public.questions;
create trigger festacol_webhook_questions
  after insert or update or delete on public.questions
  for each row execute function private.notify_festacol_webhook();

drop trigger if exists festacol_webhook_question_overrides on public.question_overrides;
create trigger festacol_webhook_question_overrides
  after insert or update or delete on public.question_overrides
  for each row execute function private.notify_festacol_webhook();

drop trigger if exists festacol_webhook_question_bank on public.question_bank;
create trigger festacol_webhook_question_bank
  after insert or update or delete on public.question_bank
  for each row execute function private.notify_festacol_webhook();

drop trigger if exists festacol_webhook_whatsapp_groups on public.whatsapp_groups;
create trigger festacol_webhook_whatsapp_groups
  after insert or update or delete on public.whatsapp_groups
  for each row execute function private.notify_festacol_webhook();

drop trigger if exists festacol_webhook_student_profiles on public.student_profiles;
create trigger festacol_webhook_student_profiles
  after insert or update or delete on public.student_profiles
  for each row execute function private.notify_festacol_webhook();

drop trigger if exists festacol_webhook_exam_states on public.exam_states;
create trigger festacol_webhook_exam_states
  after insert or update or delete on public.exam_states
  for each row execute function private.notify_festacol_webhook();

drop trigger if exists festacol_webhook_subjects on public.subjects;
create trigger festacol_webhook_subjects
  after insert or update or delete on public.subjects
  for each row execute function private.notify_festacol_webhook();
