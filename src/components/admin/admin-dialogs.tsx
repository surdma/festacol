"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { StaffScopeDialog } from "@/components/admin/staff-provision-dialog";
import { ClassAcademicRecordDialog } from "./academic-record-dialogs";
import { ClassFormDialog } from "./class-form-dialog";
import { AttemptDetailDialog, ExamDetailDialog, ExamEditDialog, QuestionDetailDialog, UserDetailDialog } from "./detail-dialogs";
import { QuestionFormDialog, UserFormDialog } from "./entity-forms";
import { ExamWizard } from "./exam-wizard";
import { StudentDossierDialog } from "./student-dossier-dialog";
import { StudentFormDialog } from "./student-form-dialog";
import { WhatsappFormDialog } from "./whatsapp-form-dialog";

const RECORD_KEYS = ["exam", "student", "staff", "class", "question", "attempt", "group", "step", "view"] as const;

function Host() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const modal = params.get("modal");

  function close() {
    const next = new URLSearchParams(params.toString());
    next.delete("modal");
    for (const key of RECORD_KEYS) next.delete(key);
    if (modal === "user-new" && pathname !== "/workspace/staff") next.delete("role");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const examId = params.get("exam");
  const studentId = params.get("student");
  const staffId = params.get("staff");
  const classId = params.get("class");
  const questionId = params.get("question");
  const attemptId = params.get("attempt");
  const groupId = params.get("group");
  const newUserRole = params.get("role") ?? "student";

  return (
    <>
      <ExamWizard open={modal === "create-exam"} onClose={close} />
      {modal === "exam" && examId ? <ExamDetailDialog examId={examId} onClose={close} /> : null}
      {modal === "exam-edit" && examId ? <ExamEditDialog examId={examId} onClose={close} /> : null}
      {modal === "student" && studentId ? <StudentDossierDialog userId={studentId} onClose={close} /> : null}
      {modal === "staff" && staffId ? <UserDetailDialog userId={staffId} onClose={close} /> : null}
      {modal === "staff-edit" && staffId ? <StaffScopeDialog staffId={staffId} onClose={close} /> : null}
      {modal === "attempt" && attemptId ? <AttemptDetailDialog attemptId={attemptId} onClose={close} /> : null}
      {modal === "question" && questionId ? <QuestionDetailDialog questionId={Number(questionId)} onClose={close} /> : null}
      {modal === "class" && classId ? <ClassAcademicRecordDialog classId={classId} onClose={close} /> : null}
      {modal === "user-new" ? newUserRole === "student" ? <StudentFormDialog open onClose={close} /> : <UserFormDialog open presetRole={newUserRole} onClose={close} /> : null}
      {modal === "user-edit" && studentId ? <StudentFormDialog open userId={studentId} onClose={close} /> : null}
      {modal === "class-new" ? <ClassFormDialog open onClose={close} /> : null}
      {modal === "class-edit" && classId ? <ClassFormDialog open classId={classId} onClose={close} /> : null}
      {modal === "question-new" ? <QuestionFormDialog open onClose={close} /> : null}
      {modal === "question-edit" && questionId ? <QuestionFormDialog open questionId={Number(questionId)} onClose={close} /> : null}
      {modal === "whatsapp-new" ? <WhatsappFormDialog open classId={classId ?? undefined} onClose={close} /> : null}
      {modal === "whatsapp-edit" && groupId ? <WhatsappFormDialog open classId={classId ?? undefined} groupId={groupId} onClose={close} /> : null}
    </>
  );
}

export function AdminDialogs() {
  return <Suspense><Host /></Suspense>;
}
