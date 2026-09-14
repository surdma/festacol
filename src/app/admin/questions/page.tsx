import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";
import { AdminFilterLinks, AdminPageHeader, AdminSearchForm } from "@/components/admin/admin-ui";
import { SyncBankButton } from "@/components/admin/sync-bank-button";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currentStaff } from "@/lib/auth/staff";
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
  const scoped = scope.isAdmin || scope.qualifierAccess ? all : all.filter((item) => scope.subjects.includes(item.subject_code));
  const questions = scoped.filter((item) => {
    if (q && !`${item.prompt} ${item.subject_name} ${item.subject_code} ${item.domain}`.toLowerCase().includes(q)) return false;
    if (type !== "all" && item.qtype !== type) return false;
    if (subject !== "all" && item.subject_code !== subject) return false;
    if (source === "teacher" && !item.created_by) return false;
    if (source === "bank" && item.created_by) return false;
    return true;
  });
  const teacherCount = scoped.filter((item) => item.created_by).length;
  const bankCount = scoped.length - teacherCount;

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Question inventory"
        title="Question Bank"
        description={scope.isAdmin ? "Search, author and maintain the production question catalog. Seed sync is insert-only, so local edits remain intact." : `Scoped to ${scope.subjects.join(", ") || "your assigned subjects"}. You may author and remove your own questions.`}
        actions={<>{scope.isAdmin ? <SyncBankButton /> : null}<Button render={<Link href="/admin/questions?modal=question-new" />}><Plus data-icon="inline-start" />Add question</Button></>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground">Visible questions</p><p className="mt-1 text-2xl font-semibold tabular-nums">{scoped.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground">Bank seeded</p><p className="mt-1 text-2xl font-semibold tabular-nums">{bankCount}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground">Staff authored</p><p className="mt-1 text-2xl font-semibold tabular-nums">{teacherCount}</p></CardContent></Card>
      </div>

      <div className="flex flex-col gap-3">
        <AdminSearchForm query={params.q} placeholder="Search prompt, subject or domain" hidden={{ type: type === "all" ? undefined : type, subject: subject === "all" ? undefined : subject, source: source === "all" ? undefined : source }} />
        <div className="flex flex-col gap-2 xl:flex-row">
          <AdminFilterLinks pathname="/admin/questions" param="type" current={type} preserve={{ q: params.q, subject: subject === "all" ? undefined : subject, source: source === "all" ? undefined : source }} options={[{ value: "all", label: "All types" }, { value: "single", label: "Single choice" }, { value: "multi", label: "Multiple choice" }, { value: "boolean", label: "True / False" }, { value: "fill", label: "Fill" }, { value: "fill-multi", label: "Multi-gap" }]} />
          <AdminFilterLinks pathname="/admin/questions" param="source" current={source} preserve={{ q: params.q, subject: subject === "all" ? undefined : subject, type: type === "all" ? undefined : type }} options={[{ value: "all", label: "All sources" }, { value: "bank", label: "Bank" }, { value: "teacher", label: "Staff authored" }]} />
        </div>
        {subjects.length ? (
          <AdminFilterLinks pathname="/admin/questions" param="subject" current={subject} preserve={{ q: params.q, type: type === "all" ? undefined : type, source: source === "all" ? undefined : source }} options={[{ value: "all", label: "All subjects" }, ...subjects.map((item) => ({ value: item.code, label: item.name }))]} />
        ) : null}
      </div>

      <div className="text-sm text-muted-foreground">{questions.length} matching question{questions.length === 1 ? "" : "s"}</div>
      {questions.length ? (
        <Card className="overflow-hidden">
          <div className="hidden lg:block">
            <Table>
              <TableHeader><TableRow><TableHead>Question</TableHead><TableHead>Subject</TableHead><TableHead>Type</TableHead><TableHead>Difficulty</TableHead><TableHead>Source</TableHead></TableRow></TableHeader>
              <TableBody>
                {questions.map((item) => (
                  <TableRow key={String(item.id)}>
                    <TableCell className="max-w-xl"><Link href={`/admin/questions?modal=question&question=${item.id}`} className="font-medium hover:underline line-clamp-2">{item.prompt || `Question ${String(item.id)}`}</Link><p className="mt-1 font-mono text-[11px] text-muted-foreground">#{String(item.id)}{item.domain ? ` · ${item.domain}` : ""}</p></TableCell>
                    <TableCell>{item.subject_name || item.subject_code}</TableCell>
                    <TableCell><StatusBadge tone="blue">{item.qtype}</StatusBadge></TableCell>
                    <TableCell className="capitalize">{item.difficulty || "medium"}</TableCell>
                    <TableCell>{item.created_by ? "Staff" : "Bank"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="divide-y lg:hidden">
            {questions.map((item) => (
              <Link key={String(item.id)} href={`/admin/questions?modal=question&question=${item.id}`} className="flex gap-3 p-4 hover:bg-muted/50">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted"><BookOpen className="size-4" /></span>
                <span className="min-w-0 flex-1"><strong className="line-clamp-2 text-sm">{item.prompt}</strong><span className="mt-1 block text-xs text-muted-foreground">{item.subject_name || item.subject_code} · {item.qtype}</span></span>
              </Link>
            ))}
          </div>
        </Card>
      ) : <Card><CardContent className="p-8 text-center"><BookOpen className="mx-auto size-8 text-muted-foreground" /><h2 className="mt-3 font-medium">No matching questions</h2><p className="mt-1 text-sm text-muted-foreground">Change the current filters or add a question.</p></CardContent></Card>}
    </div>
  );
}
