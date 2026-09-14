"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { StaffScopeDialog } from "@/components/admin/staff-provision-dialog";
import { ExamWizard } from "./exam-wizard";
import { AttemptDetailDialog, ExamDetailDialog, ExamEditDialog, QuestionDetailDialog, UserDetailDialog } from "./detail-dialogs";
import { QuestionFormDialog, UserFormDialog } from "./entity-forms";
import { Task7ClassFormDialog } from "./task7-class-form";
import { ClassAcademicRecordDialog, StudentAcademicRecordDialog } from "./task7-record-dialogs";
import { Task7WhatsappFormDialog } from "./task7-whatsapp-form";

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
      {modal === "student" && studentId ? <StudentAcademicRecordDialog userId={studentId} onClose={close} /> : null}
      {modal === "staff" && staffId ? <UserDetailDialog userId={staffId} onClose={close} /> : null}
      {modal === "staff-edit" && staffId ? <StaffScopeDialog staffId={staffId} onClose={close} /> : null}
      {modal === "attempt" && attemptHash ? <AttemptDetailDialog attemptHash={attemptHash} onClose={close} /> : null}
      {modal === "question" && questionId ? <QuestionDetailDialog questionId={Number(questionId)} onClose={close} /> : null}
      {modal === "class" && classId ? <ClassAcademicRecordDialog classId={classId} onClose={close} /> : null}
      {modal === "user-new" ? <UserFormDialog open presetRole={params.get("role") ?? "student"} onClose={close} /> : null}
      {modal === "user-edit" && studentId ? <UserFormDialog open presetRole="student" userId={studentId} onClose={close} /> : null}
      {modal === "class-new" ? <Task7ClassFormDialog open onClose={close} /> : null}
      {modal === "class-edit" && classId ? <Task7ClassFormDialog open classId={classId} onClose={close} /> : null}
      {modal === "question-new" ? <QuestionFormDialog open onClose={close} /> : null}
      {modal === "question-edit" && questionId ? <QuestionFormDialog open questionId={Number(questionId)} onClose={close} /> : null}
      {modal === "whatsapp-new" ? <Task7WhatsappFormDialog open classId={classId ?? undefined} onClose={close} /> : null}
      {modal === "whatsapp-edit" && groupId ? <Task7WhatsappFormDialog open classId={classId ?? undefined} groupId={groupId} onClose={close} /> : null}
    </>
  );
}

export function AdminDialogs() {
  return <Suspense><Host /></Suspense>;
}
