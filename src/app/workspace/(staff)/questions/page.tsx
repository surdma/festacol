import Link from "next/link";
import { Plus } from "lucide-react";
import {
  AdminEmptyState,
  AdminFilterLinks,
  AdminPageHeader,
  AdminSearchForm,
  adminPrimaryButtonClass,
} from "@/components/admin/admin-ui";
import { QuestionDirectoryTable } from "@/components/admin/question-directory-table";
import { currentStaff, questionSubjectVisibleTo } from "@/lib/auth/staff";
import { listActiveSubjects, listQuestions } from "@/lib/supabase/queries";

export default async function AdminQuestionsPage({ searchParams }: { searchParams: Promise<{ q?: string; subject?: string; type?: string; source?: string }> }) {
  const params = await searchParams;
  const q = String(params.q ?? "").trim().toLowerCase();
  const subject = String(params.subject ?? "all");
  const type = String(params.type ?? "all");
  const source = String(params.source ?? "all");
  const { supabase, scope } = await currentStaff();
  const [all, subjects] = await Promise.all([listQuestions(supabase), listActiveSubjects(supabase)]);
  const subjectName = new Map(subjects.map((row) => [row.id, row.name]));
  const visibleSubjects = scope.isAdmin ? subjects : subjects.filter((row) => questionSubjectVisibleTo(row.id, scope));
  const scoped = all.filter((item) => questionSubjectVisibleTo(item.subject_id, scope));
  const questions = scoped.filter((item) => {
    const name = subjectName.get(item.subject_id) ?? "";
    if (q && !`${item.prompt} ${name} ${item.domain}`.toLowerCase().includes(q)) return false;
    if (type !== "all" && item.qtype !== type) return false;
    if (subject !== "all" && item.subject_id !== subject) return false;
    if (source === "teacher" && !item.creator_id) return false;
    if (source === "bank" && item.creator_id) return false;
    return true;
  });

  const tableRows = questions.map((item) => ({
    ...item,
    subjectName: subjectName.get(item.subject_id) ?? "Subject",
  }));

  return (
    <div>
      <AdminPageHeader
        eyebrow="Assessment content"
        title="Question Bank"
        description="Questions belong to canonical subjects; staff-authored questions retain their creator while seeded bank questions are system-owned."
        actions={<Link href="/workspace/questions?modal=question-new" className={adminPrimaryButtonClass}><Plus data-icon="inline-start" />New question</Link>}
      />
      <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <AdminSearchForm
          query={params.q}
          placeholder="Search question text, subject or domain"
          hidden={{ subject: subject === "all" ? undefined : subject, type: type === "all" ? undefined : type, source: source === "all" ? undefined : source }}
        />
        <div className="text-xs font-semibold text-neutral-500">
          {scoped.filter((item) => item.creator_id).length} staff authored · {scoped.filter((item) => !item.creator_id).length} bank
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <AdminFilterLinks pathname="/workspace/questions" param="subject" current={subject} preserve={{ q: params.q, type: type === "all" ? undefined : type, source: source === "all" ? undefined : source }} options={[{ value: "all", label: "All subjects" }, ...visibleSubjects.map((item) => ({ value: item.id, label: item.name }))]} />
        <AdminFilterLinks pathname="/workspace/questions" param="type" current={type} preserve={{ q: params.q, subject: subject === "all" ? undefined : subject, source: source === "all" ? undefined : source }} options={[{ value: "all", label: "All types" }, { value: "single", label: "Single" }, { value: "multi", label: "Multiple" }, { value: "boolean", label: "True/false" }, { value: "fill", label: "Fill" }]} />
        <AdminFilterLinks pathname="/workspace/questions" param="source" current={source} preserve={{ q: params.q, subject: subject === "all" ? undefined : subject, type: type === "all" ? undefined : type }} options={[{ value: "all", label: "All sources" }, { value: "teacher", label: "Staff" }, { value: "bank", label: "Bank" }]} />
      </div>
      {tableRows.length ? (
        <QuestionDirectoryTable rows={tableRows} />
      ) : (
        <AdminEmptyState title="No matching questions" description="Change the filters or add a question in an allowed subject." />
      )}
    </div>
  );
}
