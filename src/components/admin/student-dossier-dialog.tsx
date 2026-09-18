"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  History,
  IdCard,
  LineChart as LineChartIcon,
  Pencil,
  Phone,
  School,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { getStudentDossierAction } from "@/app/actions/student-dossier";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AcademicTrack, ExamAttemptContextSnapshot } from "@/types/db";

type StudentRecord = Awaited<ReturnType<typeof getStudentDossierAction>>;
type GenericRow = Record<string, unknown>;
type DossierView = "overview" | "exams" | "performance" | "integrity" | "journey";

const RECORD_KEYS = ["modal", "exam", "student", "staff", "class", "question", "attempt", "group", "step", "view"] as const;
const VALID_VIEWS = new Set<DossierView>(["overview", "exams", "performance", "integrity", "journey"]);

const scoreChartConfig = {
  score: { label: "Score", color: "var(--foreground)" },
  integrity: { label: "Integrity", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

const subjectChartConfig = {
  score: { label: "Subject average", color: "var(--foreground)" },
} satisfies ChartConfig;

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function formatDate(value: unknown, withTime = false) {
  if (!value) return "—";
  const numeric = typeof value === "number" ? value : Number(value);
  const date = typeof value === "string" && Number.isNaN(numeric) ? new Date(value) : new Date(numeric);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-NG", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(date);
}

function initials(name: string) {
  return name.split(/\s+/u).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "ST";
}

function readable(value: unknown, fallback = "Not recorded") {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  return text.replaceAll("_", " ").replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function attemptContext(row: GenericRow): ExamAttemptContextSnapshot {
  const value = row.context_snapshot;
  return value && typeof value === "object" ? value as ExamAttemptContextSnapshot : {};
}

function trackLabel(value: unknown) {
  const track = value as AcademicTrack | null;
  if (track === "science") return "Science";
  if (track === "humanities") return "Humanities";
  if (track === "business") return "Business";
  return readable(value, "Pending");
}

function placementRecommendation(attempt: GenericRow | undefined) {
  if (!attempt) return "Pending";
  return attempt.assigned_track === "science"
    ? "Science qualified"
    : "Art / Commercial choice";
}

function placementScorePercent(value: unknown) {
  return Math.round(numberValue(value));
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

function Fact({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0 px-4 py-3 first:pl-0 last:pr-0">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-lg font-semibold tabular-nums">{value}</dd>
      {detail ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function EmptyChart({ children }: { children: string }) {
  return <div className="grid h-56 place-items-center text-center text-sm text-muted-foreground">{children}</div>;
}

function DossierLoading() {
  return (
    <div className="grid gap-6 p-5 sm:p-7">
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-16 rounded-lg" />)}</div>
      <Skeleton className="h-10 rounded-lg" />
      <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-72 rounded-xl" /><Skeleton className="h-72 rounded-xl" /></div>
    </div>
  );
}

export function StudentDossierDialog({ userId, onClose }: { userId: string; onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const openRecord = useRecordNavigation();
  const reduceMotion = useReducedMotion();
  const [record, setRecord] = useState<StudentRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const urlView = params.get("view");
  const initialView: DossierView = VALID_VIEWS.has(urlView as DossierView) ? urlView as DossierView : "overview";
  const [view, setView] = useState<DossierView>(initialView);

  useEffect(() => {
    setRecord(null);
    setError(null);
    void getStudentDossierAction(userId).then(setRecord).catch(() => setError("Student academic record could not be loaded."));
  }, [userId]);

  useEffect(() => {
    setView(VALID_VIEWS.has(urlView as DossierView) ? urlView as DossierView : "overview");
  }, [urlView]);

  function changeView(nextView: string) {
    const normalized = VALID_VIEWS.has(nextView as DossierView) ? nextView as DossierView : "overview";
    setView(normalized);
    const next = new URLSearchParams(params.toString());
    next.set("view", normalized);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const user = record?.user as GenericRow | null | undefined;
  const classRow = record?.classRow as GenericRow | null | undefined;
  const attempts = useMemo(() => (record?.attempts ?? []) as GenericRow[], [record]);
  const stats = useMemo(() => (record?.stats ?? []) as GenericRow[], [record]);
  const events = useMemo(() => (record?.events ?? []) as GenericRow[], [record]);
  const enrollmentHistory = useMemo(() => record?.enrollmentHistory ?? [], [record]);
  const submitted = useMemo(() => attempts.filter((attempt) => Boolean(attempt.submitted_at)), [attempts]);
  const live = useMemo(() => attempts.filter((attempt) => !attempt.submitted_at), [attempts]);
  const averageScore = average(submitted.map((attempt) => numberValue(attempt.score)));
  const averageIntegrity = average(submitted.map((attempt) => numberValue(attempt.integrity_score, 100)));
  const latestPlacement = attempts.find(
    (attempt) =>
      Boolean(attempt.submitted_at) &&
      attemptContext(attempt).mode === "qualifier",
  );

  const attemptById = useMemo(() => new Map(attempts.map((attempt) => [String(attempt.id), attempt])), [attempts]);
  const subjectSummary = useMemo(() => {
    const buckets = new Map<string, { name: string; values: number[] }>();
    for (const row of stats) {
      const subjectId = String(row.subject_id ?? "subject");
      const bucket = buckets.get(subjectId) ?? { name: String(row.subject_name ?? "Subject"), values: [] };
      bucket.values.push(numberValue(row.percent));
      buckets.set(subjectId, bucket);
    }
    return [...buckets.entries()]
      .map(([id, bucket]) => ({ id, name: bucket.name, score: average(bucket.values) }))
      .sort((a, b) => b.score - a.score);
  }, [stats]);

  const scoreTrend = useMemo(() => submitted
    .slice()
    .sort((a, b) => numberValue(a.submitted_at ?? a.started_at) - numberValue(b.submitted_at ?? b.started_at))
    .map((attempt, index) => {
      const context = attemptContext(attempt);
      return {
        index: index + 1,
        label: context.sessionTitle || `Exam ${index + 1}`,
        date: formatDate(attempt.submitted_at ?? attempt.started_at),
        score: numberValue(attempt.score),
        integrity: numberValue(attempt.integrity_score, 100),
      };
    }), [submitted]);

  const journey = useMemo(() => {
    const items: { id: string; kind: "placement" | "class"; title: string; detail: string; date: string; current?: boolean }[] = [];
    if (latestPlacement) {
      items.push({
        id: `placement-${String(latestPlacement.id)}`,
        kind: "placement",
        title: `${placementRecommendation(latestPlacement)}`,
        detail: `${Math.round(numberValue(latestPlacement.score))}% placement score`,
        date: formatDate(latestPlacement.submitted_at ?? latestPlacement.created_at),
      });
    }
    for (const enrollment of enrollmentHistory) {
      items.push({
        id: enrollment.id,
        kind: "class",
        title: enrollment.className,
        detail: [enrollment.academicYear, enrollment.trackName, readable(enrollment.status)].filter(Boolean).join(" · "),
        date: enrollment.endedAt ? `${formatDate(enrollment.enrolledAt)} – ${formatDate(enrollment.endedAt)}` : `Since ${formatDate(enrollment.enrolledAt)}`,
        current: enrollment.status === "active" && !enrollment.endedAt,
      });
    }
    return items;
  }, [enrollmentHistory, latestPlacement]);

  const userName = String(user?.full_name ?? "Student record");
  const studentNumber = String(user?.student_number ?? userId);
  const currentClass = String(classRow?.display_name ?? "Unassigned");
  const currentTrack = String(classRow?.track_name ?? "No pathway");

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[94dvh] gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,88rem)]">
        <DialogHeader className="border-b bg-foreground px-5 py-5 text-background sm:px-7 sm:py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <Avatar className="size-16 border border-background/20" aria-label={`${userName} profile placeholder`}>
                <AvatarFallback className="bg-background/10 text-lg font-bold text-background">{initials(userName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <DialogDescription className="flex flex-wrap items-center gap-2 text-background/65">
                  <span>Student dossier</span><span aria-hidden="true">·</span><span className="font-mono">{studentNumber}</span>
                </DialogDescription>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <DialogTitle className="truncate text-2xl font-bold tracking-tight text-background sm:text-3xl">{userName}</DialogTitle>
                  {user ? <StatusBadge tone={user.status === "active" ? "emerald" : "neutral"}>{String(user.status)}</StatusBadge> : null}
                </div>
                <p className="mt-1 text-sm text-background/65">{currentClass} · {currentTrack}</p>
              </div>
            </div>
            {user ? (
              <div className="flex flex-wrap gap-2 pr-8">
                <Button variant="outline" className="border-background/25 bg-transparent text-background hover:bg-background/10 hover:text-background" onClick={() => openRecord("user-edit", { key: "student", value: userId })}>
                  <Pencil data-icon="inline-start" />Edit student
                </Button>
                {classRow?.id ? <Button variant="outline" className="border-background/25 bg-transparent text-background hover:bg-background/10 hover:text-background" onClick={() => openRecord("class", { key: "class", value: String(classRow.id) })}><School data-icon="inline-start" />Open class</Button> : null}
              </div>
            ) : null}
          </div>
        </DialogHeader>

        {error ? <div className="p-5 sm:p-7"><Alert variant="destructive"><Activity /><AlertTitle>Student record unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert></div> : null}
        {!record && !error ? <DossierLoading /> : null}
        {record && !user ? <div className="p-5 sm:p-7"><Alert><UserRound /><AlertTitle>Student not found</AlertTitle><AlertDescription>The selected student record is no longer available.</AlertDescription></Alert></div> : null}

        {record && user ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <dl className="grid divide-y border-b px-5 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-7 xl:grid-cols-6">
              <Fact label="Current class" value={currentClass} detail={currentTrack} />
              <Fact label="Average score" value={submitted.length ? `${averageScore}%` : "—"} detail={`${submitted.length} submitted`} />
              <Fact label="Integrity" value={submitted.length ? `${averageIntegrity}%` : "—"} detail={`${events.length} recorded events`} />
              <Fact label="Attempts" value={String(attempts.length)} detail={live.length ? `${live.length} in progress` : "No live attempt"} />
              <Fact label="Placement" value={placementRecommendation(latestPlacement)} detail={latestPlacement ? `${Math.round(numberValue(latestPlacement.score))}% placement score` : "No qualifier outcome"} />
              <Fact label="Promotion" value={readable(user.promotion_status, "Not recorded")} detail="Current academic status" />
            </dl>

            <div className="grid min-h-0 lg:grid-cols-[240px_minmax(0,1fr)]">
              <aside className="border-b bg-muted/15 p-5 lg:border-r lg:border-b-0 sm:p-6">
                <div className="grid gap-5 lg:sticky lg:top-0">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Identity & contact</p>
                    <dl className="mt-3 grid gap-3 text-sm">
                      <div className="flex gap-3"><IdCard className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span><dt className="text-xs text-muted-foreground">Student ID</dt><dd className="font-mono text-xs">{studentNumber}</dd></span></div>
                      <div className="flex gap-3"><UserRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span><dt className="text-xs text-muted-foreground">Guardian</dt><dd>{String(user.guardian || "Not recorded")}</dd></span></div>
                      <div className="flex gap-3"><Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span><dt className="text-xs text-muted-foreground">Phone</dt><dd>{String(user.phone || "Not recorded")}</dd></span></div>
                    </dl>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Academic path</p>
                    <div className="mt-3 grid gap-2 text-sm">
                      <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">History</span><strong>{enrollmentHistory.length} enrolment{enrollmentHistory.length === 1 ? "" : "s"}</strong></div>
                      <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Current</span><strong className="truncate">{currentClass}</strong></div>
                      <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Placement</span><strong>{placementRecommendation(latestPlacement)}</strong></div>
                    </div>
                  </div>
                </div>
              </aside>

              <main className="min-w-0 p-5 sm:p-7">
                <Tabs value={view} onValueChange={changeView}>
                  <TabsList variant="line" className="mb-6 max-w-full justify-start overflow-x-auto">
                    <TabsTrigger value="overview"><LineChartIcon data-icon="inline-start" />Overview</TabsTrigger>
                    <TabsTrigger value="exams"><BookOpenCheck data-icon="inline-start" />Exams</TabsTrigger>
                    <TabsTrigger value="performance"><GraduationCap data-icon="inline-start" />Performance</TabsTrigger>
                    <TabsTrigger value="integrity"><ShieldCheck data-icon="inline-start" />Integrity</TabsTrigger>
                    <TabsTrigger value="journey"><History data-icon="inline-start" />Journey</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="mt-0">
                    <div className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
                      <section className="min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Performance trajectory</p><h3 className="mt-1 text-lg font-semibold">Score and integrity trend</h3></div>
                          <StatusBadge tone={averageScore >= 70 ? "emerald" : averageScore >= 50 ? "blue" : "amber"}>{submitted.length ? `${averageScore}% avg` : "No results"}</StatusBadge>
                        </div>
                        <div className="mt-5 border-y py-4">
                          {scoreTrend.length ? (
                            <ChartContainer config={scoreChartConfig} className="h-64 w-full aspect-auto">
                              <LineChart data={scoreTrend} margin={{ left: 0, right: 12, top: 12, bottom: 0 }} accessibilityLayer>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="index" tickLine={false} axisLine={false} tickMargin={8} />
                                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={30} />
                                <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? "Exam"} />} />
                                <Line type="monotone" dataKey="score" stroke="var(--color-score)" strokeWidth={2} dot={{ r: 3 }} />
                                <Line type="monotone" dataKey="integrity" stroke="var(--color-integrity)" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                              </LineChart>
                            </ChartContainer>
                          ) : <EmptyChart children="No submitted examinations yet. The score trajectory will appear after the first graded attempt." />}
                        </div>
                        {scoreTrend.length ? <p className="mt-2 text-xs text-muted-foreground">Exams are ordered chronologically. Hover the chart for the exact examination context.</p> : null}
                      </section>

                      <section>
                        <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Academic journey</p><h3 className="mt-1 text-lg font-semibold">Placement to current class</h3></div><Button size="sm" variant="ghost" onClick={() => changeView("journey")}>Full history<ArrowUpRight data-icon="inline-end" /></Button></div>
                        <div className="mt-5">
                          {journey.length ? journey.slice(-5).map((item, index, visible) => (
                            <motion.div
                              key={item.id}
                              initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.2, delay: reduceMotion ? 0 : index * 0.05 }}
                              className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-3 pb-5 last:pb-0"
                            >
                              {index < visible.length - 1 ? <span className="absolute top-7 bottom-0 left-[13px] w-px bg-border" aria-hidden="true" /> : null}
                              <span className="relative z-10 grid size-7 place-items-center rounded-full border bg-background">{item.kind === "placement" ? <GraduationCap className="size-3.5" /> : item.current ? <CheckCircle2 className="size-3.5" /> : <School className="size-3.5" />}</span>
                              <div className="min-w-0 pt-0.5"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{item.title}</strong>{item.current ? <StatusBadge tone="emerald">Current</StatusBadge> : null}</div><p className="mt-1 text-xs text-muted-foreground">{item.detail}</p><p className="mt-1 text-[11px] text-muted-foreground">{item.date}</p></div>
                            </motion.div>
                          )) : <p className="text-sm text-muted-foreground">No placement or class-enrolment history is available yet.</p>}
                        </div>
                      </section>
                    </div>

                    <Separator className="my-8" />

                    <section>
                      <div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Recent examination history</p><h3 className="mt-1 text-lg font-semibold">Latest submitted attempts</h3></div><Button size="sm" variant="ghost" onClick={() => changeView("exams")}>All exams<ArrowUpRight data-icon="inline-end" /></Button></div>
                      <div className="mt-4 divide-y border-y">
                        {submitted.slice(0, 4).map((attempt) => {
                          const context = attemptContext(attempt);
                          return <button key={String(attempt.id)} type="button" className="flex w-full items-center gap-4 py-3 text-left transition hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => openRecord("attempt", { key: "attempt", value: String(attempt.id) })}><span className="grid size-9 shrink-0 place-items-center rounded-full border"><BookOpenCheck className="size-4" /></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{context.sessionTitle || String(attempt.session_id ?? "Examination")}</strong><span className="mt-1 block text-xs text-muted-foreground">Attempt {numberValue(attempt.attempt_number, 1)} · {formatDate(attempt.submitted_at)}</span></span><strong className="tabular-nums">{numberValue(attempt.score)}%</strong><ArrowUpRight className="size-4 text-muted-foreground" /></button>;
                        })}
                        {!submitted.length ? <p className="py-6 text-sm text-muted-foreground">No submitted examination attempts.</p> : null}
                      </div>
                    </section>
                  </TabsContent>

                  <TabsContent value="exams" className="mt-0">
                    <div className="mb-4"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Durable attempt history</p><h3 className="mt-1 text-lg font-semibold">Every examination attempt</h3><p className="mt-1 text-sm text-muted-foreground">Each row deep-links to the exact attempt UUID, its responses and its integrity trail.</p></div>
                    <div className="overflow-hidden rounded-xl border">
                      <Table>
                        <TableHeader><TableRow><TableHead>Examination</TableHead><TableHead>Attempt</TableHead><TableHead>Score</TableHead><TableHead>Integrity</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Record</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {attempts.map((attempt) => {
                            const context = attemptContext(attempt);
                            const attemptId = String(attempt.id);
                            return <TableRow key={attemptId}><TableCell><strong className="block max-w-72 truncate">{context.sessionTitle || String(attempt.session_id ?? "Examination")}</strong><span className="mt-1 block text-xs text-muted-foreground">{formatDate(attempt.submitted_at ?? attempt.started_at, true)}</span></TableCell><TableCell><span className="font-mono text-xs">#{numberValue(attempt.attempt_number, 1)}</span></TableCell><TableCell className="font-semibold tabular-nums">{attempt.submitted_at ? `${numberValue(attempt.score)}%` : "—"}</TableCell><TableCell><StatusBadge tone={numberValue(attempt.integrity_score, 100) >= 80 ? "emerald" : "amber"}>{numberValue(attempt.integrity_score, 100)}%</StatusBadge></TableCell><TableCell><StatusBadge tone={attempt.submitted_at ? "emerald" : "amber"}>{attempt.submitted_at ? "Submitted" : "In progress"}</StatusBadge></TableCell><TableCell><div className="flex justify-end gap-1"><Button size="sm" variant="outline" onClick={() => openRecord("attempt", { key: "attempt", value: attemptId })}>Attempt<ArrowUpRight data-icon="inline-end" /></Button>{attempt.session_id ? <Button size="icon" variant="ghost" onClick={() => openRecord("exam", { key: "exam", value: String(attempt.session_id) })} aria-label="Open source examination"><ExternalLink /></Button> : null}</div></TableCell></TableRow>;
                          })}
                        </TableBody>
                      </Table>
                      {!attempts.length ? <p className="p-6 text-sm text-muted-foreground">No examination attempts are linked to this student.</p> : null}
                    </div>
                  </TabsContent>

                  <TabsContent value="performance" className="mt-0">
                    <div className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,.85fr)]">
                      <section><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Subject analytics</p><h3 className="mt-1 text-lg font-semibold">Performance by subject</h3><div className="mt-5 border-y py-4">{subjectSummary.length ? <ChartContainer config={subjectChartConfig} className="h-[320px] w-full aspect-auto"><BarChart data={subjectSummary.slice(0, 10)} layout="vertical" margin={{ left: 12, right: 16 }} accessibilityLayer><CartesianGrid horizontal={false} /><XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} /><YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={110} tick={{ fontSize: 11 }} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="score" fill="var(--color-score)" radius={4} /></BarChart></ChartContainer> : <EmptyChart children="No graded subject responses are available yet." />}</div></section>
                      <section><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Academic profile</p><h3 className="mt-1 text-lg font-semibold">Subject ranking</h3><div className="mt-5 divide-y border-y">{subjectSummary.map((subject, index) => <div key={subject.id} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 py-3"><span className="text-xs font-semibold text-muted-foreground">{index + 1}</span><span className="min-w-0"><strong className="block truncate text-sm">{subject.name}</strong><Progress className="mt-2" value={subject.score} /></span><strong className="text-sm tabular-nums">{subject.score}%</strong></div>)}{!subjectSummary.length ? <p className="py-6 text-sm text-muted-foreground">No subject-level performance history.</p> : null}</div></section>
                    </div>
                  </TabsContent>

                  <TabsContent value="integrity" className="mt-0">
                    <div className="mb-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Exam integrity</p><h3 className="mt-1 text-lg font-semibold">Exact event chronology</h3><p className="mt-1 text-sm text-muted-foreground">Every exception links to the durable attempt where it occurred.</p></div><div className="flex gap-2"><StatusBadge tone={averageIntegrity >= 80 ? "emerald" : "amber"}>{submitted.length ? `${averageIntegrity}% average integrity` : "No submitted exams"}</StatusBadge><StatusBadge tone={events.length ? "amber" : "emerald"}>{events.length} event{events.length === 1 ? "" : "s"}</StatusBadge></div></div>
                    <div className="divide-y border-y">
                      {events.map((event, index) => {
                        const attempt = attemptById.get(String(event.attempt_id));
                        const context = attempt ? attemptContext(attempt) : {};
                        return <motion.button key={`${String(event.at)}-${index}`} type="button" initial={reduceMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: reduceMotion ? 0 : Math.min(index * 0.03, 0.24) }} className="grid w-full grid-cols-[36px_minmax(0,1fr)_auto] items-start gap-3 py-4 text-left transition hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => openRecord("attempt", { key: "attempt", value: String(event.attempt_id) })}><span className="grid size-9 place-items-center rounded-full border"><ShieldCheck className="size-4" /></span><span className="min-w-0"><strong className="block text-sm">{readable(event.type, "Integrity event")}</strong><span className="mt-1 block text-xs text-muted-foreground">{String(event.detail ?? "Integrity event")}</span><span className="mt-1 block text-[11px] text-muted-foreground">{context.sessionTitle || String(attempt?.session_id ?? "Examination")} · {formatDate(event.at, true)}</span></span><Button size="icon" variant="ghost" aria-label="Open exact attempt"><ArrowUpRight /></Button></motion.button>;
                      })}
                      {!events.length ? <div className="flex items-center gap-3 py-6"><span className="grid size-9 place-items-center rounded-full border"><CheckCircle2 className="size-4" /></span><div><strong className="block text-sm">No integrity exceptions recorded</strong><p className="mt-1 text-xs text-muted-foreground">Submitted attempts currently have no linked integrity events.</p></div></div> : null}
                    </div>
                  </TabsContent>

                  <TabsContent value="journey" className="mt-0">
                    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
                      <section><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Placement & enrolment history</p><h3 className="mt-1 text-lg font-semibold">Academic journey</h3><p className="mt-1 text-sm text-muted-foreground">This path is reconstructed from the placement result and existing class-enrolment history. No new schema fields are required.</p><div className="mt-6">{journey.length ? journey.map((item, index) => <motion.div key={item.id} initial={reduceMotion ? false : { opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22, delay: reduceMotion ? 0 : Math.min(index * 0.06, 0.36) }} className="relative grid grid-cols-[42px_minmax(0,1fr)] gap-4 pb-7 last:pb-0">{index < journey.length - 1 ? <span className="absolute top-10 bottom-0 left-5 w-px bg-border" aria-hidden="true" /> : null}<span className="relative z-10 grid size-10 place-items-center rounded-full border bg-background">{item.kind === "placement" ? <GraduationCap className="size-4" /> : item.current ? <CheckCircle2 className="size-4" /> : <School className="size-4" />}</span><div className="pt-1"><div className="flex flex-wrap items-center gap-2"><strong>{item.title}</strong>{item.current ? <StatusBadge tone="emerald">Current class</StatusBadge> : null}</div><p className="mt-1 text-sm text-muted-foreground">{item.detail}</p><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="size-3.5" />{item.date}</p></div></motion.div>) : <p className="text-sm text-muted-foreground">No academic journey events are available yet.</p>}</div></section>
                      <aside className="border-l pl-6"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Current context</p><dl className="mt-4 grid gap-4"><div><dt className="text-xs text-muted-foreground">Class</dt><dd className="mt-1 font-semibold">{currentClass}</dd></div><div><dt className="text-xs text-muted-foreground">Pathway</dt><dd className="mt-1 font-semibold">{currentTrack}</dd></div><div><dt className="text-xs text-muted-foreground">Promotion</dt><dd className="mt-1 font-semibold">{readable(user.promotion_status)}</dd></div><div><dt className="text-xs text-muted-foreground">Latest placement</dt><dd className="mt-1 font-semibold">{placementRecommendation(latestPlacement)}</dd></div></dl>{classRow?.id ? <Button className="mt-6 w-full" variant="outline" onClick={() => openRecord("class", { key: "class", value: String(classRow.id) })}>Open current class<ArrowUpRight data-icon="inline-end" /></Button> : null}</aside>
                    </div>
                  </TabsContent>
                </Tabs>
              </main>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
