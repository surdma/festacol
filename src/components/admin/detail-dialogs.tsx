"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Copy, ExternalLink, Pencil, Users } from "lucide-react";
import {
  authorizeRewriteAction,
  deleteClassAction,
  deleteExamAction,
  deleteQuestionAction,
  deleteWhatsappAction,
  duplicateExamAction,
  getAttemptDetailAction,
  getQuestionDetailAction,
  getStaffListAction,
  getUserDetailAction,
  isAdminAction,
  resetUnfinishedAttemptAction,
  setExamStatusAction,
  toggleUserAction,
  updateCohostsAction,
} from "@/app/actions/admin";
import {
  getAdminFormOptionsAction,
  getClassDetailAction,
  getExamEditorDetailAction,
  updateExamParityAction,
} from "@/app/actions/admin-parity";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getExamLink } from "@/lib/exam-links";
import type { ExamSessionDTO, ExamStatus } from "@/types/exam";

function useModalRoute() {
  const router = useRouter();
  const pathname = usePathname();
  return (params: Record<string, string>) => {
    const search = new URLSearchParams(params);
    router.push(`${pathname}?${search.toString()}`);
  };
}

function sessionToDto(session: Record<string, unknown>): ExamSessionDTO {
  return {
    id: String(session.id),
    title: String(session.title),
    classLevel: String(session.class_level) as ExamSessionDTO["classLevel"],
    classGroup: String(session.class_group ?? "General"),
    academicSession: String(session.academic_session ?? "2026/2027"),
    term: String(session.term ?? "First term"),
    mode: String(session.mode) as ExamSessionDTO["mode"],
    subjects: (session.subjects ?? []) as string[],
    placementTracks: (session.placement_tracks ?? []) as string[],
    durationSeconds: Number(session.duration_seconds),
    questionCount: Number(session.question_count),
    status: String(session.status) as ExamStatus,
    instructions: String(session.instructions ?? ""),
    startsAt: session.starts_at ? Number(session.starts_at) : null,
    endsAt: session.ends_at ? Number(session.ends_at) : null,
    integrityPolicy: {
      focusMonitoring: session.focus_monitoring !== false,
      fullscreenPrompt: session.fullscreen_prompt !== false,
      clipboardGuard: session.clipboard_guard !== false,
      warnAfter: Number(session.warn_after ?? 2),
    },
    randomization: {
      questionOrder: session.question_order !== false,
      optionOrder: session.option_order !== false,
      minimizePaperCollisions: session.minimize_collisions !== false,
    },
  };
}

