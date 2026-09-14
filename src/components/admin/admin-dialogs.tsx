"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { StaffScopeDialog } from "@/components/admin/staff-provision-dialog";
import { WhatsappGlobalDialog } from "@/components/admin/prototype-parity-dialogs";
import { ExamWizard } from "./exam-wizard";
import { AttemptDetailDialog, ClassDetailDialog, ExamDetailDialog, ExamEditDialog, QuestionDetailDialog, UserDetailDialog } from "./detail-dialogs";
import { ClassFormDialog, QuestionFormDialog, UserFormDialog, WhatsappFormDialog } from "./entity-forms";

const RECORD_KEYS = ["exam", "student", "staff", "class", "question", "attempt", "group", "step"] as const;

function Host() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const modal = params.get("modal");

  function close() {
    const next = new URLSearchParams(params.toString());
    next.delete("modal");
    for (const key of RECORD_KEYS) next.delete(key);
    if (modal === "user-new" && pathname !== "/admin/staff") next.delete("role");
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
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
      {modal === "staff-edit" && staffId ? <StaffScopeDialog staffId={staffId} onClose={close} /> : null}
      {modal === "attempt" && attemptHash ? <AttemptDetailDialog attemptHash={attemptHash} onClose={close} /> : null}
      {modal === "question" && questionId ? <QuestionDetailDialog questionId={Number(questionId)} onClose={close} /> : null}
      {modal === "class" && classId ? <ClassDetailDialog classId={classId} onClose={close} /> : null}
      {modal === "user-new" ? <UserFormDialog open presetRole={params.get("role") ?? "student"} onClose={close} /> : null}
      {modal === "user-edit" && studentId ? <UserFormDialog open presetRole="student" userId={studentId} onClose={close} /> : null}
      {modal === "class-new" ? <ClassFormDialog open onClose={close} /> : null}
      {modal === "class-edit" && classId ? <ClassFormDialog open classId={classId} onClose={close} /> : null}
      {modal === "question-new" ? <QuestionFormDialog open onClose={close} /> : null}
      {modal === "question-edit" && questionId ? <QuestionFormDialog open questionId={Number(questionId)} onClose={close} /> : null}
      {modal === "whatsapp-new" ? classId ? <WhatsappFormDialog open classId={classId} onClose={close} /> : <WhatsappGlobalDialog onClose={close} /> : null}
      {modal === "whatsapp-edit" && classId && groupId ? <WhatsappFormDialog open classId={classId} groupId={groupId} onClose={close} /> : null}
    </>
  );
}

export function AdminDialogs() {
  return <Suspense><Host /></Suspense>;
}
