"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getExamResultByAttemptAction } from "@/app/actions/exam-experience";
import { ExamResults } from "@/components/exam/exam-results";
import type { ExamResultSummary } from "@/types/exam";

export function ExamHistoryResult({
  initialSummary,
}: {
  initialSummary: ExamResultSummary;
}) {
  const router = useRouter();
  const [summary, setSummary] = useState(initialSummary);

  async function refreshResult() {
    const result = await getExamResultByAttemptAction(summary.attemptId);
    if (!result.ok) return false;
    setSummary(result.summary);
    return true;
  }

  return (
    <ExamResults
      view="full"
      summary={summary}
      onDashboard={() => router.push("/dashboard/history")}
      onRefresh={refreshResult}
    />
  );
}
