// Hidden exam workspace — NOT in studentNav sidebar.
// Reachable only through an opaque persisted exam-session link. The token is
// navigation identity only; relational eligibility is rechecked server-side.
import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { currentStudent } from "@/lib/auth/current-student";
import { normalizeExamToken } from "@/lib/exam-links";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ExamLinkEntryForm } from "./entry-form";
import { ExamWorkspace } from "./workspace";

function unavailable(title: string, message: string) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {message}
      </CardContent>
    </Card>
  );
}

async function openEntrySession(token: string) {
  const admin = createSupabaseAdminClient();
  const { data: link } = await admin
    .from("exam_session_links")
    .select("session_id,active,expires_at")
    .eq("token", token)
    .eq("active", true)
    .maybeSingle();
  const linkRow = link as {
    session_id: string;
    expires_at?: string | null;
  } | null;
  if (!linkRow) return null;
  if (
    linkRow.expires_at &&
    new Date(String(linkRow.expires_at)).getTime() <= Date.now()
  )
    return null;
  const { data: session } = await admin
    .from("exam_sessions")
    .select("id,title,status,mode")
    .eq("id", String(linkRow.session_id).toUpperCase())
    .maybeSingle();
  const row = session as {
    id: string;
    title: string;
    status: string;
    mode: string;
  } | null;
  if (!row || row.status !== "open") return null;
  return row;
}

export default async function HiddenExamPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const token = normalizeExamToken((await searchParams).token ?? "");
  if (!token)
    return unavailable(
      "Invalid exam link",
      "Missing or malformed access token.",
    );

  const ctx = await currentStudent();
  if (!ctx) {
    // A staff session has no student permission: deny explicitly instead of
    // offering a student sign-in that would silently reuse/overwrite it.
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const { data: member } = await supabase
        .from("school_members")
        .select("role")
        .eq("auth_user_id", data.user.id)
        .eq("status", "active")
        .maybeSingle();
      const role = (member as { role?: string } | null)?.role;
      if (role === "teacher" || role === "administrator") {
        return (
          <AccessDenied
            title="Staff accounts cannot write exams"
            message="You are signed in with a staff account. Sign out first to write this exam with a student account."
            signInHref={`/?next=${encodeURIComponent(`/dashboard/exam?token=${encodeURIComponent(token)}`)}`}
            signInLabel="Sign out and continue as student"
            returnHref="/admin"
          />
        );
      }
    }
    const entry = await openEntrySession(token);
    const returnHref = `/dashboard/exam?token=${encodeURIComponent(token)}`;
    if (!entry) {
      return (
        <Card className="mx-auto max-w-md">
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>
              Sign in with your student account before opening an examination.
              After signing in you will return to this exam.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              render={
                <Link href={`/?next=${encodeURIComponent(returnHref)}`} />
              }
            >
              Go to sign in
            </Button>
          </CardContent>
        </Card>
      );
    }
    const isPlacement = entry.mode === "qualifier";
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Enter {entry.title}</CardTitle>
          <CardDescription>
            {isPlacement
              ? "Placement examination. Type your first and last name — new students are enrolled automatically."
              : "Type your first and last name — new students join the class this exam is set for automatically."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExamLinkEntryForm token={token} />
        </CardContent>
      </Card>
    );
  }

  const { data: link, error: linkError } = await ctx.supabase
    .from("exam_session_links")
    .select("session_id,active,expires_at")
    .eq("token", token)
    .eq("active", true)
    .maybeSingle();
  if (linkError || !link)
    return unavailable(
      "Exam unavailable",
      "This exam link is invalid or is not assigned to you.",
    );
  if (
    link.expires_at &&
    new Date(String(link.expires_at)).getTime() <= Date.now()
  ) {
    return unavailable("Exam unavailable", "This exam link has expired.");
  }

  const examId = String(link.session_id).toUpperCase();
  const { data: access, error: accessError } = await ctx.supabase.rpc(
    "my_exam_access",
    { p_session_id: examId },
  );
  if (accessError)
    return unavailable(
      "Exam unavailable",
      "Exam eligibility could not be verified.",
    );
  const accessRow = (Array.isArray(access) ? access[0] : access) as {
    eligible?: boolean;
    denial_reason?: string | null;
  } | null;
  if (!accessRow?.eligible) {
    const reason = accessRow?.denial_reason;
    const message =
      reason === "not_started"
        ? "This examination has not started yet."
        : reason === "ended"
          ? "This examination has closed."
          : reason === "not_open"
            ? "This examination is not open."
            : "This examination is not assigned to you.";
    return unavailable("Exam unavailable", message);
  }

  const { data: session } = await ctx.supabase
    .from("exam_sessions")
    .select("id,title,duration_seconds")
    .eq("id", examId)
    .maybeSingle();
  const row = session as {
    id: string;
    title: string;
    duration_seconds: number;
  } | null;
  if (!row)
    return unavailable("Exam unavailable", "Session metadata is unavailable.");
  return (
    <ExamWorkspace
      sessionId={row.id}
      title={row.title}
      durationSeconds={Number(row.duration_seconds)}
    />
  );
}
