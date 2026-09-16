import { ExamWorkspace } from "@/app/dashboard/exam/workspace";
import { currentStudent } from "@/lib/auth/current-student";
import { normalizeExamToken } from "@/lib/exam-links";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AccessDenied } from "@/components/access-denied";

export default async function StandaloneExamPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const raw = ((await searchParams).token ?? "").trim();
  const token = normalizeExamToken(raw);

  // Token check
  if (!token) {
    return (
      <div className="mx-auto max-w-md p-6">
        <AccessDenied
          title="Invalid exam link"
          message="This exam link is missing or malformed. Ask your teacher for the full link."
          signInHref="/"
          signInLabel="Back to home"
        />
      </div>
    );
  }

  const ctx = await currentStudent();
  if (!ctx) {
    // Unauthenticated: deny with preserved ?next=
    return (
      <div className="mx-auto max-w-md p-6">
        <AccessDenied
          title="Sign in required"
          message="Sign in with your student account to open this exam."
          signInHref={`/?next=${encodeURIComponent(`/exam?token=${encodeURIComponent(token)}`)}`}
          signInLabel="Go to sign in"
          returnHref="/"
        />
      </div>
    );
  }

  // Staff deny
  const { data: member } = await ctx.supabase
    .from("school_members")
    .select("role")
    .eq("auth_user_id", ctx.authUserId ?? "")
    .eq("status", "active")
    .maybeSingle();
  if ((member as { role?: string })?.role === "teacher" || (member as { role?: string })?.role === "administrator") {
    return (
      <div className="mx-auto max-w-md p-6">
        <AccessDenied
          title="Staff accounts cannot write exams"
          message="You are signed in with a staff account. Sign out first to write this exam with a student account."
          signInHref={`/?next=${encodeURIComponent(`/exam?token=${encodeURIComponent(token)}`)}`}
          signInLabel="Sign out and continue as student"
          returnHref="/"
        />
      </div>
    );
  }

  // Token validity + exam session
  const admin = createSupabaseAdminClient();
  const { data: link } = await admin
    .from("exam_session_links")
    .select("session_id,active,expires_at")
    .eq("token", token)
    .eq("active", true)
    .maybeSingle();

  if (!link) {
    return (
      <div className="mx-auto max-w-md p-6">
        <AccessDenied
          title="Exam unavailable"
          message="This exam link is invalid or expired."
          signInHref="/"
          signInLabel="Back to home"
        />
      </div>
    );
  }
  const linkRow = link as { session_id: string; expires_at?: string | null };
  if (linkRow.expires_at && new Date(String(linkRow.expires_at)).getTime() <= Date.now()) {
    return (
      <div className="mx-auto max-w-md p-6">
        <AccessDenied
          title="Exam unavailable"
          message="This exam link has expired."
          signInHref="/"
          signInLabel="Back to home"
        />
      </div>
    );
  }

  const examId = String(linkRow.session_id).toUpperCase();
  const { data: access } = await ctx.supabase.rpc("my_exam_access", { p_session_id: examId });
  const accessRow = (Array.isArray(access) ? access[0] : access) as { eligible?: boolean; denial_reason?: string } | null;
  if (!accessRow?.eligible) {
    const reason = accessRow?.denial_reason ?? "not_eligible";
    const messages: Record<string, string> = {
      not_started: "This examination has not started yet.",
      ended: "This examination has closed.",
      not_open: "This examination is not open.",
      not_eligible: "This examination is not assigned to you.",
      not_qualified: "Your current level does not qualify for this examination.",
      placement_first: "Write the placement exam first, then return to this class exam.",
    };
    return (
      <div className="mx-auto max-w-md p-6">
        <AccessDenied
          title="Exam unavailable"
          message={messages[reason] ?? "This examination is unavailable or not assigned to you."}
          signInHref="/"
          signInLabel="Back to home"
        />
      </div>
    );
  }

  const { data: session } = await ctx.supabase
    .from("exam_sessions")
    .select("id,title,duration_seconds")
    .eq("id", examId)
    .maybeSingle();
  if (!session) {
    return (
      <div className="mx-auto max-w-md p-6">
        <AccessDenied
          title="Exam unavailable"
          message="Exam session metadata is unavailable."
          signInHref="/"
          signInLabel="Back to home"
        />
      </div>
    );
  }
  const s = session as { id: string; title: string; duration_seconds: number };

  // Full-screen standalone exam shell: no sidebar/header chrome
  return (
    <div className="mx-auto w-full max-w-7xl px-2 py-4 sm:px-6 lg:px-8">
      <ExamWorkspace
        sessionId={s.id}
        title={s.title}
        durationSeconds={Number(s.duration_seconds)}
      />
    </div>
  );
}
