import Link from "next/link";
import { MoreHorizontal, Plus } from "lucide-react";
import {
  AdminEmptyState,
  AdminFilterLinks,
  AdminPageHeader,
  AdminSearchForm,
  adminIconButtonClass,
  adminPrimaryButtonClass,
  adminSurfaceClass,
} from "@/components/admin/admin-ui";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
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
    if (source === "teacher" && !item.created_by_profile_id) return false;
    if (source === "bank" && item.created_by_profile_id) return false;
    return true;
  });

  return (
    <div>
      <AdminPageHeader eyebrow="Assessment content" title="Question Bank" description="Questions belong to canonical subjects; teacher visibility follows subject qualification rather than programme labels or subject codes." actions={<Button render={<Link href="/admin/questions?modal=question-new" />} className={adminPrimaryButtonClass}><Plus data-icon="inline-start" />New question</Button>} />
      <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]"><AdminSearchForm query={params.q} placeholder="Search question text, subject or domain" hidden={{ subject: subject === "all" ? undefined : subject, type: type === "all" ? undefined : type, source: source === "all" ? undefined : source }} /><div className="text-xs font-semibold text-neutral-500">{scoped.filter((item) => item.created_by_profile_id).length} staff authored · {scoped.filter((item) => !item.created_by_profile_id).length} bank</div></div>
      <div className="mb-4 flex flex-wrap gap-2">
        <AdminFilterLinks pathname="/admin/questions" param="subject" current={subject} preserve={{ q: params.q, type: type === "all" ? undefined : type, source: source === "all" ? undefined : source }} options={[{ value: "all", label: "All subjects" }, ...visibleSubjects.map((item) => ({ value: item.id, label: item.name }))]} />
        <AdminFilterLinks pathname="/admin/questions" param="type" current={type} preserve={{ q: params.q, subject: subject === "all" ? undefined : subject, source: source === "all" ? undefined : source }} options={[{ value: "all", label: "All types" }, { value: "single", label: "Single" }, { value: "multi", label: "Multiple" }, { value: "boolean", label: "True/false" }, { value: "fill", label: "Fill" }]} />
        <AdminFilterLinks pathname="/admin/questions" param="source" current={source} preserve={{ q: params.q, subject: subject === "all" ? undefined : subject, type: type === "all" ? undefined : type }} options={[{ value: "all", label: "All sources" }, { value: "teacher", label: "Staff" }, { value: "bank", label: "Bank" }]} />
      </div>
      <section className={`${adminSurfaceClass} overflow-hidden`}>
        {questions.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-bold uppercase tracking-[.1em] text-neutral-500"><tr><th className="px-4 py-3">Question</th><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Difficulty</th><th className="px-4 py-3">Source</th><th className="px-4 py-3"><span className="sr-only">Open</span></th></tr></thead><tbody className="divide-y divide-neutral-100">{questions.slice(0, 120).map((item) => <tr key={String(item.id)} className="hover:bg-neutral-50"><td className="max-w-xl px-4 py-3"><Link href={`/admin/questions?modal=question&question=${item.id}`} className="text-left"><strong className="line-clamp-2 text-neutral-950">{item.prompt || `Question ${String(item.id)}`}</strong><span className="mt-1 block text-xs text-neutral-500">#{String(item.id)}{item.domain ? ` · ${item.domain}` : ""}</span></Link></td><td className="px-4 py-3">{subjectName.get(item.subject_id) ?? "Subject"}</td><td className="px-4 py-3"><StatusBadge tone="neutral">{item.qtype}</StatusBadge></td><td className="px-4 py-3 capitalize">{item.difficulty || "medium"}</td><td className="px-4 py-3 text-xs text-neutral-500">{item.created_by_profile_id ? "Staff" : "Bank"}</td><td className="px-4 py-3 text-right"><Button size="icon" variant="outline" render={<Link href={`/admin/questions?modal=question&question=${item.id}`} />} className={adminIconButtonClass} aria-label={`Open question ${String(item.id)}`}><MoreHorizontal /></Button></td></tr>)}</tbody></table></div> : <AdminEmptyState title="No matching questions" description="Change the filters or add a question in an allowed subject." />}
      </section>
    </div>
  );
}
