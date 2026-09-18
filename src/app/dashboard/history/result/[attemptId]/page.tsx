import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getExamResultByAttemptAction } from "@/app/actions/exam-experience";
import { ExamHistoryResult } from "@/components/exam/exam-history-result";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { currentStudent } from "@/lib/auth/current-student";

export default async function StudentHistoryResultPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const ctx = await currentStudent();
  if (!ctx) {
    const attemptId = encodeURIComponent((await params).attemptId);
    redirect(`/?next=/dashboard/history/result/${attemptId}`);
  }

  const { attemptId } = await params;
  const result = await getExamResultByAttemptAction(attemptId);

  if (!result.ok) {
    return (
      <div className="mx-auto grid w-full max-w-2xl gap-4 py-6">
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Result unavailable</AlertTitle>
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
        <div>
          <Link href="/dashboard/history" className={buttonVariants({ variant: "outline" })}>
            Back to exam history
          </Link>
        </div>
      </div>
    );
  }

  return <ExamHistoryResult initialSummary={result.summary} />;
}
