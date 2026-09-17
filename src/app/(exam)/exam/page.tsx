import Link from "next/link";
import { redirect } from "next/navigation";
import { getExamExperienceContextAction } from "@/app/actions/exam-experience";
import { getExamEntryContextAction } from "@/app/actions/exam-onboarding";
import { AccessDenied } from "@/components/access-denied";
import { ExamWorkspace } from "@/components/exam/exam-workspace";
import { StudentWizard } from "@/components/exam/student-wizard";
import { RealtimeNotificationSync } from "@/components/shell/realtime-notification-sync";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Toaster } from "@/components/ui/toast";
import { currentStudent } from "@/lib/auth/current-student";
import { normalizeExamToken } from "@/lib/exam-links";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function ExamUnavailable({ title, message }: { title: string; message: string }) {
  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Back to home
        </Link>
      </CardContent>
    </Card>
  );
}

export default async function StandaloneExamPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const raw = ((await searchParams).token ?? "").trim();
  const token = normalizeExamToken(raw);

  if (!token) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-7xl items-center px-4 py-8 sm:px-6">
        <ExamUnavailable
          title="Invalid exam link"
          message="This exam link is missing or malformed. Ask your teacher for the complete candidate link or QR code."
        />
      </div>
    );
  }

  const entry = await getExamEntryContextAction(token);
  if (!entry.ok) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-7xl items-center px-4 py-8 sm:px-6">
        <ExamUnavailable title="Exam unavailable" message={entry.error} />
      </div>
    );
  }

  const ctx = await currentStudent();
  if (!ctx) {
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      const { data: member } = await supabase
        .from("school_members")
        .select("role,status")
        .eq("auth_user_id", auth.user.id)
        .maybeSingle();
      const row = member as { role?: string; status?: string } | null;
      if (
        row?.status === "active" &&
        (row.role === "teacher" || row.role === "administrator")
      ) {
        return (
          <div className="mx-auto flex min-h-dvh max-w-7xl items-center px-4 py-8 sm:px-6">
            <AccessDenied
              title="Staff accounts cannot write exams"
              message="You are signed in with a staff account. Sign out first, then continue with the student's first and last name."
              signInHref={`/exam?token=${encodeURIComponent(token)}`}
              signInLabel="Continue to student entry"
              returnHref="/workspace"
            />
          </div>
        );
      }
    }

    const examDestination = `/exam?token=${encodeURIComponent(token)}`;
    redirect(`/?next=${encodeURIComponent(examDestination)}`);
  }

  const { data: access, error: accessError } = await ctx.supabase.rpc(
    "my_exam_access",
    {
      p_session_id: entry.exam.id,
    },
  );
  const accessRow = (Array.isArray(access) ? access[0] : access) as {
    eligible?: boolean;
  } | null;

  if (accessError || !accessRow?.eligible) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-7xl items-center px-4 py-8 sm:px-6">
        <StudentWizard token={token} />
      </div>
    );
  }

  const experience = await getExamExperienceContextAction(entry.exam.id);
  if (!experience.ok) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-7xl items-center px-4 py-8 sm:px-6">
        <ExamUnavailable title="Exam unavailable" message={experience.error} />
      </div>
    );
  }

  const activeAttemptId = experience.data.access.activeAttemptId;
  const workspaceKey = activeAttemptId
    ? `${entry.exam.id}:${activeAttemptId}`
    : `${entry.exam.id}:${experience.data.access.usedAttempts}:${experience.data.access.allowedAttempts}`;

  return (
    <Toaster timeout={6000}>
      <RealtimeNotificationSync
        surface="student"
        recipientId={ctx.profile.profile_id}
        examSessionId={entry.exam.id}
        activeAttemptId={activeAttemptId}
      />
      <ExamWorkspace key={workspaceKey} context={experience.data} />
    </Toaster>
  );
}
