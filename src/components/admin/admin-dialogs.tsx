"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ExamWizard } from "./exam-wizard";
import { AttemptDetailDialog, ExamDetailDialog, QuestionDetailDialog, UserDetailDialog } from "./detail-dialogs";
import { ClassFormDialog, QuestionFormDialog, UserFormDialog, WhatsappFormDialog } from "./entity-forms";

// URL-driven overlays: ?modal=create-exam | exam | student | staff | class-new |
// question-new | question | attempt. Mirrors the prototype OVERLAY_KEYS system
// without any direct DOM manipulation.
function Host() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const modal = params.get("modal");

  function close() {
    router.push(pathname);
    router.refresh();
  }

  return (
    <>
      <ExamWizard open={modal === "create-exam"} onClose={close} />
      {modal === "exam" && params.get("exam") ? <ExamDetailDialog examId={params.get("exam")!} onClose={close} /> : null}
      {modal === "student" && params.get("student") ? <UserDetailDialog userId={params.get("student")!} onClose={close} /> : null}
      {modal === "staff" && params.get("staff") ? <UserDetailDialog userId={params.get("staff")!} onClose={close} /> : null}
      {modal === "attempt" && params.get("attempt") ? <AttemptDetailDialog attemptHash={params.get("attempt")!} onClose={close} /> : null}
      {modal === "question" && params.get("question") ? <QuestionDetailDialog questionId={Number(params.get("question"))} onClose={close} /> : null}
      {modal === "user-new" ? <UserFormDialog open presetRole={params.get("role") ?? "student"} onClose={close} /> : null}
      {modal === "class-new" ? <ClassFormDialog open onClose={close} /> : null}
      {modal === "question-new" ? <QuestionFormDialog open onClose={close} /> : null}
      {modal === "whatsapp-new" ? <WhatsappFormDialog open classId={params.get("class") ?? ""} onClose={close} /> : null}
    </>
  );
}

export function AdminDialogs() {
  return (
    <Suspense>
      <Host />
    </Suspense>
  );
}
