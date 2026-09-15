"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/status-badge";
import { MetricCard } from "@/components/metric-card";
import {
  authorizeRewriteAction, deleteExamAction, deleteQuestionAction, duplicateExamAction,
  getAttemptDetailAction, getExamDetailAction, getQuestionDetailAction, getStaffListAction, getUserDetailAction,
  isAdminAction, resetUnfinishedAttemptAction, setExamStatusAction, updateCohostsAction,
} from "@/app/actions/admin";

export function ExamDetailDialog({ examId, onClose }: { examId: string; onClose: () => void }) {
  const [data, setData] = useState<{ session: Record<string, unknown> | null; attempts: Record<string, unknown>[] } | null>(null);
  const [staff, setStaff] = useState<{ id: string; full_name: string; subjects: string[] }[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    void getExamDetailAction(examId).then((d) => setData(d as typeof data));
    void isAdminAction().then((v) => {
      setIsAdmin(v);
      if (v) void getStaffListAction().then(setStaff);
    });
  }, [examId]);
  const session = data?.session;
  function act(fn: () => Promise<{ ok: boolean; error?: string; id?: string }>, done?: (id?: string) => void) {
    startTransition(async () => {
      const r = await fn();
      if (r.ok) { if (done) done(r.id); else onClose(); }
    });
  }
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>{String(session?.title ?? "Exam detail")}</DialogTitle>
          <DialogDescription className="font-mono">{examId}</DialogDescription></DialogHeader>
        {!session ? <p className="text-sm text-muted-foreground">Loading…</p> : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <MetricCard label="Questions" value={String(session.question_count)} />
              <MetricCard label="Duration" value={`${Math.round(Number(session.duration_seconds) / 60)}m`} />
              <MetricCard label="Attempts" value={String(data?.attempts.length ?? 0)} />
              <MetricCard label="Status" value={String(session.status)} />
            </div>
            <div className="flex flex-wrap gap-2">
              {isAdmin ? (
                <>
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => act(() => setExamStatusAction(examId, session.status === "open" ? "closed" : "open"))}>
                    {session.status === "open" ? "Close" : "Open"}
                  </Button>
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => act(() => duplicateExamAction(examId))}>Duplicate</Button>
                </>
              ) : null}
              {isAdmin ? (
                <AlertDialog>
                  <AlertDialogTrigger render={<Button size="sm" variant="destructive" />}>Delete</AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Delete exam?</AlertDialogTitle>
                      <AlertDialogDescription>Attempts are preserved (audit history); the session is removed.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => act(() => deleteExamAction(examId))}>Delete</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
            </div>
            {isAdmin ? <CohostManager examId={examId} initial={(session.cohosts ?? []) as string[]} staff={staff} /> : null}
            <div className="flex flex-col gap-1 text-sm">
              {(data?.attempts ?? []).slice(0, 20).map((a) => (
                <p key={String(a.attempt_hash)} className="flex justify-between border-b py-1">
                  <span>{String(a.student_name)}</span>
                  <StatusBadge tone={a.submitted_at ? "emerald" : "amber"}>{a.submitted_at ? `${a.score}%` : "in progress"}</StatusBadge>
                </p>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CohostManager({ examId, initial, staff }: { examId: string; initial: string[]; staff: { id: string; full_name: string; subjects: string[] }[] }) {
  const [selected, setSelected] = useState<string[]>(initial);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <p className="text-sm font-medium">Cohosts <span className="font-normal text-muted-foreground">— staff who see this exam outside their subjects</span></p>
      <div className="flex max-h-40 flex-wrap gap-2 overflow-auto">
        {staff.map((s) => {
          const on = selected.includes(s.id);
          return (
            <Button key={s.id} type="button" size="sm" variant={on ? "default" : "outline"}
              onClick={() => { setSaved(false); setSelected(on ? selected.filter((x) => x !== s.id) : [...selected, s.id]); }}>
              {s.full_name}
            </Button>
          );
        })}
        {staff.length === 0 ? <p className="text-xs text-muted-foreground">No staff yet.</p> : null}
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={pending} onClick={() => startTransition(async () => {
          const r = await updateCohostsAction(examId, selected);
          if (r.ok) setSaved(true);
        })}>{pending ? "Saving…" : "Save cohosts"}</Button>
        {saved ? <span className="text-xs text-emerald-600">Saved.</span> : null}
      </div>
    </div>
  );
}

export function UserDetailDialog({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [data, setData] = useState<{ user: Record<string, unknown> | null; attempts: Record<string, unknown>[] } | null>(null);
  useEffect(() => { void getUserDetailAction(userId).then((d) => setData(d as typeof data)); }, [userId]);
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>{String(data?.user?.full_name ?? "User detail")}</DialogTitle>
          <DialogDescription>{String(data?.user?.role ?? "")} · {String(data?.user?.status ?? "")}</DialogDescription></DialogHeader>
        <div className="flex flex-col gap-1 text-sm">
          {(data?.attempts ?? []).map((a) => (
            <p key={String(a.attempt_hash)} className="flex justify-between border-b py-1">
              <span>{String(a.session_title)}</span><span className="tabular-nums">{String(a.score ?? "—")}%</span>
            </p>
          ))}
          {data && !data.attempts.length ? <p className="text-muted-foreground">No attempts yet.</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AttemptDetailDialog({ attemptHash, onClose }: { attemptHash: string; onClose: () => void }) {
  const [attempt, setAttempt] = useState<Record<string, unknown> | null>(null);
  const [events, setEvents] = useState<{ type: string; detail?: string; at: number }[]>([]);
  const [answerCount, setAnswerCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    void getAttemptDetailAction(attemptHash).then((d) => {
      setAttempt(d.attempt as Record<string, unknown> | null);
      setEvents((d.events ?? []) as { type: string; detail?: string; at: number }[]);
      setAnswerCount(((d.answers ?? []) as unknown[]).length);
    });
    void isAdminAction().then(setIsAdmin);
  }, [attemptHash]);
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>Attempt</DialogTitle><DialogDescription className="font-mono">{attemptHash}</DialogDescription></DialogHeader>
        {!attempt ? <p className="text-sm text-muted-foreground">Loading…</p> : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <MetricCard label="Score" value={`${attempt.score ?? "—"}%`} />
              <MetricCard label="Integrity" value={`${attempt.integrity_score ?? "—"}%`} />
              <MetricCard label="Answers" value={String(answerCount)} />
              <MetricCard label="Reason" value={String(attempt.submission_reason || "—")} />
            </div>
            <div className="max-h-72 overflow-auto rounded-lg border p-3 text-xs">
              {events.length === 0 ? <p className="text-muted-foreground">No integrity events recorded.</p> : null}
              {events.map((e, i) => (
                <p key={i} className="border-b py-1 font-mono">{new Date(e.at).toLocaleTimeString()} · {e.type}{e.detail ? ` · ${e.detail}` : ""}</p>
              ))}
            </div>
            <div className="flex gap-2">
              {isAdmin ? (
                <>
                  <Button size="sm" variant="outline" disabled={pending}
                    onClick={() => startTransition(async () => {
                      const r = await resetUnfinishedAttemptAction(String(attempt.session_id), String(attempt.candidate_hash));
                      if (r.ok) onClose();
                    })}>Reset unfinished</Button>
                  <Button size="sm" variant="outline" disabled={pending}
                    onClick={() => startTransition(async () => {
                      const r = await authorizeRewriteAction(attemptHash);
                      if (r.ok) onClose();
                    })}>Authorize rewrite</Button>
                </>
              ) : null}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function QuestionDetailDialog({ questionId, onClose }: { questionId: number; onClose: () => void }) {
  const [question, setQuestion] = useState<Record<string, unknown> | null>(null);
  const [blanks, setBlanks] = useState<{ blank_key: string; accepted: string[] }[]>([]);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    void getQuestionDetailAction(questionId).then((d) => {
      setQuestion(d.question as Record<string, unknown> | null);
      setBlanks(((d.blanks ?? []) as { blank_key: string; accepted: string[] }[]));
    });
  }, [questionId]);
  const options = (question?.options ?? []) as string[];
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Question #{questionId}</DialogTitle>
          <DialogDescription className="font-mono">{String(question?.qtype ?? "")} · {String(question?.subject_code ?? "")}</DialogDescription></DialogHeader>
        {!question ? <p className="text-sm text-muted-foreground">Loading…</p> : (
          <div className="flex flex-col gap-3 text-sm">
            <p>{String(question.prompt ?? "")}</p>
            {options.map((o, i) => <p key={o} className="rounded border px-3 py-2">{String.fromCharCode(65 + i)}. {o}</p>)}
            {blanks.length ? blanks.map((b) => (
              <p key={b.blank_key} className="rounded border px-3 py-2 font-mono text-xs">{b.blank_key}: {(b.accepted ?? []).join(" / ")}</p>
            )) : null}
            {question.created_by ? (
              <AlertDialog>
                <AlertDialogTrigger render={<Button size="sm" variant="destructive" />}>Delete</AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Delete question?</AlertDialogTitle></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => startTransition(async () => {
                      const r = await deleteQuestionAction(questionId);
                      if (r.ok) onClose();
                    })} disabled={pending}>Delete</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : <p className="text-xs text-muted-foreground">Bank-seeded question.</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
