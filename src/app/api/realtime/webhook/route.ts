import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

// Server-side listener for Supabase Database Webhooks. Browser realtime sockets
// do not refresh server-rendered admin routes, so canonical table changes hit
// this endpoint and invalidate only the affected workspaces.
//
// Configure webhook triggers only for canonical public tables that need UI
// revalidation. Retired prototype tables must not be registered here.
const TABLE_PATHS: Record<string, string[]> = {
  exam_sessions: ["/workspace", "/workspace/exams", "/workspace/reports", "/dashboard"],
  exam_class_targets: ["/workspace/exams", "/workspace/reports"],
  exam_offering_targets: ["/workspace/exams", "/workspace/reports"],
  exam_student_access: ["/workspace/exams", "/workspace/reports", "/dashboard"],
  exam_session_links: ["/workspace/exams", "/dashboard"],
  exam_qr_codes: ["/workspace/exams"],
  exam_attempts: ["/workspace", "/workspace/exams", "/workspace/reports", "/dashboard"],
  exam_attempt_responses: ["/workspace/exams", "/workspace/reports", "/dashboard"],
  exam_integrity_events: ["/workspace/exams", "/workspace/reports"],
  exam_retake_grants: ["/workspace/exams", "/workspace/reports", "/dashboard"],
  school_members: ["/workspace", "/workspace/students", "/workspace/staff", "/workspace/settings"],
  class_enrollments: ["/workspace", "/workspace/students", "/workspace/classes", "/workspace/exams"],
  classes: ["/workspace", "/workspace/classes", "/workspace/settings", "/workspace/exams"],
  class_subject_offerings: ["/workspace/classes", "/workspace/settings", "/workspace/exams"],
  teaching_assignments: ["/workspace/staff", "/workspace/classes", "/workspace/settings", "/workspace/exams"],
  subjects: ["/workspace", "/workspace/settings", "/workspace/questions", "/workspace/exams"],
  subject_curriculum_rules: ["/workspace/settings", "/workspace/classes", "/workspace/exams"],
  questions: ["/workspace", "/workspace/questions", "/workspace/exams"],
  question_academic_levels: ["/workspace/questions", "/workspace/exams"],
  question_blanks: ["/workspace/questions", "/workspace/exams"],
  whatsapp_groups: ["/workspace", "/workspace/classes"],
};

export async function POST(req: Request) {
  const secret = req.headers.get("x-webhook-secret");
  if (!secret || secret !== process.env.SUPABASE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { table?: string; type?: string } | null;
  const table = body?.table ?? "";
  const paths = TABLE_PATHS[table] ?? ["/workspace", "/dashboard"];
  for (const path of paths) revalidatePath(path);
  return NextResponse.json({ ok: true, table, revalidated: paths });
}
