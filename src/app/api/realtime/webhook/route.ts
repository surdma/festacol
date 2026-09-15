import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

// Server-side listener for Supabase changes. Supabase Realtime sockets are
// for browsers; the server learns about DB changes via Database Webhooks,
// then invalidates the affected Next.js routes so fresh data is served.
//
// One-time Supabase setup (SQL editor, run once):
//   create extension if not exists pg_net;
//   -- repeat per table, pointing at this route:
//   create trigger festacol_webhook_exam_sessions
//     after insert or update or delete on public.exam_sessions
//     for each row execute function supabase_functions.http_request(
//       'https://<app>/api/realtime/webhook', 'POST',
//       '{"Content-Type":"application/json","x-webhook-secret":"<secret>"}',
//       '{}', '1000');
// Tables: exam_sessions, exam_attempts, users, classes, questions,
//         whatsapp_groups, student_profiles.

const TABLE_PATHS: Record<string, string[]> = {
  exam_sessions: ["/admin", "/admin/exams", "/admin/reports", "/dashboard"],
  exam_attempts: ["/admin", "/admin/reports", "/dashboard"],
  exam_attempt_answers: ["/admin", "/admin/reports", "/dashboard"],
  exam_attempt_subject_stats: ["/admin", "/admin/reports", "/dashboard"],
  exam_integrity_events: ["/admin", "/admin/reports"],
  exam_states: ["/admin", "/admin/reports"],
  exam_responses: ["/admin", "/admin/reports"],
  users: ["/admin", "/admin/students", "/admin/staff"],
  classes: ["/admin", "/admin/classes"],
  questions: ["/admin", "/admin/questions"],
  question_blanks: ["/admin", "/admin/questions"],
  whatsapp_groups: ["/admin", "/admin/classes"],
  student_profiles: ["/dashboard", "/admin/students"],
  subjects: ["/admin", "/admin/settings", "/admin/questions", "/admin/exams"],
};

export async function POST(req: Request) {
  const secret = req.headers.get("x-webhook-secret");
  if (!secret || secret !== process.env.SUPABASE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { table?: string; type?: string } | null;
  const table = body?.table ?? "";
  const paths = TABLE_PATHS[table] ?? ["/admin", "/dashboard"];
  for (const p of paths) revalidatePath(p);
  return NextResponse.json({ ok: true, table, revalidated: paths });
}
