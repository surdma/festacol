import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

// Server-side listener for Supabase Database Webhooks. Browser realtime sockets
// do not refresh server-rendered admin routes, so canonical table changes hit
// this endpoint and invalidate only the affected workspaces.
//
// Configure webhook triggers only for canonical public tables that need UI
// revalidation. Retired prototype tables must not be registered here.
const TABLE_PATHS: Record<string, string[]> = {
  exam_sessions: ["/admin", "/admin/exams", "/admin/reports", "/dashboard"],
  exam_class_targets: ["/admin/exams", "/admin/reports"],
  exam_offering_targets: ["/admin/exams", "/admin/reports"],
  exam_student_access: ["/admin/exams", "/admin/reports", "/dashboard"],
  exam_session_links: ["/admin/exams", "/dashboard"],
  exam_qr_codes: ["/admin/exams"],
  exam_attempts: ["/admin", "/admin/exams", "/admin/reports", "/dashboard"],
  exam_attempt_responses: ["/admin/exams", "/admin/reports", "/dashboard"],
  exam_integrity_events: ["/admin/exams", "/admin/reports"],
  exam_retake_grants: ["/admin/exams", "/admin/reports", "/dashboard"],
  school_members: ["/admin", "/admin/students", "/admin/staff", "/admin/settings"],
  class_enrollments: ["/admin", "/admin/students", "/admin/classes", "/admin/exams"],
  classes: ["/admin", "/admin/classes", "/admin/settings", "/admin/exams"],
  class_subject_offerings: ["/admin/classes", "/admin/settings", "/admin/exams"],
  teaching_assignments: ["/admin/staff", "/admin/classes", "/admin/settings", "/admin/exams"],
  subjects: ["/admin", "/admin/settings", "/admin/questions", "/admin/exams"],
  subject_curriculum_rules: ["/admin/settings", "/admin/classes", "/admin/exams"],
  questions: ["/admin", "/admin/questions", "/admin/exams"],
  question_academic_levels: ["/admin/questions", "/admin/exams"],
  question_blanks: ["/admin/questions", "/admin/exams"],
  whatsapp_groups: ["/admin", "/admin/classes"],
};

export async function POST(req: Request) {
  const secret = req.headers.get("x-webhook-secret");
  if (!secret || secret !== process.env.SUPABASE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { table?: string; type?: string } | null;
  const table = body?.table ?? "";
  const paths = TABLE_PATHS[table] ?? ["/admin", "/dashboard"];
  for (const path of paths) revalidatePath(path);
  return NextResponse.json({ ok: true, table, revalidated: paths });
}
