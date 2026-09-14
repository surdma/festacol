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
import { SyncBankButton } from "@/components/admin/sync-bank-button";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { currentStaff } from "@/lib/auth/staff";
import { cn } from "@/lib/utils";
import type { QuestionRow, SubjectRow } from "@/types/db";

export default async function AdminQuestionsPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; subject?: string; source?: string }> }) {
  const params = await searchParams;
  const q = String(params.q ?? "").trim().toLowerCase();
  const type = ["single", "multi", "boolean", "fill", "fill-multi"].includes(String(params.type)) ? String(params.type) : "all";
  const source = params.source === "teacher" || params.source === "bank" ? params.source : "all";
  const { supabase, scope } = await currentStaff();
  const [questionsResult, subjectsResult] = await Promise.all([
    supabase.from("questions").select("*").order("id").limit(1000),
    supabase.from("subjects").select("*").eq("active", true).order("name"),
  ]);
  const subjects = (subjectsResult.data ?? []) as SubjectRow[];
  const subject = params.subject && subjects.some((item) => item.code === params.subject) ? params.subject : "all";
  const all = (questionsResult.data ?? []) as QuestionRow[];
  const scoped = scope.isAdmin ? all : all.filter((item) => scope.subjects.includes(item.subject_code) || (scope.qualifierAccess && item.subject_code.startsWith("q-")));
  const questions = scoped.filter((item) => {
    if (q && !`${item.prompt} ${item.subject_name} ${item.subject_code} ${item.domain}`.toLowerCase().includes(q)) return false;
    if (type !== "all" && item.qtype !== type) return false;
    if (subject !== "all" && item.subject_code !== subject) return false;
    if (source === "teacher" && !item.created_by) return false;
    if (source === "bank" && item.created_by) return false;
    return true;
  });

  return (
    <div>
      <AdminPageHeader
        eyebrow="Question intelligence"
        title="Question Bank"
        description="Review curriculum questions and teacher-authored items used by the production examination engine."
        actions={<>{scope.isAdmin ? <SyncBankButton /> : null}<Button render={<Link href="/admin/questions?modal=question-new" />} className={adminPrimaryButtonClass}><Plus className="size-4" />Add question</Button></>}
      />

      <section className={cn(adminSurfaceClass, "mb-4 p-5")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Questions</p>
            <h2 className="mt-1 font-display text-lg font-extrabold text-neutral-950">Question bank</h2>
            <p className="mt-1 text-xs text-neutral-500">{scoped.length} questions available in your current production scope.</p>
          </div>
          <div className="text-xs font-semibold text-neutral-500">{scoped.filter((item) => item.created_by).length} staff authored · {scoped.filter((item) => !item.created_by).length} bank</div>
        </div>
      </section>

      <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <AdminSearchForm query={params.q} placeholder="Search prompt, subject or domain" hidden={{ type: type === "all" ? undefined : type, subject: subject === "all" ? undefined : subject, source: source === "all" ? undefined : source }} />
        <AdminFilterLinks pathname="/admin/questions" param="source" current={source} preserve={{ q: params.q, subject: subject === "all" ? undefined : subject, type: type === "all" ? undefined : type }} options={[{ value: "all", label: "All sources" }, { value: "bank", label: "Bank" }, { value: "teacher", label: "Staff authored" }]} />
      </div>
      <div className="mb-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
        <AdminFilterLinks pathname="/admin/questions" param="subject" current={subject} preserve={{ q: params.q, type: type === "all" ? undefined : type, source: source === "all" ? undefined : source }} options={[{ value: "all", label: "All subjects" }, ...subjects.map((item) => ({ value: item.code, label: item.name }))]} />
        <AdminFilterLinks pathname="/admin/questions" param="type" current={type} preserve={{ q: params.q, subject: subject === "all" ? undefined : subject, source: source === "all" ? undefined : source }} options={[{ value: "all", label: "All types" }, { value: "single", label: "Single" }, { value: "multi", label: "Multi" }, { value: "boolean", label: "True / False" }, { value: "fill", label: "Fill" }, { value: "fill-multi", label: "Multi-gap" }]} />
      </div>

      <section className={cn(adminSurfaceClass, "overflow-hidden")}>
        {questions.length ? <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-bold uppercase tracking-[.1em] text-neutral-500"><tr><th className="px-4 py-3">Question</th><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Difficulty</th><th className="px-4 py-3">Source</th><th className="px-4 py-3"><span className="sr-only">Open</span></th></tr></thead>
              <tbody className="divide-y divide-neutral-100">{questions.slice(0, 120).map((item) => <tr key={String(item.id)} className="hover:bg-neutral-50"><td className="max-w-xl px-4 py-3"><Link href={`/admin/questions?modal=question&question=${item.id}`} className="text-left"><strong className="line-clamp-2 text-neutral-950">{item.prompt || `Question ${String(item.id)}`}</strong><span className="mt-1 block text-xs text-neutral-500">#{String(item.id)}{item.domain ? ` · ${item.domain}` : ""}</span></Link></td><td className="px-4 py-3">{item.subject_name || item.subject_code}</td><td className="px-4 py-3"><StatusBadge tone="neutral">{item.qtype}</StatusBadge></td><td className="px-4 py-3 capitalize">{item.difficulty || "medium"}</td><td className="px-4 py-3 text-xs text-neutral-500">{item.created_by ? "Staff" : "Bank"}</td><td className="px-4 py-3 text-right"><Button size="icon" variant="outline" render={<Link href={`/admin/questions?modal=question&question=${item.id}`} />} className={adminIconButtonClass} aria-label={`Open question ${String(item.id)}`}><MoreHorizontal className="size-5" /></Button></td></tr>)}</tbody>
            </table>
          </div>
          <div className="divide-y divide-neutral-100 md:hidden">{questions.slice(0, 120).map((item) => <Link key={String(item.id)} href={`/admin/questions?modal=question&question=${item.id}`} className="block w-full p-4 text-left transition hover:bg-neutral-50"><strong className="line-clamp-2 text-sm text-neutral-950">{item.prompt}</strong><span className="mt-2 flex items-center gap-2 text-xs text-neutral-500">{item.subject_name || item.subject_code}<StatusBadge tone="neutral">{item.qtype}</StatusBadge></span></Link>)}</div>
        </> : <AdminEmptyState title="No matching questions" description="Change the current filters or add a teacher-authored question." />}
      </section>
    </div>
  );
}
