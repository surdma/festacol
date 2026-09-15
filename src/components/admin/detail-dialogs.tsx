"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Copy, ExternalLink, Pencil } from "lucide-react";
import {
  authorizeRewriteAction,
  deleteExamAction,
  deleteQuestionAction,
  duplicateExamAction,
  getAttemptDetailAction,
  getStaffListAction,
  getUserDetailAction,
  isAdminAction,
  setExamStatusAction,
  toggleUserAction,
  updateCohostsAction,
} from "@/app/actions/admin";
import {
  getAdminFormOptionsAction,
  getExamEditorDetailAction,
  updateExamParityAction,
} from "@/app/actions/admin-parity";
import { getExamAccessLinkAction } from "@/app/actions/exam-access-links";
import { getExamRelationSummaryAction, type ExamRelationSummary } from "@/app/actions/exam-relations";
import { getQuestionEditorDetailAction } from "@/app/actions/question-bank";
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
import type { AcademicTrack, ExamAttemptContextSnapshot } from "@/types/db";

function useModalRoute() {
  const router = useRouter();
  const pathname = usePathname();
  return (params: Record<string, string>) => {
    const search = new URLSearchParams(params);
    router.push(`${pathname}?${search.toString()}`);
  };
}

function attemptContext(attempt: Record<string, unknown>): ExamAttemptContextSnapshot {
  const value = attempt.context_snapshot;
  return value && typeof value === "object" ? value as ExamAttemptContextSnapshot : {};
}

function trackLabel(track: AcademicTrack) {
  if (track === "science") return "Science";
  if (track === "humanities") return "Humanities";
  return "Business";
}

