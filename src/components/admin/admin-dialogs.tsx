"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ExamWizard } from "./exam-wizard";
import {
  AttemptDetailDialog,
  ClassDetailDialog,
  ExamDetailDialog,
  ExamEditDialog,
  QuestionDetailDialog,
  UserDetailDialog,
} from "./detail-dialogs";
import { ClassFormDialog, QuestionFormDialog, UserFormDialog, WhatsappFormDialog } from "./entity-forms";

function Host() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const modal = params.get("modal");

  function close() {
    router.push(pathname);
    router.refresh();
  }

  const examId = params.get("exam");
  const studentId = params.get("student");
  const staffId = params.get("staff");
  const classId = params.get("class");
  const questionId = params.get("question");
  const attemptHash = params.get("attempt");
  const groupId = params.get("group");

  return (
    <>
      <ExamWizard open={modal === "create-exam"} onClose={close} />
      {modal === "exam" && examId ? <ExamDetailDialog examId={examId} onClose={close} /> : null}
      {modal === "exam-edit" && examId ? <ExamEditDialog examId={examId} onClose={close} /> : null}
      {modal === "student" && studentId ? <UserDetailDialog userId={studentId} onClose={close} /> : null}
      {modal === "staff" && staffId ? <UserDetailDialog userId={staffId} onClose={close} /> : null}
      {modal === "attempt" && attemptHash ? <AttemptDetailDialog attemptHash={attemptHash} onClose={close} /> : null}
      {modal === "question" && questionId ? <QuestionDetailDialog questionId={Number(questionId)} onClose={close} /> : null}
      {modal === "class" && classId ? <ClassDetailDialog classId={classId} onClose={close} /> : null}
      {modal === "user-new" ? <UserFormDialog open presetRole={params.get("role") ?? "student"} onClose={close} /> : null}
      {modal === "user-edit" && studentId ? <UserFormDialog open presetRole="student" userId={studentId} onClose={close} /> : null}
      {modal === "class-new" ? <ClassFormDialog open onClose={close} /> : null}
      {modal === "class-edit" && classId ? <ClassFormDialog open classId={classId} onClose={close} /> : null}
      {modal === "question-new" ? <QuestionFormDialog open onClose={close} /> : null}
      {modal === "question-edit" && questionId ? <QuestionFormDialog open questionId={Number(questionId)} onClose={close} /> : null}
      {modal === "whatsapp-new" && classId ? <WhatsappFormDialog open classId={classId} onClose={close} /> : null}
      {modal === "whatsapp-edit" && classId && groupId ? <WhatsappFormDialog open classId={classId} groupId={groupId} onClose={close} /> : null}
    </>
  );
}

export function AdminDialogs() {
  return <Suspense><Host /></Suspense>;
}
