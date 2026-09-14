"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Activity, BookOpenCheck, ExternalLink, GraduationCap, MessageCircle, Pencil, School, ShieldCheck, Users } from "lucide-react";
import { isAdminAction } from "@/app/actions/admin";
import { deleteClassSafelyAction, getClassAcademicRecordAction, getStudentAcademicRecordAction } from "@/app/actions/task7";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const RECORD_KEYS = ["modal", "exam", "student", "staff", "class", "question", "attempt", "group", "step"] as const;

type GenericRow = Record<string, unknown>;

type StudentRecord = Awaited<ReturnType<typeof getStudentAcademicRecordAction>>;
type ClassRecord = Awaited<ReturnType<typeof getClassAcademicRecordAction>>;

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function formatDate(value: unknown) {
  if (!value) return "—";
  const date = new Date(numberValue(value, Number(value)));
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "ST";
}

function useRecordNavigation() {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  return (modal: string, record: { key: string; value: string }) => {
    const next = new URLSearchParams(params.toString());
    for (const key of RECORD_KEYS) next.delete(key);
    next.set("modal", modal);
    next.set(record.key, record.value);
    router.push(`${pathname}?${next.toString()}`);
  };
}

function RecordLoading({ label }: { label: string }) {
  return (
    <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed bg-muted/20 p-8 text-center">
      <div>
        <span className="mx-auto grid size-10 place-items-center rounded-xl bg-foreground text-background"><Activity /></span>
        <p className="mt-4 text-sm font-semibold">Loading {label}…</p>
        <p className="mt-1 text-xs text-muted-foreground">Resolving linked production records.</p>
      </div>
    </div>
  );
}

function RelationshipPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/20 px-3 py-2">
      <span className="block text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">{label}</span>
      <strong className="mt-1 block truncate text-sm">{value}</strong>
    </div>
  );
}