export function ExamDetailDialog({ examId, onClose }: { examId: string; onClose: () => void }) {
  const router = useRouter();
  const openModal = useModalRoute();
  const [data, setData] = useState<{ session: Record<string, unknown> | null; attempts: Record<string, unknown>[]; cameraRequired?: boolean; structureLocked?: boolean } | null>(null);
  const [staff, setStaff] = useState<{ id: string; full_name: string; subjects: string[] }[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setError(null);
    void getExamEditorDetailAction(examId).then((detail) => setData(detail as typeof data)).catch(() => setError("Exam details could not be loaded."));
    void isAdminAction().then((value) => { setIsAdmin(value); if (value) void getStaffListAction().then(setStaff); });
  }, [examId]);

  const session = data?.session;
  const sharePath = useMemo(() => session ? getExamLink(sessionToDto(session)) : "", [session]);

  function act(fn: () => Promise<{ ok: boolean; error?: string; id?: string }>, done?: (id?: string) => void) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) { setError(result.error ?? "Action failed."); return; }
      if (done) done(result.id); else onClose();
      router.refresh();
    });
  }

  async function copyShareLink() {
    if (!sharePath) return;
    const absolute = `${window.location.origin}${sharePath}`;
    try { await navigator.clipboard.writeText(absolute); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }
    catch { setError("The browser did not allow clipboard access. Use Open exam link instead."); }
  }

  return (
    <Dialog open onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-5xl overflow-y-auto">
        <DialogHeader><DialogTitle>{String(session?.title ?? "Exam detail")}</DialogTitle><DialogDescription className="font-mono">{examId}</DialogDescription></DialogHeader>
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        {!session ? <p className="text-sm text-muted-foreground">Loading examination…</p> : (
          <div className="flex flex-col gap-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Questions" value={String(session.question_count)} detail={data?.structureLocked ? "paper structure locked" : "editable before first attempt"} />
              <MetricCard label="Duration" value={`${Math.round(Number(session.duration_seconds) / 60)}m`} detail={`${String(session.class_level)} · ${String(session.class_group)}`} />
              <MetricCard label="Attempts" value={String(data?.attempts.length ?? 0)} detail="latest 100 candidate records" />
              <MetricCard label="Status" value={String(session.status)} detail={data?.cameraRequired ? "camera required" : "camera optional"} />
            </div>

            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Candidate access</p><p className="mt-1 font-mono text-sm font-semibold">{examId}</p><p className="mt-1 text-xs text-muted-foreground">{sharePath}</p></div>
                <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void copyShareLink()}><Copy data-icon="inline-start" />{copied ? "Copied" : "Copy exam link"}</Button><Button size="sm" variant="outline" render={<a href={sharePath} target="_blank" rel="noreferrer" />}><ExternalLink data-icon="inline-start" />Open exam link</Button></div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => openModal({ modal: "exam-edit", exam: examId })}><Pencil data-icon="inline-start" />Edit</Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => act(() => setExamStatusAction(examId, session.status === "open" ? "closed" : "open"))}>{session.status === "open" ? "Close exam" : "Open exam"}</Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => act(() => duplicateExamAction(examId), (id) => { if (id) openModal({ modal: "exam", exam: id }); })}>Duplicate</Button>
              <AlertDialog>
                <AlertDialogTrigger render={<Button size="sm" variant="destructive" />}>Delete</AlertDialogTrigger>
                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this examination?</AlertDialogTitle><AlertDialogDescription>The session is removed. Existing attempt rows are preserved for audit history by the database relation.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => act(() => deleteExamAction(examId))}>Delete exam</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
              </AlertDialog>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <div className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">Mode</span><strong className="mt-1 block capitalize">{String(session.mode)}</strong></div>
              <div className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">Subjects</span><strong className="mt-1 block">{((session.subjects ?? []) as string[]).join(", ") || "Qualifier pool"}</strong></div>
              <div className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">Integrity threshold</span><strong className="mt-1 block">{String(session.warn_after ?? 2)} events</strong></div>
              <div className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">Instructions</span><strong className="mt-1 block line-clamp-2">{String(session.instructions || "None")}</strong></div>
            </div>

            {isAdmin ? <CohostManager examId={examId} initial={(session.cohosts ?? []) as string[]} staff={staff} /> : null}

            <div className="rounded-xl border">
              <div className="border-b px-4 py-3"><h3 className="text-sm font-semibold">Candidate activity</h3></div>
              <div className="divide-y">
                {(data?.attempts ?? []).slice(0, 20).map((attempt) => (
                  <button key={String(attempt.attempt_hash)} type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50" onClick={() => openModal({ modal: "attempt", attempt: String(attempt.attempt_hash) })}>
                    <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{String(attempt.student_name)}</strong><span className="mt-1 block text-xs text-muted-foreground">{attempt.submitted_at ? "Submitted" : "In progress"}</span></span>
                    <StatusBadge tone={attempt.submitted_at ? "emerald" : "amber"}>{attempt.submitted_at ? `${String(attempt.score ?? "—")}%` : "live"}</StatusBadge>
                  </button>
                ))}
                {data && data.attempts.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No candidates have started this examination.</p> : null}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ExamEditDialog({ examId, onClose }: { examId: string; onClose: () => void }) {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [locked, setLocked] = useState(false);
  const [title, setTitle] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(3600);
  const [questionCount, setQuestionCount] = useState(50);
  const [instructions, setInstructions] = useState("");
  const [status, setStatus] = useState("draft");
  const [cameraRequired, setCameraRequired] = useState(false);
  const [warnAfter, setWarnAfter] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setError(null);
    void getExamEditorDetailAction(examId).then((detail) => {
      const session = detail.session as Record<string, unknown> | null;
      if (!session) { setError("Exam is unavailable or outside your scope."); return; }
      setTitle(String(session.title ?? "")); setDurationSeconds(Number(session.duration_seconds ?? 3600)); setQuestionCount(Number(session.question_count ?? 50)); setInstructions(String(session.instructions ?? "")); setStatus(String(session.status ?? "draft")); setCameraRequired(detail.cameraRequired); setWarnAfter(Number(session.warn_after ?? 2)); setLocked(detail.structureLocked); setLoaded(true);
    }).catch(() => setError("Exam could not be loaded."));
  }, [examId]);

  return (
    <Dialog open onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Edit examination</DialogTitle><DialogDescription>{locked ? "Candidate activity exists, so duration and question count are structurally locked." : "Paper structure remains editable until the first candidate starts."}</DialogDescription></DialogHeader>
        {loaded ? <FieldGroup>
          <Field><FieldLabel htmlFor="ee-title">Title</FieldLabel><Input id="ee-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={72} /></Field>
          <div className="grid gap-3 sm:grid-cols-2"><Field><FieldLabel htmlFor="ee-duration">Duration (seconds)</FieldLabel><Input id="ee-duration" type="number" disabled={locked} min={30} max={10800} value={durationSeconds} onChange={(event) => setDurationSeconds(Number(event.target.value))} /></Field><Field><FieldLabel htmlFor="ee-count">Questions</FieldLabel><Input id="ee-count" type="number" disabled={locked} min={5} max={150} value={questionCount} onChange={(event) => setQuestionCount(Number(event.target.value))} /></Field></div>
          <Field><FieldLabel htmlFor="ee-instructions">Instructions</FieldLabel><Textarea id="ee-instructions" value={instructions} onChange={(event) => setInstructions(event.target.value)} maxLength={140} /></Field>
          <div className="grid gap-3 sm:grid-cols-2"><Field><FieldLabel htmlFor="ee-status">Status</FieldLabel><NativeSelect id="ee-status" value={status} onChange={(event) => setStatus(event.target.value)}>{["draft", "open", "closed"].map((value) => <NativeSelectOption key={value} value={value}>{value}</NativeSelectOption>)}</NativeSelect></Field><Field><FieldLabel htmlFor="ee-warn">Integrity warning threshold</FieldLabel><Input id="ee-warn" type="number" min={1} max={10} value={warnAfter} onChange={(event) => setWarnAfter(Number(event.target.value))} /></Field></div>
          <Field><div className="flex items-center justify-between rounded-xl border p-3"><div><FieldLabel htmlFor="ee-camera">Camera monitoring</FieldLabel><p className="mt-1 text-xs text-muted-foreground">Require camera permission before the candidate enters the paper.</p></div><Switch id="ee-camera" checked={cameraRequired} onCheckedChange={setCameraRequired} /></div></Field>
        </FieldGroup> : <p className="text-sm text-muted-foreground">Loading examination…</p>}
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!loaded || pending} onClick={() => startTransition(async () => { setError(null); const result = await updateExamParityAction(examId, { title, durationSeconds, questionCount, instructions, status, cameraRequired, warnAfter }); if (!result.ok) { setError(result.error ?? "Update failed."); return; } onClose(); router.refresh(); })}>{pending ? "Saving…" : "Save changes"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CohostManager({ examId, initial, staff }: { examId: string; initial: string[]; staff: { id: string; full_name: string; subjects: string[] }[] }) {
  const [selected, setSelected] = useState<string[]>(initial);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  return <div className="rounded-xl border p-4"><p className="text-sm font-semibold">Cohost access</p><p className="mt-1 text-xs text-muted-foreground">Administrators can grant specific staff access outside their normal subject scope.</p><div className="mt-3 flex max-h-40 flex-wrap gap-2 overflow-auto">{staff.map((member) => { const active = selected.includes(member.id); return <Button key={member.id} type="button" size="sm" variant={active ? "default" : "outline"} onClick={() => { setSaved(false); setSelected(active ? selected.filter((id) => id !== member.id) : [...selected, member.id]); }}>{member.full_name}</Button>; })}{staff.length === 0 ? <p className="text-xs text-muted-foreground">No staff records are available.</p> : null}</div><div className="mt-3 flex items-center gap-2"><Button size="sm" disabled={pending} onClick={() => startTransition(async () => { const result = await updateCohostsAction(examId, selected); if (result.ok) setSaved(true); })}>{pending ? "Saving…" : "Save cohosts"}</Button>{saved ? <span className="text-xs text-emerald-600">Saved</span> : null}</div></div>;
}

export function UserDetailDialog({ userId, onClose }: { userId: string; onClose: () => void }) {
  const router = useRouter();
  const openModal = useModalRoute();
  const [data, setData] = useState<{ user: Record<string, unknown> | null; attempts: Record<string, unknown>[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => { setError(null); void getUserDetailAction(userId).then((detail) => setData(detail as typeof data)).catch(() => setError("Student details could not be loaded.")); }, [userId]);
  const user = data?.user;
  const isStudent = String(user?.role ?? "") === "student";
  return <Dialog open onOpenChange={(value) => { if (!value) onClose(); }}><DialogContent className="max-h-[calc(100dvh-2rem)] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>{String(user?.full_name ?? "User detail")}</DialogTitle><DialogDescription>{String(user?.role ?? "")} · {String(user?.status ?? "")}</DialogDescription></DialogHeader>{error ? <p className="text-sm text-destructive">{error}</p> : null}{user ? <div className="flex flex-col gap-4">
    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">Class</span><strong className="mt-1 block">{String(user.class_id || "Unassigned")}</strong></div><div className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">Guardian</span><strong className="mt-1 block">{String(user.guardian || "Not recorded")}</strong></div><div className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">Academic session</span><strong className="mt-1 block">{String(user.academic_session || "—")}</strong></div></div>
    {isStudent ? <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => openModal({ modal: "user-edit", student: userId })}><Pencil data-icon="inline-start" />Edit student</Button><Button size="sm" variant="outline" disabled={pending} onClick={() => startTransition(async () => { const result = await toggleUserAction(userId, user.status !== "active"); if (!result.ok) { setError(result.error ?? "Update failed."); return; } onClose(); router.refresh(); })}>{user.status === "active" ? "Suspend" : "Reactivate"}</Button></div> : null}
    <div className="rounded-xl border"><div className="border-b px-4 py-3"><h3 className="text-sm font-semibold">Exam history</h3></div><div className="divide-y">{(data?.attempts ?? []).map((attempt) => <button key={String(attempt.attempt_hash)} type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50" onClick={() => openModal({ modal: "attempt", attempt: String(attempt.attempt_hash) })}><span className="min-w-0"><strong className="block truncate text-sm">{String(attempt.session_title)}</strong><span className="mt-1 block text-xs text-muted-foreground">Integrity {String(attempt.integrity_score ?? "—")}%</span></span><span className="font-semibold tabular-nums">{String(attempt.score ?? "—")}%</span></button>)}{data && data.attempts.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No attempts yet.</p> : null}</div></div>
  </div> : <p className="text-sm text-muted-foreground">Loading record…</p>}</DialogContent></Dialog>;
}

export function AttemptDetailDialog({ attemptHash, onClose }: { attemptHash: string; onClose: () => void }) {
  const [attempt, setAttempt] = useState<Record<string, unknown> | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>[]>([]);
  const [stats, setStats] = useState<Record<string, unknown>[]>([]);
  const [events, setEvents] = useState<{ type: string; detail?: string; at: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => { setError(null); void getAttemptDetailAction(attemptHash).then((detail) => { setAttempt(detail.attempt as Record<string, unknown> | null); setAnswers(detail.answers as Record<string, unknown>[]); setStats(detail.stats as Record<string, unknown>[]); setEvents(detail.events as { type: string; detail?: string; at: number }[]); }).catch(() => setError("Attempt could not be loaded.")); }, [attemptHash]);
  return <Dialog open onOpenChange={(value) => { if (!value) onClose(); }}><DialogContent className="max-h-[calc(100dvh-2rem)] max-w-5xl overflow-y-auto"><DialogHeader><DialogTitle>{String(attempt?.student_name ?? "Attempt")}</DialogTitle><DialogDescription className="font-mono">{attemptHash}</DialogDescription></DialogHeader>{error ? <p className="text-sm text-destructive">{error}</p> : null}{attempt ? <div className="flex flex-col gap-4">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Score" value={`${String(attempt.score ?? "—")}%`} /><MetricCard label="Integrity" value={`${String(attempt.integrity_score ?? "—")}%`} /><MetricCard label="Answers" value={String(answers.length)} /><MetricCard label="Submission" value={attempt.submitted_at ? "Submitted" : "In progress"} /></div>
    {stats.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{stats.map((stat, index) => <div key={index} className="rounded-lg border p-3 text-sm"><strong>{String(stat.subject_code ?? stat.subject ?? "Subject")}</strong><p className="mt-1 text-xs text-muted-foreground">{String(stat.correct ?? 0)}/{String(stat.total ?? 0)} correct</p></div>)}</div> : null}
    <div className="rounded-xl border"><div className="border-b px-4 py-3"><h3 className="text-sm font-semibold">Integrity timeline</h3></div><div className="max-h-72 overflow-auto divide-y">{events.length ? events.map((event, index) => <div key={`${event.at}-${index}`} className="px-4 py-3"><div className="flex items-center justify-between gap-3"><strong className="text-sm">{event.type}</strong><span className="text-xs text-muted-foreground">{new Date(Number(event.at)).toLocaleString()}</span></div>{event.detail ? <p className="mt-1 text-xs text-muted-foreground">{event.detail}</p> : null}</div>) : <p className="p-4 text-sm text-muted-foreground">No integrity events recorded.</p>}</div></div>
    <div className="flex flex-wrap gap-2">{!attempt.submitted_at ? <Button size="sm" variant="outline" disabled={pending} onClick={() => startTransition(async () => { const result = await resetUnfinishedAttemptAction(String(attempt.session_id), String(attempt.candidate_hash)); if (!result.ok) { setError(result.error ?? "Reset failed."); return; } onClose(); })}>Reset unfinished attempt</Button> : null}{attempt.submitted_at ? <Button size="sm" variant="outline" disabled={pending} onClick={() => startTransition(async () => { const result = await authorizeRewriteAction(attemptHash); if (!result.ok) { setError(result.error ?? "Authorization failed."); return; } onClose(); })}>Authorize rewrite</Button> : null}</div>
  </div> : <p className="text-sm text-muted-foreground">Loading attempt…</p>}</DialogContent></Dialog>;
}

export function QuestionDetailDialog({ questionId, onClose }: { questionId: number; onClose: () => void }) {
  const router = useRouter();
  const openModal = useModalRoute();
  const [question, setQuestion] = useState<Record<string, unknown> | null>(null);
  const [blanks, setBlanks] = useState<{ blank_key: string; accepted: string[] }[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => { setError(null); void Promise.all([getQuestionDetailAction(questionId), getAdminFormOptionsAction()]).then(([detail, options]) => { const nextQuestion = detail.question as Record<string, unknown> | null; setQuestion(nextQuestion); setBlanks(detail.blanks as { blank_key: string; accepted: string[] }[]); setCanEdit(Boolean(nextQuestion && (options.scope.isAdmin || nextQuestion.created_by === options.scope.staffId))); }).catch(() => setError("Question could not be loaded.")); }, [questionId]);
  const options = (question?.options ?? []) as string[];
  const correct = (question?.correct_answers ?? []) as string[];
  return <Dialog open onOpenChange={(value) => { if (!value) onClose(); }}><DialogContent className="max-h-[calc(100dvh-2rem)] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Question #{questionId}</DialogTitle><DialogDescription>{String(question?.subject_name ?? question?.subject_code ?? "")} · {String(question?.qtype ?? "")}</DialogDescription></DialogHeader>{error ? <p className="text-sm text-destructive">{error}</p> : null}{question ? <div className="flex flex-col gap-4 text-sm">
    <p className="text-base leading-7">{String(question.prompt ?? "")}</p>
    {options.length ? <div className="grid gap-2">{options.map((option, index) => <div key={`${index}-${option}`} className={`rounded-lg border px-3 py-2 ${correct.includes(option) ? "border-emerald-300 bg-emerald-50" : ""}`}><span className="mr-2 font-semibold">{String.fromCharCode(65 + index)}.</span>{option}{correct.includes(option) ? <span className="ml-2 text-xs font-semibold text-emerald-700">Correct</span> : null}</div>)}</div> : null}
    {String(question.qtype) === "boolean" ? <div className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">Correct answer</span><strong className="mt-1 block capitalize">{correct[0] ?? "—"}</strong></div> : null}
    {blanks.length ? <div className="grid gap-2">{blanks.map((blank) => <div key={blank.blank_key} className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">{blank.blank_key}</span><strong className="mt-1 block">{blank.accepted.join(" / ")}</strong></div>)}</div> : null}
    <div className="grid gap-2 sm:grid-cols-3"><div className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">Difficulty</span><strong className="mt-1 block capitalize">{String(question.difficulty || "medium")}</strong></div><div className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">Levels</span><strong className="mt-1 block">{((question.levels ?? []) as string[]).join(", ")}</strong></div><div className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">Source</span><strong className="mt-1 block">{question.created_by ? "Staff authored" : "Seed bank"}</strong></div></div>
    <div className="flex flex-wrap gap-2">{canEdit ? <Button size="sm" variant="outline" onClick={() => openModal({ modal: "question-edit", question: String(questionId) })}><Pencil data-icon="inline-start" />Edit question</Button> : null}{canEdit ? <AlertDialog><AlertDialogTrigger render={<Button size="sm" variant="destructive" />}>Delete</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete question?</AlertDialogTitle><AlertDialogDescription>This removes the question from future paper generation. Existing submitted attempt answers remain as audit records.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={pending} onClick={() => startTransition(async () => { const result = await deleteQuestionAction(questionId); if (!result.ok) { setError(result.error ?? "Delete failed."); return; } onClose(); router.refresh(); })}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog> : null}</div>
  </div> : <p className="text-sm text-muted-foreground">Loading question…</p>}</DialogContent></Dialog>;
}

export function ClassDetailDialog({ classId, onClose }: { classId: string; onClose: () => void }) {
  const router = useRouter();
  const openModal = useModalRoute();
  const [data, setData] = useState<{ classRow: Record<string, unknown> | null; students: Record<string, unknown>[]; groups: Record<string, unknown>[] } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => { setError(null); void getClassDetailAction(classId).then((detail) => setData(detail as typeof data)).catch(() => setError("Class could not be loaded.")); void isAdminAction().then(setIsAdmin); }, [classId]);
  const item = data?.classRow;
  return <Dialog open onOpenChange={(value) => { if (!value) onClose(); }}><DialogContent className="max-h-[calc(100dvh-2rem)] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>{String(item?.name ?? "Class detail")}</DialogTitle><DialogDescription>{String(item?.class_level ?? "")} · {String(item?.stream ?? "")}</DialogDescription></DialogHeader>{error ? <p className="text-sm text-destructive">{error}</p> : null}{item ? <div className="flex flex-col gap-4">
    <div className="grid gap-3 sm:grid-cols-3"><MetricCard label="Students" value={String(data?.students.length ?? 0)} /><MetricCard label="Capacity" value={String(item.capacity ?? 0)} /><MetricCard label="WhatsApp groups" value={String(data?.groups.length ?? 0)} /></div>
    {isAdmin ? <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => openModal({ modal: "class-edit", class: classId })}><Pencil data-icon="inline-start" />Edit class</Button><Button size="sm" variant="outline" onClick={() => openModal({ modal: "whatsapp-new", class: classId })}>Add WhatsApp group</Button><AlertDialog><AlertDialogTrigger render={<Button size="sm" variant="destructive" />}>Delete class</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this class?</AlertDialogTitle><AlertDialogDescription>Students are unassigned by the database relation and class WhatsApp records cascade. This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={pending} onClick={() => startTransition(async () => { const result = await deleteClassAction(classId); if (!result.ok) { setError(result.error ?? "Delete failed."); return; } onClose(); router.refresh(); })}>Delete class</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div> : null}
    <div className="grid gap-4 lg:grid-cols-2"><div className="rounded-xl border"><div className="flex items-center gap-2 border-b px-4 py-3"><Users className="size-4" /><h3 className="text-sm font-semibold">Students</h3></div><div className="max-h-72 divide-y overflow-auto">{(data?.students ?? []).map((student) => <button key={String(student.id)} type="button" className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50" onClick={() => openModal({ modal: "student", student: String(student.id) })}><span className="text-sm font-medium">{String(student.full_name)}</span><StatusBadge tone={student.status === "active" ? "emerald" : "neutral"}>{String(student.status)}</StatusBadge></button>)}{data && data.students.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No students assigned.</p> : null}</div></div><div className="rounded-xl border"><div className="border-b px-4 py-3"><h3 className="text-sm font-semibold">Communication</h3></div><div className="divide-y">{(data?.groups ?? []).map((group) => <div key={String(group.id)} className="flex items-center gap-3 px-4 py-3"><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{String(group.name)}</strong><a href={String(group.invite_url)} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline">Open invite <ExternalLink className="size-3" /></a></span>{isAdmin ? <><Button size="sm" variant="outline" onClick={() => openModal({ modal: "whatsapp-edit", class: classId, group: String(group.id) })}>Edit</Button><Button size="sm" variant="ghost" disabled={pending} onClick={() => startTransition(async () => { const result = await deleteWhatsappAction(String(group.id)); if (!result.ok) { setError(result.error ?? "Delete failed."); return; } const next = await getClassDetailAction(classId); setData(next as typeof data); router.refresh(); })}>Remove</Button></> : null}</div>)}{data && data.groups.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No WhatsApp group configured.</p> : null}</div></div></div>
  </div> : <p className="text-sm text-muted-foreground">Loading class…</p>}</DialogContent></Dialog>;
}
