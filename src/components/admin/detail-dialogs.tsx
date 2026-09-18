"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, Copy, Download, ExternalLink, Mail, MessageCircle, Pencil, Send, Share2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
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
function formatExamDuration(seconds: number) {
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
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
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [pending, startTransition] = useTransition();
  const qrBoxRef = useRef<HTMLDivElement>(null);

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
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = sharePath ? `${origin}${sharePath}` : "";
  const examTitle = String(session?.title ?? "Exam");
  const status = String(session?.status ?? "draft");
  const submittedCount = (data?.attempts ?? []).filter((a) => a.submitted_at).length;
  const activeCount = (data?.attempts ?? []).length - submittedCount;
  const canShare = Boolean(shareUrl);
  const shareText = `${examTitle} — join here ${shareUrl} (Exam ID: ${examId})`;

  function act(fn: () => Promise<{ ok: boolean; error?: string; id?: string }>, done?: (id?: string) => void) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) { setError(result.error ?? "Action failed."); return; }
      if (done) done(result.id); else onClose();
      router.refresh();
    });
  }

  async function copyText(value: string, kind: "link" | "id") {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      if (kind === "link") {
        setCopiedLink(true);
        window.setTimeout(() => setCopiedLink(false), 1600);
      } else {
        setCopiedId(true);
        window.setTimeout(() => setCopiedId(false), 1600);
      }
    } catch {
      setError("The browser did not allow clipboard access. Use Open exam link instead.");
    }
  }

  function downloadQr() {
    const svg = qrBoxRef.current?.querySelector("svg");
    if (!svg || !shareUrl) return;
    const serialized = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 640;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const png = document.createElement("a");
      png.download = `${examId}-qr.png`;
      png.href = canvas.toDataURL("image/png");
      png.click();
    };
    image.src = url;
  }

  async function nativeShare() {
    if (!shareUrl) return;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as Navigator & { share: (input: { title: string; text: string; url: string }) => Promise<void> }).share({
          title: examTitle,
          text: `Join ${examTitle} (Exam ID: ${examId})`,
          url: shareUrl,
        });
      } catch {
        // User dismissed the sheet — no error surface needed.
      }
      return;
    }
    await copyText(shareUrl, "link");
  }

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const telegramHref = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`${examTitle} (Exam ID: ${examId})`)}`;
  const xHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${examTitle} (Exam ID: ${examId})`)}&url=${encodeURIComponent(shareUrl)}`;
  const emailHref = `mailto:?subject=${encodeURIComponent(`Exam invitation: ${examTitle}`)}&body=${encodeURIComponent(`Join here: ${shareUrl}\nExam ID: ${examId}`)}`;

  return (
    <Dialog open onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-8">
            <DialogTitle className="min-w-0">{examTitle}</DialogTitle>
            {session ? <StatusBadge tone={status === "open" ? "emerald" : status === "draft" ? "amber" : "neutral"}>{status}</StatusBadge> : null}
          </div>
          <DialogDescription>{session ? `${audience} · ${subjects}` : "Loading examination…"}</DialogDescription>
          <div className="flex min-w-0 items-center gap-2">
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{examId}</code>
            <Button type="button" size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs" onClick={() => void copyText(examId, "id")} aria-label="Copy exam ID">
              {copiedId ? <Check data-icon="inline-start" className="size-3.5" /> : <Copy data-icon="inline-start" className="size-3.5" />}{copiedId ? "Copied" : "Copy ID"}
            </Button>
          </div>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        {!session ? <p className="text-sm text-muted-foreground">Loading examination…</p> : (
          <div className="min-w-0">
            <dl className="flex divide-x divide-border border-y border-border py-3">
              {[
                ["Questions", String(session.question_count)],
                ["Duration", `${Math.round(Number(session.duration_seconds) / 60)}m`],
                ["Attempts", `${submittedCount}/${String(data?.attempts.length ?? 0)}`],
                ["Camera", data?.cameraRequired ? "Required" : "Off"],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 flex-1 px-3 first:pl-0 last:pr-0">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5 truncate text-sm font-bold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="grid gap-6 py-5 sm:grid-cols-[180px_minmax(0,1fr)]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Candidate QR</p>
                <div ref={qrBoxRef} className="mt-2 grid w-44 place-items-center rounded-lg border border-border bg-white p-3">
                  {shareUrl ? <QRCodeSVG value={shareUrl} size={152} level="M" aria-label={`QR code for ${examTitle}`} /> : <p className="py-10 text-center text-xs text-muted-foreground">Preparing QR…</p>}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Scan to open this exam.{qrRevision ? ` Rev ${qrRevision}.` : ""}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" disabled={!canShare} onClick={downloadQr}><Download data-icon="inline-start" />QR PNG</Button>
                  <Button type="button" size="sm" variant="ghost" disabled={!canShare} render={canShare ? <a href={sharePath} target="_blank" rel="noreferrer" /> : undefined}><ExternalLink data-icon="inline-start" />Open</Button>
                </div>
              </div>

              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Distribute</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{sharePath ? "Secure candidate link ready" : "Preparing secure link…"}</span>
                  <Button type="button" size="sm" variant="outline" disabled={!canShare} onClick={() => void copyText(shareUrl, "link")}>{copiedLink ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}{copiedLink ? "Copied" : "Copy link"}</Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Link stays hidden — candidates join via QR or Exam ID.</p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" variant="default" disabled={!canShare} onClick={() => void nativeShare()}><Share2 data-icon="inline-start" />Share</Button>
                  <span className="text-xs text-muted-foreground">via</span>
                  <Button type="button" size="icon-sm" variant="outline" disabled={!canShare} render={canShare ? <a href={whatsappHref} target="_blank" rel="noreferrer" /> : undefined} aria-label="Share via WhatsApp"><MessageCircle /></Button>
                  <Button type="button" size="icon-sm" variant="outline" disabled={!canShare} render={canShare ? <a href={telegramHref} target="_blank" rel="noreferrer" /> : undefined} aria-label="Share via Telegram"><Send /></Button>
                  <Button type="button" size="icon-sm" variant="outline" disabled={!canShare} render={canShare ? <a href={xHref} target="_blank" rel="noreferrer" /> : undefined} aria-label="Share via X"><span aria-hidden="true" className="text-xs font-extrabold">X</span></Button>
                  <Button type="button" size="icon-sm" variant="outline" disabled={!canShare} render={canShare ? <a href={emailHref} /> : undefined} aria-label="Share via email"><Mail /></Button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                  <Button size="sm" variant="outline" onClick={() => openModal({ modal: "exam-edit", exam: examId })}><Pencil data-icon="inline-start" />Edit</Button>
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => setExamStatusAction(examId, status === "open" ? "closed" : "open"))}>{status === "open" ? "Close exam" : "Open exam"}</Button>
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => duplicateExamAction(examId), (id) => { if (id) openModal({ modal: "exam", exam: id }); })}>Duplicate</Button>
                  <AlertDialog>
                    <AlertDialogTrigger render={<Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" />}>Delete</AlertDialogTrigger>
                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this examination?</AlertDialogTitle><AlertDialogDescription>The session can be deleted only when its relational history permits it. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => act(() => deleteExamAction(examId))}>Delete exam</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>

            <dl className="divide-y divide-border border-y border-border text-sm">
              <div className="grid gap-1 py-2.5 sm:grid-cols-[160px_minmax(0,1fr)]"><dt className="text-xs text-muted-foreground">Mode</dt><dd className="font-medium capitalize">{String(session.mode)}</dd></div>
              <div className="grid gap-1 py-2.5 sm:grid-cols-[160px_minmax(0,1fr)]"><dt className="text-xs text-muted-foreground">Integrity threshold</dt><dd className="font-medium">{String(session.warn_after ?? 2)} events</dd></div>
              <div className="grid gap-1 py-2.5 sm:grid-cols-[160px_minmax(0,1fr)]"><dt className="text-xs text-muted-foreground">Instructions</dt><dd className="font-medium">{String(session.instructions || "None")}</dd></div>
            </dl>

            {isAdmin ? (
              <details className="border-b border-border py-3">
                <summary className="cursor-pointer text-sm font-semibold">Cohost access</summary>
                <div className="pt-3"><CohostManager examId={examId} initial={relations?.cohostIds ?? []} staff={staff} /></div>
              </details>
            ) : null}

            <section className="pt-4">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-bold">Candidate activity</h3>
                <p className="text-xs text-muted-foreground">{submittedCount} submitted · {activeCount} active</p>
              </div>
              <div className="mt-1 divide-y divide-border">
                {(data?.attempts ?? []).slice(0, 20).map((attempt) => {
                  const context = attemptContext(attempt);
                  const attemptId = String(attempt.id);
                  return (
                    <button key={attemptId} type="button" className="flex w-full items-center gap-3 py-3 text-left hover:bg-muted/50" onClick={() => openModal({ modal: "attempt", attempt: attemptId })}>
                      <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{context.studentName || "Candidate"}</strong><span className="mt-0.5 block text-xs text-muted-foreground">{attempt.submitted_at ? "Submitted" : "In progress"} · attempt {String(attempt.attempt_number ?? 1)}</span></span>
                      <StatusBadge tone={attempt.submitted_at ? "emerald" : "amber"}>{attempt.submitted_at ? `${String(attempt.score ?? "—")}%` : "live"}</StatusBadge>
                    </button>
                  );
                })}
                {data && data.attempts.length === 0 ? <p className="py-5 text-sm text-muted-foreground">No candidates have started this examination.</p> : null}
              </div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ExamEditDialog({ examId, onClose }: { examId: string; onClose: () => void }) {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
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
      setStatus(String(session.status ?? "draft") === "open" ? "open" : "closed");
      setCameraRequired(detail.cameraRequired);
      setWarnAfter(Number(session.warn_after ?? 2));
      setLoaded(true);
    }).catch(() => setError("Exam could not be loaded."));
  }, [examId]);

  return (
    <Dialog open onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Edit examination</DialogTitle><DialogDescription>Duration and question-count changes apply only to candidates who start after you save. Candidates already writing keep the time and paper they started with. Closing the exam finalizes active attempts.</DialogDescription></DialogHeader>
        {loaded ? <FieldGroup>
          <Field><FieldLabel htmlFor="ee-title">Title</FieldLabel><Input id="ee-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={72} /></Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field>
              <div className="flex items-center justify-between gap-2"><FieldLabel>Duration</FieldLabel><Badge variant="secondary" className="tabular-nums">{formatExamDuration(durationSeconds)}</Badge></div>
              <Slider aria-label="Exam duration" min={30} max={14400} step={30} value={[durationSeconds]} onValueChange={(value) => setDurationSeconds(Array.isArray(value) ? (value[0] ?? 30) : value)} />
              <div className="flex justify-between text-xs text-muted-foreground"><span>30 sec</span><span>4 hrs</span></div>
              <p className="text-xs text-muted-foreground">Applies only to candidates who have not started yet.</p>
            </Field>
            <Field>
              <div className="flex items-center justify-between gap-2"><FieldLabel>Questions</FieldLabel><Badge variant="secondary" className="tabular-nums">{questionCount} questions</Badge></div>
              <Slider aria-label="Question count" min={5} max={200} step={1} value={[questionCount]} onValueChange={(value) => setQuestionCount(Array.isArray(value) ? (value[0] ?? 5) : value)} />
              <div className="flex justify-between text-xs text-muted-foreground"><span>5</span><span>200</span></div>
              <p className="text-xs text-muted-foreground">Existing attempts keep their allocated question IDs.</p>
            </Field>
          </div>
          <Field><FieldLabel htmlFor="ee-instructions">Instructions</FieldLabel><Textarea id="ee-instructions" value={instructions} onChange={(event) => setInstructions(event.target.value)} maxLength={140} /></Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel>Exam availability</FieldLabel>
              <RadioGroup aria-label="Exam availability" value={status} onValueChange={(value) => setStatus(value === "open" ? "open" : "closed")} className="grid grid-cols-2 gap-2">
                {([
                  { value: "open", title: "Open", hint: "New candidates can start" },
                  { value: "closed", title: "Closed", hint: "Finalize active attempts" },
                ] as const).map((option) => (
                  <label key={option.value} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-3 transition hover:bg-muted/40 has-data-checked:border-neutral-950 has-data-checked:bg-neutral-950 has-data-checked:text-white">
                    <RadioGroupItem value={option.value} />
                    <span className="min-w-0"><strong className="block text-sm">{option.title}</strong><span className="mt-0.5 block text-xs opacity-70">{option.hint}</span></span>
                  </label>
                ))}
              </RadioGroup>
              <p className="text-xs text-muted-foreground">Closing blocks new starts and finalizes every active attempt from server-saved responses.</p>
            </Field>
            <Field><FieldLabel htmlFor="ee-warn">Integrity warning threshold</FieldLabel><Input id="ee-warn" type="number" min={1} max={10} value={warnAfter} onChange={(event) => setWarnAfter(Number(event.target.value))} /></Field>
          </div>
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
  return <div><p className="text-xs text-muted-foreground">Administrators can grant specific staff access outside their normal subject scope.</p><div className="mt-3 flex max-h-40 flex-wrap gap-2 overflow-auto">{staff.map((member) => { const active = selected.includes(member.id); return <Button key={member.id} type="button" size="sm" variant={active ? "default" : "outline"} onClick={() => { setSaved(false); setSelected(active ? selected.filter((id) => id !== member.id) : [...selected, member.id]); }}>{member.full_name}</Button>; })}{staff.length === 0 ? <p className="text-xs text-muted-foreground">No staff records are available.</p> : null}</div><div className="mt-3 flex items-center gap-2"><Button size="sm" variant="outline" disabled={pending} onClick={() => startTransition(async () => { const result = await updateCohostsAction(examId, selected); if (result.ok) setSaved(true); })}>{pending ? "Saving…" : "Save cohosts"}</Button>{saved ? <span className="text-xs text-emerald-600">Saved</span> : null}</div></div>;
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
  return <Dialog open onOpenChange={(value) => { if (!value) onClose(); }}><DialogContent className="sm:max-w-4xl"><DialogHeader><DialogTitle>{String(user?.full_name ?? "User detail")}</DialogTitle><DialogDescription>{String(user?.role ?? "")} · {String(user?.status ?? "")}</DialogDescription></DialogHeader>{error ? <p className="text-sm text-destructive">{error}</p> : null}{user ? <div className="flex min-w-0 flex-col gap-4">
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
  return <Dialog open onOpenChange={(value) => { if (!value) onClose(); }}><DialogContent className="sm:max-w-5xl"><DialogHeader><DialogTitle>{context.studentName || "Attempt"}</DialogTitle><DialogDescription className="font-mono break-all">{attemptId}</DialogDescription></DialogHeader>{error ? <p className="text-sm text-destructive">{error}</p> : null}{attempt ? <div className="flex min-w-0 flex-col gap-4">
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Score" value={`${String(attempt.score ?? "—")}%`} /><MetricCard label="Integrity" value={`${String(attempt.integrity_score ?? "—")}%`} /><MetricCard label="Answers" value={String(answers.length)} /><MetricCard label="Submission" value={attempt.submitted_at ? "Submitted" : "In progress"} /></div>
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
  return <Dialog open onOpenChange={(value) => { if (!value) onClose(); }}><DialogContent className="sm:max-w-3xl"><DialogHeader><DialogTitle>Question #{questionId}</DialogTitle><DialogDescription>{subjectName} · {String(question?.qtype ?? "")}</DialogDescription></DialogHeader>{error ? <p className="text-sm text-destructive">{error}</p> : null}{question ? <div className="flex min-w-0 flex-col gap-4 text-sm">
    <p className="min-w-0 text-base leading-7 break-words">{String(question.prompt ?? "")}</p>
    {options.length ? <div className="grid gap-2">{options.map((option, index) => <div key={`${index}-${option}`} className={`rounded-lg border px-3 py-2 ${correct.includes(option) ? "border-emerald-300 bg-emerald-50" : ""}`}><span className="mr-2 font-semibold">{String.fromCharCode(65 + index)}.</span>{option}{correct.includes(option) ? <span className="ml-2 text-xs font-semibold text-emerald-700">Correct</span> : null}</div>)}</div> : null}
    {String(question.qtype) === "boolean" ? <div className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">Correct answer</span><strong className="mt-1 block capitalize">{correct[0] ?? "—"}</strong></div> : null}
    {blanks.length ? <div className="grid gap-2">{blanks.map((blank) => <div key={blank.blank_key} className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">{blank.blank_key}</span><strong className="mt-1 block">{blank.accepted.join(" / ")}</strong></div>)}</div> : null}
    <div className="grid gap-2 sm:grid-cols-3"><div className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">Difficulty</span><strong className="mt-1 block capitalize">{String(question.difficulty || "medium")}</strong></div><div className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">Levels</span><strong className="mt-1 block">{((question.levels ?? []) as string[]).join(", ") || "—"}</strong></div><div className="rounded-lg border p-3"><span className="text-xs text-muted-foreground">Source</span><strong className="mt-1 block">{question.creator_id ? "Staff authored" : "Seed bank"}</strong></div></div>
    <div className="flex flex-wrap gap-2">{canEdit ? <Button size="sm" variant="outline" onClick={() => openModal({ modal: "question-edit", question: String(questionId) })}><Pencil data-icon="inline-start" />Edit question</Button> : null}{canEdit ? <AlertDialog><AlertDialogTrigger render={<Button size="sm" variant="destructive" />}>Delete</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete question?</AlertDialogTitle><AlertDialogDescription>This removes the question from future paper generation. Existing submitted attempt responses remain as audit records.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={pending} onClick={() => startTransition(async () => { const result = await deleteQuestionAction(questionId); if (!result.ok) { setError(result.error ?? "Delete failed."); return; } onClose(); router.refresh(); })}>Delete question</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog> : null}</div>
  </div> : <p className="text-sm text-muted-foreground">Loading question…</p>}</DialogContent></Dialog>;
}