export function StudentAcademicRecordDialog({ userId, onClose }: { userId: string; onClose: () => void }) {
  const router = useRouter();
  const openRecord = useRecordNavigation();
  const [record, setRecord] = useState<StudentRecord | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    void getStudentAcademicRecordAction(userId).then(setRecord).catch(() => setError("Student academic record could not be loaded."));
    void isAdminAction().then(setIsAdmin).catch(() => setIsAdmin(false));
  }, [userId]);

  const user = record?.user as GenericRow | null | undefined;
  const classRow = record?.classRow as GenericRow | null | undefined;
  const whatsapp = record?.whatsappGroup as GenericRow | null | undefined;
  const attempts = useMemo(() => (record?.attempts ?? []) as GenericRow[], [record]);
  const stats = useMemo(() => (record?.stats ?? []) as GenericRow[], [record]);
  const events = useMemo(() => (record?.events ?? []) as GenericRow[], [record]);
  const submitted = useMemo(() => attempts.filter((attempt) => attempt.submitted_at && !attempt.rewrite_archived_at), [attempts]);
  const live = useMemo(() => attempts.filter((attempt) => !attempt.submitted_at && !attempt.rewrite_archived_at), [attempts]);
  const previous = useMemo(() => attempts.filter((attempt) => attempt.rewrite_archived_at), [attempts]);
  const averageScore = average(submitted.map((attempt) => numberValue(attempt.score)));
  const averageIntegrity = average(submitted.map((attempt) => numberValue(attempt.integrity_score, 100)));
  const latestPlacement = attempts.find((attempt) => attempt.assigned_track && !attempt.rewrite_archived_at);
  const subjectSummary = useMemo(() => {
    const buckets = new Map<string, { name: string; values: number[] }>();
    for (const row of stats) {
      const code = String(row.subject_code ?? "Subject");
      const bucket = buckets.get(code) ?? { name: String(row.subject_name ?? code), values: [] };
      bucket.values.push(numberValue(row.percent));
      buckets.set(code, bucket);
    }
    return [...buckets.entries()].map(([code, bucket]) => ({ code, name: bucket.name, score: average(bucket.values) })).sort((a, b) => b.score - a.score);
  }, [stats]);

  return (
    <Dialog open onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-6xl overflow-y-auto p-0">
        <DialogHeader className="border-b bg-neutral-950 px-5 py-5 text-white sm:px-7 sm:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <DialogDescription className="text-neutral-400">Academic student record · {userId}</DialogDescription>
              <DialogTitle className="mt-2 truncate font-display text-2xl font-extrabold text-white sm:text-3xl">{String(user?.full_name ?? "Student record")}</DialogTitle>
              <p className="mt-2 text-sm text-neutral-400">{String(classRow?.name ?? "No class assigned")} · {String(user?.guardian ?? "Guardian not recorded")}</p>
            </div>
            {user ? <div className="flex flex-wrap gap-2">{isAdmin ? <Button variant="outline" className="border-neutral-700 bg-neutral-900 text-white hover:bg-neutral-800" onClick={() => openRecord("user-edit", { key: "student", value: userId })}><Pencil data-icon="inline-start" />Edit student</Button> : null}{classRow?.id ? <Button variant="outline" className="border-neutral-700 bg-neutral-900 text-white hover:bg-neutral-800" onClick={() => openRecord("class", { key: "class", value: String(classRow.id) })}><School data-icon="inline-start" />Open class</Button> : null}</div> : null}
          </div>
        </DialogHeader>

        <div className="p-5 sm:p-7">
          {error ? <p className="mb-4 text-sm text-destructive" role="alert">{error}</p> : null}
          {!record ? <RecordLoading label="student record" /> : !user ? <p className="rounded-xl border p-5 text-sm text-muted-foreground">Student record is unavailable.</p> : (
            <div className="flex flex-col gap-6">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                <MetricCard label="Current class" value={String(classRow?.name ?? "Unassigned")} detail={classRow ? `${String(classRow.class_level)} · ${String(classRow.stream)}` : "Move student into a class to connect cohort reporting."} />
                <MetricCard label="Exam attempts" value={String(attempts.length)} detail={`${submitted.length} submitted · ${live.length} live · ${previous.length} previous`} />
                <MetricCard label="Average score" value={submitted.length ? `${averageScore}%` : "—"} detail="Current submitted attempts" />
                <MetricCard label="Integrity" value={submitted.length ? `${averageIntegrity}%` : "—"} detail={`${events.length} linked integrity event${events.length === 1 ? "" : "s"}`} />
                <MetricCard label="Placement" value={latestPlacement ? String(latestPlacement.assigned_track) : "—"} detail={latestPlacement ? `${numberValue(latestPlacement.placement_confidence)}% confidence` : "No placement outcome recorded"} />
                <MetricCard label="Parent group" value={whatsapp ? "Connected" : "Missing"} detail={whatsapp ? String(whatsapp.name) : "No class WhatsApp mapping"} />
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <RelationshipPill label="Student → class" value={classRow ? `${String(classRow.name)} (${String(classRow.stream)})` : "Unassigned"} />
                <RelationshipPill label="Class → communication" value={whatsapp ? String(whatsapp.name) : "No WhatsApp group"} />
                <RelationshipPill label="Student → examination history" value={`${attempts.length} exact attempt record${attempts.length === 1 ? "" : "s"}`} />
              </div>

              <Tabs defaultValue="exams">
                <TabsList variant="line" className="max-w-full overflow-x-auto">
                  <TabsTrigger value="exams"><BookOpenCheck data-icon="inline-start" />Exams</TabsTrigger>
                  <TabsTrigger value="performance"><GraduationCap data-icon="inline-start" />Performance</TabsTrigger>
                  <TabsTrigger value="integrity"><ShieldCheck data-icon="inline-start" />Integrity</TabsTrigger>
                  <TabsTrigger value="placement"><School data-icon="inline-start" />Placement</TabsTrigger>
                </TabsList>

                <TabsContent value="exams" className="pt-4">
                  <section className="overflow-hidden rounded-2xl border">
                    <div className="border-b bg-muted/20 px-4 py-3"><h3 className="font-semibold">Exact examination attempts</h3><p className="mt-1 text-xs text-muted-foreground">Every row points to the stored attempt hash so integrity and rewrite history stay attached to the correct sitting.</p></div>
                    <div className="divide-y">{attempts.length ? attempts.map((attempt) => {
                      const previousAttempt = Boolean(attempt.rewrite_archived_at);
                      return <div key={String(attempt.attempt_hash)} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><strong className="block truncate text-sm">{String(attempt.session_title ?? attempt.session_id ?? "Examination")}</strong><span className="mt-1 block text-xs text-muted-foreground">{String(attempt.class_level ?? "")} · {String(attempt.class_group ?? "")} · {formatDate(attempt.submitted_at ?? attempt.started_at)}</span><span className="mt-1 block font-mono text-[11px] text-muted-foreground">{String(attempt.attempt_hash)}</span>{attempt.rewrite_source_attempt_hash ? <span className="mt-1 block text-[11px] text-muted-foreground">Rewrite source: {String(attempt.rewrite_source_attempt_hash)}</span> : null}</div><div className="flex flex-wrap items-center gap-2"><StatusBadge tone={previousAttempt ? "neutral" : attempt.submitted_at ? "emerald" : "amber"}>{previousAttempt ? "previous" : attempt.submitted_at ? `${numberValue(attempt.score)}%` : "in progress"}</StatusBadge><StatusBadge tone={numberValue(attempt.integrity_score, 100) >= 80 ? "emerald" : "amber"}>Integrity {numberValue(attempt.integrity_score, 100)}%</StatusBadge><Button size="sm" variant="outline" onClick={() => openRecord("attempt", { key: "attempt", value: String(attempt.attempt_hash) })}>Open attempt</Button>{attempt.session_id ? <Button size="sm" variant="ghost" onClick={() => openRecord("exam", { key: "exam", value: String(attempt.session_id) })}>Exam source</Button> : null}</div></div>;
                    }) : <p className="p-5 text-sm text-muted-foreground">No examination attempts are linked to this student yet.</p>}</div>
                  </section>
                </TabsContent>

                <TabsContent value="performance" className="pt-4">
                  <div className="grid gap-4 lg:grid-cols-[1fr_.8fr]">
                    <section className="rounded-2xl border p-5"><h3 className="font-semibold">Subject performance</h3><p className="mt-1 text-xs text-muted-foreground">Average percentages reconstructed from normalized attempt-subject statistics.</p><div className="mt-5 flex flex-col gap-4">{subjectSummary.length ? subjectSummary.map((subject) => <div key={subject.code}><div className="mb-2 flex items-center justify-between gap-3"><span className="text-sm font-medium">{subject.name}</span><strong className="text-sm tabular-nums">{subject.score}%</strong></div><Progress value={subject.score} /></div>) : <p className="text-sm text-muted-foreground">No subject statistics have been submitted yet.</p>}</div></section>
                    <section className="rounded-2xl border p-5"><h3 className="font-semibold">Academic summary</h3><div className="mt-4 grid gap-3"><RelationshipPill label="Submitted attempts" value={String(submitted.length)} /><RelationshipPill label="Current average" value={submitted.length ? `${averageScore}%` : "No submitted score"} /><RelationshipPill label="Best subject" value={subjectSummary[0] ? `${subjectSummary[0].name} · ${subjectSummary[0].score}%` : "—"} /></div></section>
                  </div>
                </TabsContent>

                <TabsContent value="integrity" className="pt-4">
                  <section className="overflow-hidden rounded-2xl border"><div className="border-b bg-muted/20 px-4 py-3"><h3 className="font-semibold">Integrity event chronology</h3><p className="mt-1 text-xs text-muted-foreground">Events remain keyed to exact attempt hashes.</p></div><div className="divide-y">{events.length ? events.map((event, index) => <button key={`${String(event.at)}-${index}`} type="button" className="flex w-full items-start gap-3 p-4 text-left hover:bg-muted/30" onClick={() => openRecord("attempt", { key: "attempt", value: String(event.attempt_hash) })}><span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-700"><ShieldCheck /></span><span className="min-w-0 flex-1"><strong className="block text-sm">{String(event.type)}</strong><span className="mt-1 block text-xs text-muted-foreground">{String(event.detail ?? "Integrity event")} · {formatDate(event.at)}</span><span className="mt-1 block font-mono text-[11px] text-muted-foreground">{String(event.attempt_hash)}</span></span></button>) : <p className="p-5 text-sm text-muted-foreground">No integrity exceptions are linked to this student.</p>}</div></section>
                </TabsContent>

                <TabsContent value="placement" className="pt-4">
                  <div className="grid gap-4 lg:grid-cols-2"><section className="rounded-2xl border p-5"><h3 className="font-semibold">Current placement context</h3><div className="mt-4 grid gap-3"><RelationshipPill label="Current class" value={String(classRow?.name ?? "Unassigned")} /><RelationshipPill label="Current pathway" value={String(classRow?.stream ?? "—")} /><RelationshipPill label="Latest assigned track" value={latestPlacement ? String(latestPlacement.assigned_track) : "No qualifier outcome"} /></div></section><section className="rounded-2xl border p-5"><h3 className="font-semibold">Qualifier / placement history</h3><div className="mt-4 flex flex-col gap-3">{attempts.filter((attempt) => attempt.assigned_track).map((attempt) => <button key={String(attempt.attempt_hash)} type="button" className="rounded-xl border p-3 text-left transition hover:bg-muted/30" onClick={() => openRecord("attempt", { key: "attempt", value: String(attempt.attempt_hash) })}><strong className="text-sm">{String(attempt.assigned_track)}</strong><span className="mt-1 block text-xs text-muted-foreground">{String(attempt.session_title ?? attempt.session_id)} · confidence {numberValue(attempt.placement_confidence)}%</span></button>)}{!attempts.some((attempt) => attempt.assigned_track) ? <p className="text-sm text-muted-foreground">No placement result has been recorded.</p> : null}</div></section></div>
                </TabsContent>
              </Tabs>

              {whatsapp ? <div className="flex flex-col gap-3 rounded-2xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Class communication</p><strong className="mt-1 block text-sm">{String(whatsapp.name)}</strong></div><Button variant="outline" render={<a href={String(whatsapp.invite_url)} target="_blank" rel="noopener noreferrer" />}><ExternalLink data-icon="inline-start" />Open group</Button></div> : null}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ClassAcademicRecordDialog({ classId, onClose }: { classId: string; onClose: () => void }) {
  const router = useRouter();
  const openRecord = useRecordNavigation();
  const [record, setRecord] = useState<ClassRecord | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setError(null);
    void getClassAcademicRecordAction(classId).then(setRecord).catch(() => setError("Class academic record could not be loaded."));
    void isAdminAction().then(setIsAdmin).catch(() => setIsAdmin(false));
  }, [classId]);

  const classRow = record?.classRow as GenericRow | null | undefined;
  const students = useMemo(() => (record?.students ?? []) as GenericRow[], [record]);
  const whatsapp = record?.whatsappGroup as GenericRow | null | undefined;
  const sessions = useMemo(() => (record?.sessions ?? []) as GenericRow[], [record]);
  const attempts = useMemo(() => (record?.attempts ?? []) as GenericRow[], [record]);
  const submitted = useMemo(() => attempts.filter((attempt) => attempt.submitted_at && !attempt.rewrite_archived_at), [attempts]);
  const averageScore = average(submitted.map((attempt) => numberValue(attempt.score)));
  const averageIntegrity = average(submitted.map((attempt) => numberValue(attempt.integrity_score, 100)));
  const capacity = numberValue(classRow?.capacity);
  const remaining = Math.max(0, capacity - students.filter((student) => student.status === "active").length);
  const occupancy = capacity ? Math.min(100, Math.round((students.filter((student) => student.status === "active").length / capacity) * 100)) : 0;

  function removeClass() {
    setError(null);
    startTransition(async () => {
      const result = await deleteClassSafelyAction(classId);
      if (!result.ok) { setError(result.error ?? "Class could not be deleted."); return; }
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-6xl overflow-y-auto p-0">
        <DialogHeader className="border-b px-5 py-5 sm:px-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div><DialogDescription>Class academic record</DialogDescription><DialogTitle className="mt-1 font-display text-2xl font-extrabold">{String(classRow?.name ?? "Class record")}</DialogTitle><p className="mt-2 text-sm text-muted-foreground">{String(classRow?.class_level ?? "")} · {String(classRow?.stream ?? "")} · {String(classRow?.room || "Room not assigned")}</p></div>
            {classRow && isAdmin ? <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => openRecord("class-edit", { key: "class", value: classId })}><Pencil data-icon="inline-start" />Edit class</Button>{whatsapp ? <Button variant="outline" onClick={() => { const next = new URLSearchParams(window.location.search); for (const key of RECORD_KEYS) next.delete(key); next.set("modal", "whatsapp-edit"); next.set("class", classId); next.set("group", String(whatsapp.id)); router.push(`${window.location.pathname}?${next.toString()}`); }}><MessageCircle data-icon="inline-start" />Manage WhatsApp</Button> : <Button variant="outline" onClick={() => openRecord("whatsapp-new", { key: "class", value: classId })}><MessageCircle data-icon="inline-start" />Connect WhatsApp</Button>}</div> : null}
          </div>
        </DialogHeader>

        <div className="p-5 sm:p-7">
          {error ? <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">{error}</p> : null}
          {!record ? <RecordLoading label="class record" /> : !classRow ? <p className="rounded-xl border p-5 text-sm text-muted-foreground">Class record is unavailable.</p> : (
            <div className="flex flex-col gap-6">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                <MetricCard label="Students" value={String(students.length)} detail={`${students.filter((student) => student.status === "active").length} active`} />
                <MetricCard label="Capacity" value={String(capacity)} detail={`${remaining} remaining place${remaining === 1 ? "" : "s"}`} />
                <MetricCard label="Occupancy" value={`${occupancy}%`} detail={`${students.length}/${capacity || "—"}`} />
                <MetricCard label="Matched exams" value={String(sessions.length)} detail="Derived from level + pathway audience" />
                <MetricCard label="Average score" value={submitted.length ? `${averageScore}%` : "—"} detail={`${submitted.length} submitted class-matched attempts`} />
                <MetricCard label="Integrity" value={submitted.length ? `${averageIntegrity}%` : "—"} detail="Submitted class-matched attempts" />
              </div>

              <div className="rounded-2xl border p-4"><div className="mb-2 flex items-center justify-between gap-3"><span className="text-xs font-semibold text-muted-foreground">Capacity utilization</span><strong className="text-sm tabular-nums">{students.length}/{capacity || "—"}</strong></div><Progress value={occupancy} /></div>

              <Tabs defaultValue="roster">
                <TabsList variant="line" className="max-w-full overflow-x-auto">
                  <TabsTrigger value="roster"><Users data-icon="inline-start" />Students</TabsTrigger>
                  <TabsTrigger value="exams"><BookOpenCheck data-icon="inline-start" />Examinations</TabsTrigger>
                  <TabsTrigger value="communication"><MessageCircle data-icon="inline-start" />Communication</TabsTrigger>
                </TabsList>

                <TabsContent value="roster" className="pt-4">
                  <section className="overflow-hidden rounded-2xl border"><div className="border-b bg-muted/20 px-4 py-3"><h3 className="font-semibold">Current class roster</h3><p className="mt-1 text-xs text-muted-foreground">Each student record owns one current class assignment.</p></div><div className="divide-y">{students.length ? students.map((student) => <button key={String(student.id)} type="button" className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/30" onClick={() => openRecord("student", { key: "student", value: String(student.id) })}><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-xs font-bold">{initials(String(student.full_name ?? "Student"))}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{String(student.full_name)}</strong><span className="text-xs text-muted-foreground">{String(student.id)}</span></span><StatusBadge tone={student.status === "active" ? "emerald" : "neutral"}>{String(student.status)}</StatusBadge></button>) : <p className="p-5 text-sm text-muted-foreground">No students are assigned to this class.</p>}</div></section>
                </TabsContent>

                <TabsContent value="exams" className="pt-4">
                  <section className="overflow-hidden rounded-2xl border"><div className="border-b bg-muted/20 px-4 py-3"><h3 className="font-semibold">Class-matched examinations</h3><p className="mt-1 text-xs text-muted-foreground">The production schema does not store a direct exam class ID. Matches are derived from this class level + pathway against each exam audience.</p></div><div className="divide-y">{sessions.length ? sessions.map((session) => {
                    const sessionAttempts = submitted.filter((attempt) => attempt.session_id === session.id);
                    return <button key={String(session.id)} type="button" className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/30" onClick={() => openRecord("exam", { key: "exam", value: String(session.id) })}><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><BookOpenCheck /></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{String(session.title)}</strong><span className="mt-1 block text-xs text-muted-foreground">{String(session.mode)} · {sessionAttempts.length} submitted attempt{sessionAttempts.length === 1 ? "" : "s"}{sessionAttempts.length ? ` · avg ${average(sessionAttempts.map((attempt) => numberValue(attempt.score)))}%` : ""}</span></span><StatusBadge tone={session.status === "open" ? "emerald" : session.status === "draft" ? "amber" : "neutral"}>{String(session.status)}</StatusBadge></button>;
                  }) : <p className="p-5 text-sm text-muted-foreground">No examination audience currently matches this class.</p>}</div></section>
                </TabsContent>

                <TabsContent value="communication" className="pt-4">
                  <section className="rounded-2xl border p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">One group per class</p><h3 className="mt-1 font-semibold">Parent / student WhatsApp mapping</h3><p className="mt-1 text-xs text-muted-foreground">Communication is owned by this class record rather than an orphan global group.</p></div>{whatsapp ? <StatusBadge tone="emerald">Connected</StatusBadge> : <StatusBadge tone="neutral">Not configured</StatusBadge>}</div>{whatsapp ? <div className="mt-5 flex flex-col gap-3 rounded-xl bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between"><div><strong className="text-sm">{String(whatsapp.name)}</strong><span className="mt-1 block text-xs text-muted-foreground">Updated {formatDate(whatsapp.updated_at)}</span></div><div className="flex flex-wrap gap-2"><Button variant="outline" render={<a href={String(whatsapp.invite_url)} target="_blank" rel="noopener noreferrer" />}><ExternalLink data-icon="inline-start" />Open invite</Button>{isAdmin ? <Button variant="outline" onClick={() => { const next = new URLSearchParams(window.location.search); for (const key of RECORD_KEYS) next.delete(key); next.set("modal", "whatsapp-edit"); next.set("class", classId); next.set("group", String(whatsapp.id)); router.push(`${window.location.pathname}?${next.toString()}`); }}>Edit mapping</Button> : null}</div></div> : isAdmin ? <Button className="mt-5" onClick={() => openRecord("whatsapp-new", { key: "class", value: classId })}>Connect class WhatsApp</Button> : <p className="mt-5 text-sm text-muted-foreground">No group is configured for this class.</p>}</section>
                </TabsContent>
              </Tabs>

              {isAdmin ? <section className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-destructive">Structure control</p><h3 className="mt-1 font-semibold">Delete class</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Festacol will reject deletion while any students remain assigned. Move the roster first; the WhatsApp mapping may then cascade with the class.</p></div><AlertDialog><AlertDialogTrigger render={<Button variant="destructive" disabled={pending} />}>Delete class</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {String(classRow.name)}?</AlertDialogTitle><AlertDialogDescription>This succeeds only when the class roster is empty. Assigned students must be moved to another class first.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={pending} onClick={removeClass}>Delete class</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div></section> : null}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