export function ExamDetailDialog({ examId, onClose }: { examId: string; onClose: () => void }) {
  const router = useRouter();
  const openModal = useModalRoute();
  const [data, setData] = useState<{ session: Record<string, unknown> | null; attempts: Record<string, unknown>[]; cameraRequired?: boolean; structureLocked?: boolean } | null>(null);
  const [relations, setRelations] = useState<ExamRelationSummary | null>(null);
  const [staff, setStaff] = useState<{ id: string; full_name: string; subjectIds: string[] }[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sharePath, setSharePath] = useState("");
  const [qrRevision, setQrRevision] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setError(null);
    setSharePath("");
    setQrRevision(null);
    void Promise.all([
      getExamEditorDetailAction(examId),
      getExamRelationSummaryAction(examId),
      getExamAccessLinkAction(examId),
    ]).then(([detail, relationSummary, accessLink]) => {
      setData(detail as typeof data);
      setRelations(relationSummary);
      if (accessLink.ok && accessLink.path) {
        setSharePath(accessLink.path);
        setQrRevision(accessLink.qrRevision ?? null);
      } else {
        setError(accessLink.error ?? "Candidate access link could not be prepared.");
      }
    }).catch(() => setError("Exam details could not be loaded."));
    void isAdminAction().then((value) => {
      setIsAdmin(value);
      if (value) void getStaffListAction().then(setStaff);
    });
  }, [examId]);

  const session = data?.session;
  const audience = relations?.targetLabels.join(", ") || "Explicit audience";
  const subjects = relations?.subjectNames.join(", ")
    || (relations?.placementTracks.length ? `${relations.placementTracks.map(trackLabel).join(", ")} placement pool` : "General / qualifier pool");

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
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("The browser did not allow clipboard access. Use Open exam link instead.");
    }
  }

  return (
    <Dialog open onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] sm:max-w-5xl overflow-y-auto">
        <DialogHeader><DialogTitle>{String(session?.title ?? "Exam detail")}</DialogTitle><DialogDescription className="font-mono">{examId}</DialogDescription></DialogHeader>
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        {!session ? <p className="text-sm text-muted-foreground">Loading examination…</p> : (
          <div className="flex flex-col gap-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Questions" value={String(session.question_count)} detail={data?.structureLocked ? "paper structure locked" : "editable before first attempt"} />
              <MetricCard label="Duration" value={`${Math.round(Number(session.duration_seconds) / 60)}m`} detail={audience} />
              <MetricCard label="Attempts" value={String(data?.attempts.length ?? 0)} detail="latest 100 candidate records" />
              <MetricCard label="Status" value={String(session.status)} detail={data?.cameraRequired ? "camera required" : "camera optional"} />
            </div>

            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Candidate access</p><p className="mt-1 font-mono text-sm font-semibold">{examId}</p><p className="mt-1 break-all text-xs text-muted-foreground">{sharePath || "Preparing opaque access link…"}</p>{qrRevision ? <p className="mt-1 text-[11px] text-muted-foreground">Persisted QR payload revision {qrRevision}</p> : null}</div>
                <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={!sharePath} onClick={() => void copyShareLink()}><Copy data-icon="inline-start" />{copied ? "Copied" : "Copy exam link"}</Button><Button size="sm" variant="outline" disabled={!sharePath} render={sharePath ? <a href={sharePath} target="_blank" rel="noreferrer" /> : undefined}><ExternalLink data-icon="inline-start" />Open exam link</Button></div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => openModal({ modal: "exam-edit", exam: examId })}><Pencil data-icon="inline-start" />Edit</Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => act(() => setExamStatusAction(examId, session.status === "open" ? "closed" : "open"))}>{session.status === "open" ? "Close exam" : "Open exam"}</Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => act(() => duplicateExamAction(examId), (id) => { if (id) openModal({ modal: "exam", exam: id }); })}>Duplicate</Button>
              <AlertDialog>
                <AlertDialogTrigger render={<Button size="sm" variant="destructive" />}>Delete</AlertDialogTrigger>
                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this examination?</AlertDialogTitle><AlertDialogDescription>The session can be deleted only when its relational history permits it. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => act(() => deleteExamAction(examId))}>Delete exam</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
              </AlertDialog>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <div className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">Mode</span><strong className="mt-1 block capitalize">{String(session.mode)}</strong></div>
              <div className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">Subjects</span><strong className="mt-1 block">{subjects}</strong></div>
              <div className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">Integrity threshold</span><strong className="mt-1 block">{String(session.warn_after ?? 2)} events</strong></div>
              <div className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">Instructions</span><strong className="mt-1 block line-clamp-2">{String(session.instructions || "None")}</strong></div>
            </div>

            {isAdmin ? <CohostManager examId={examId} initial={relations?.cohostIds ?? []} staff={staff} /> : null}

            <div className="rounded-xl border">
              <div className="border-b px-4 py-3"><h3 className="text-sm font-semibold">Candidate activity</h3></div>
              <div className="divide-y">
                {(data?.attempts ?? []).slice(0, 20).map((attempt) => {
                  const context = attemptContext(attempt);
                  const attemptId = String(attempt.id);
                  return (
                    <button key={attemptId} type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50" onClick={() => openModal({ modal: "attempt", attempt: attemptId })}>
                      <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{context.studentName || "Candidate"}</strong><span className="mt-1 block text-xs text-muted-foreground">{attempt.submitted_at ? "Submitted" : "In progress"} · attempt {String(attempt.attempt_number ?? 1)}</span></span>
                      <StatusBadge tone={attempt.submitted_at ? "emerald" : "amber"}>{attempt.submitted_at ? `${String(attempt.score ?? "—")}%` : "live"}</StatusBadge>
                    </button>
                  );
                })}
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
      setTitle(String(session.title ?? ""));
      setDurationSeconds(Number(session.duration_seconds ?? 3600));
      setQuestionCount(Number(session.question_count ?? 50));
      setInstructions(String(session.instructions ?? ""));
      setStatus(String(session.status ?? "draft"));
      setCameraRequired(detail.cameraRequired);
      setWarnAfter(Number(session.warn_after ?? 2));
      setLocked(detail.structureLocked);
      setLoaded(true);
    }).catch(() => setError("Exam could not be loaded."));
  }, [examId]);

  return (
    <Dialog open onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="sm:max-w-2xl">
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

function CohostManager({ examId, initial, staff }: { examId: string; initial: string[]; staff: { id: string; full_name: string; subjectIds: string[] }[] }) {
  const [selected, setSelected] = useState<string[]>(initial);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  useEffect(() => setSelected(initial), [initial]);
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
  return <Dialog open onOpenChange={(value) => { if (!value) onClose(); }}><DialogContent className="max-h-[calc(100dvh-2rem)] sm:max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>{String(user?.full_name ?? "User detail")}</DialogTitle><DialogDescription>{String(user?.role ?? "")} · {String(user?.status ?? "")}</DialogDescription></DialogHeader>{error ? <p className="text-sm text-destructive">{error}</p> : null}{user ? <div className="flex flex-col gap-4">
    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">Class</span><strong className="mt-1 block">{String(user.class_id || "Unassigned")}</strong></div><div className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">Guardian</span><strong className="mt-1 block">{String(user.guardian || "Not recorded")}</strong></div><div className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">Promotion status</span><strong className="mt-1 block">{String(user.promotion_status || "Not recorded")}</strong></div></div>
    {isStudent ? <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => openModal({ modal: "user-edit", student: userId })}><Pencil data-icon="inline-start" />Edit student</Button><Button size="sm" variant="outline" disabled={pending} onClick={() => startTransition(async () => { const result = await toggleUserAction(userId, user.status !== "active"); if (!result.ok) { setError(result.error ?? "Update failed."); return; } onClose(); router.refresh(); })}>{user.status === "active" ? "Suspend" : "Reactivate"}</Button></div> : null}
    <div className="rounded-xl border"><div className="border-b px-4 py-3"><h3 className="text-sm font-semibold">Exam history</h3></div><div className="divide-y">{(data?.attempts ?? []).map((attempt) => { const context = attemptContext(attempt); const attemptId = String(attempt.id); return <button key={attemptId} type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50" onClick={() => openModal({ modal: "attempt", attempt: attemptId })}><span className="min-w-0"><strong className="block truncate text-sm">{context.sessionTitle || String(attempt.session_id)}</strong><span className="mt-1 block text-xs text-muted-foreground">Integrity {String(attempt.integrity_score ?? "—")}%</span></span><span className="font-semibold tabular-nums">{String(attempt.score ?? "—")}%</span></button>; })}{data && data.attempts.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No attempts yet.</p> : null}</div></div>
  </div> : <p className="text-sm text-muted-foreground">Loading record…</p>}</DialogContent></Dialog>;
}

export function AttemptDetailDialog({ attemptId, onClose }: { attemptId: string; onClose: () => void }) {
  const [attempt, setAttempt] = useState<Record<string, unknown> | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>[]>([]);
  const [events, setEvents] = useState<{ type: string; detail?: string; at: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => { setError(null); void getAttemptDetailAction(attemptId).then((detail) => { setAttempt(detail.attempt as Record<string, unknown> | null); setAnswers(detail.answers as Record<string, unknown>[]); setEvents(detail.events as { type: string; detail?: string; at: number }[]); }).catch(() => setError("Attempt could not be loaded.")); }, [attemptId]);
  const context = attempt ? attemptContext(attempt) : {};
  return <Dialog open onOpenChange={(value) => { if (!value) onClose(); }}><DialogContent className="max-h-[calc(100dvh-2rem)] sm:max-w-5xl overflow-y-auto"><DialogHeader><DialogTitle>{context.studentName || "Attempt"}</DialogTitle><DialogDescription className="font-mono">{attemptId}</DialogDescription></DialogHeader>{error ? <p className="text-sm text-destructive">{error}</p> : null}{attempt ? <div className="flex flex-col gap-4">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Score" value={`${String(attempt.score ?? "—")}%`} /><MetricCard label="Integrity" value={`${String(attempt.integrity_score ?? "—")}%`} /><MetricCard label="Answers" value={String(answers.length)} /><MetricCard label="Submission" value={attempt.submitted_at ? "Submitted" : "In progress"} /></div>
    <div className="rounded-xl border p-4"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Exam</p><p className="mt-1 text-sm font-semibold">{context.sessionTitle || String(attempt.session_id)}</p><p className="mt-1 text-xs text-muted-foreground">Attempt {String(attempt.attempt_number ?? 1)}</p></div>
    <div className="rounded-xl border"><div className="border-b px-4 py-3"><h3 className="text-sm font-semibold">Integrity timeline</h3></div><div className="max-h-72 overflow-auto divide-y">{events.length ? events.map((event, index) => <div key={`${event.at}-${index}`} className="px-4 py-3"><div className="flex items-center justify-between gap-3"><strong className="text-sm">{event.type}</strong><span className="text-xs text-muted-foreground">{new Date(Number(event.at)).toLocaleString()}</span></div>{event.detail ? <p className="mt-1 text-xs text-muted-foreground">{event.detail}</p> : null}</div>) : <p className="p-4 text-sm text-muted-foreground">No integrity events recorded.</p>}</div></div>
    <div className="flex flex-wrap gap-2">{attempt.submitted_at ? <Button size="sm" variant="outline" disabled={pending} onClick={() => startTransition(async () => { const result = await authorizeRewriteAction(attemptId); if (!result.ok) { setError(result.error ?? "Retake authorization failed."); return; } onClose(); })}>Grant retake</Button> : <p className="text-xs text-muted-foreground">Active attempts are preserved; another attempt can be granted after submission when needed.</p>}</div>
  </div> : <p className="text-sm text-muted-foreground">Loading attempt…</p>}</DialogContent></Dialog>;
}

export function QuestionDetailDialog({ questionId, onClose }: { questionId: number; onClose: () => void }) {
  const router = useRouter();
  const openModal = useModalRoute();
  const [question, setQuestion] = useState<Record<string, unknown> | null>(null);
  const [subjectName, setSubjectName] = useState("");
  const [blanks, setBlanks] = useState<{ blank_key: string; accepted: string[] }[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => { setError(null); void Promise.all([getQuestionEditorDetailAction(questionId), getAdminFormOptionsAction()]).then(([detail, options]) => { const nextQuestion = detail.question as Record<string, unknown> | null; setQuestion(nextQuestion); setBlanks(detail.blanks as { blank_key: string; accepted: string[] }[]); const subjectId = String(nextQuestion?.subject_id ?? ""); setSubjectName(options.subjects.find((subject) => subject.id === subjectId)?.name ?? "Subject"); setCanEdit(Boolean(nextQuestion && (options.scope.isAdmin || nextQuestion.creator_id === options.scope.profileId))); }).catch(() => setError("Question could not be loaded.")); }, [questionId]);
  const options = (question?.options ?? []) as string[];
  const correct = (question?.correct_answers ?? []) as string[];
  return <Dialog open onOpenChange={(value) => { if (!value) onClose(); }}><DialogContent className="max-h-[calc(100dvh-2rem)] sm:max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Question #{questionId}</DialogTitle><DialogDescription>{subjectName} · {String(question?.qtype ?? "")}</DialogDescription></DialogHeader>{error ? <p className="text-sm text-destructive">{error}</p> : null}{question ? <div className="flex flex-col gap-4 text-sm">
    <p className="text-base leading-7">{String(question.prompt ?? "")}</p>
    {options.length ? <div className="grid gap-2">{options.map((option, index) => <div key={`${index}-${option}`} className={`rounded-lg border px-3 py-2 ${correct.includes(option) ? "border-emerald-300 bg-emerald-50" : ""}`}><span className="mr-2 font-semibold">{String.fromCharCode(65 + index)}.</span>{option}{correct.includes(option) ? <span className="ml-2 text-xs font-semibold text-emerald-700">Correct</span> : null}</div>)}</div> : null}
    {String(question.qtype) === "boolean" ? <div className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">Correct answer</span><strong className="mt-1 block capitalize">{correct[0] ?? "—"}</strong></div> : null}
    {blanks.length ? <div className="grid gap-2">{blanks.map((blank) => <div key={blank.blank_key} className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">{blank.blank_key}</span><strong className="mt-1 block">{blank.accepted.join(" / ")}</strong></div>)}</div> : null}
    <div className="grid gap-2 sm:grid-cols-3"><div className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">Difficulty</span><strong className="mt-1 block capitalize">{String(question.difficulty || "medium")}</strong></div><div className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">Levels</span><strong className="mt-1 block">{((question.levels ?? []) as string[]).join(", ") || "—"}</strong></div><div className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">Source</span><strong className="mt-1 block">{question.creator_id ? "Staff authored" : "Seed bank"}</strong></div></div>
    <div className="flex flex-wrap gap-2">{canEdit ? <Button size="sm" variant="outline" onClick={() => openModal({ modal: "question-edit", question: String(questionId) })}><Pencil data-icon="inline-start" />Edit question</Button> : null}{canEdit ? <AlertDialog><AlertDialogTrigger render={<Button size="sm" variant="destructive" />}>Delete</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete question?</AlertDialogTitle><AlertDialogDescription>This removes the question from future paper generation. Existing submitted attempt responses remain as audit records.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={pending} onClick={() => startTransition(async () => { const result = await deleteQuestionAction(questionId); if (!result.ok) { setError(result.error ?? "Delete failed."); return; } onClose(); router.refresh(); })}>Delete question</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog> : null}</div>
  </div> : <p className="text-sm text-muted-foreground">Loading question…</p>}</DialogContent></Dialog>;
}
