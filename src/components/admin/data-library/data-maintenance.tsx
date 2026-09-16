"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpenCheck,
  CalendarX2,
  Database,
  Eye,
  ListChecks,
  LoaderCircle,
  MessageCircleOff,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import type {
  AttemptFilter,
  CleanupFilter,
  CleanupKind,
  IntegrityFilter,
  SessionFilter,
  StaffQuestionFilter,
  WhatsappFilter,
} from "@/app/actions/admin-data-controls";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSchoolDataMaintenance } from "@/hooks/use-school-data-maintenance";

type Maintenance = ReturnType<typeof useSchoolDataMaintenance>;
type Severity = "low" | "medium" | "high";

const CONFIRM_WORD = "DELETE";

function SeverityBadge({ level }: { level: Severity }) {
  if (level === "low") return <Badge variant="secondary"><ShieldCheck data-icon="inline-start" />Gentle</Badge>;
  if (level === "medium") return <Badge variant="outline"><Eye data-icon="inline-start" />Needs care</Badge>;
  return <Badge variant="destructive"><ShieldAlert data-icon="inline-start" />Full wipe</Badge>;
}

function ScopePills<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={value === option.value ? "default" : "outline"}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function useLiveEstimate(m: Maintenance, kind: CleanupKind, filter: CleanupFilter) {
  const key = m.previewKey(kind, filter);
  useEffect(() => {
    const timer = setTimeout(() => {
      void m.loadPreview(kind, filter);
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return m.previews[key] ?? null;
}

function EstimateLine({ total, note, loading }: { total?: number; note?: string; loading?: boolean }) {
  if (loading || total === undefined) {
    return (
      <p className="inline-flex items-center gap-2 text-xs tabular-nums text-muted-foreground" role="status">
        <LoaderCircle className="size-3.5 animate-spin" />Counting matching records…
      </p>
    );
  }
  return (
    <div>
      <p className="text-sm font-bold tabular-nums text-foreground">
        {total.toLocaleString()} record{total === 1 ? "" : "s"} match{total === 1 ? "es" : ""}
      </p>
      {note ? <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{note}</p> : null}
    </div>
  );
}

function CleanupConfirm({
  title,
  description,
  severity,
  actionLabel,
  running,
  onConfirm,
}: {
  title: string;
  description: string;
  severity: Severity;
  actionLabel: string;
  running: boolean;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const needsTyping = severity === "high";
  const confirmed = !needsTyping || typed.trim().toUpperCase() === CONFIRM_WORD;
  return (
    <AlertDialog
      onOpenChange={(open) => {
        if (!open) setTyped("");
      }}
    >
      <AlertDialogTrigger render={<Button type="button" size="sm" variant={severity === "low" ? "outline" : "destructive"} />}>
        <Trash2 data-icon="inline-start" />
        {running ? "Working…" : actionLabel}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}?</AlertDialogTitle>
          <AlertDialogDescription>{description} This cannot be undone here.</AlertDialogDescription>
        </AlertDialogHeader>
        {needsTyping ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`confirm-${actionLabel}`}>
              Type <span className="font-mono font-bold">{CONFIRM_WORD}</span> to allow a full wipe
            </Label>
            <Input
              id={`confirm-${actionLabel}`}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder={CONFIRM_WORD}
              autoComplete="off"
            />
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel>Not now</AlertDialogCancel>
          <AlertDialogAction disabled={!confirmed} onClick={onConfirm}>
            {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CardShell({
  icon: Icon,
  severity,
  title,
  detail,
  keptSafe,
  running,
  queued,
  waitingNote,
  children,
  footer,
}: {
  icon: typeof Trash2;
  severity: Severity;
  title: string;
  detail: string;
  keptSafe: string;
  running: boolean;
  queued: boolean;
  waitingNote?: string | null;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <li className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-muted/30 text-muted-foreground">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-extrabold text-foreground">{title}</h3>
            <SeverityBadge level={severity} />
            {running ? <Badge variant="outline">Working</Badge> : null}
            {queued && !running ? <Badge variant="outline">Queued</Badge> : null}
          </div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{detail}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            <span className="font-semibold text-foreground">Kept safe:</span> {keptSafe}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-3">{children}</div>

      {queued && !running && waitingNote ? (
        <p className="mt-2 text-xs font-medium text-foreground">{waitingNote}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">{footer}</div>
    </li>
  );
}

function ResultsCard({ m, waitingNote }: { m: Maintenance; waitingNote: (kind: CleanupKind) => string | null }) {
  const [mode, setMode] = useState<AttemptFilter["mode"]>("unsubmitted");
  const [sessionId, setSessionId] = useState<string>("all");
  const [olderThan, setOlderThan] = useState<string>("90");
  const filter: AttemptFilter = useMemo(() => ({
    mode,
    sessionId: sessionId === "all" ? null : sessionId,
    olderThanDays: olderThan.trim() === "" ? null : Math.max(1, Number(olderThan) || 0),
  }), [mode, sessionId, olderThan]);
  const estimate = useLiveEstimate(m, "attempts", filter);
  const running = m.activeKind === "attempts";
  const queued = m.queuedKinds.includes("attempts");
  const severity: Severity = mode === "all" && sessionId === "all" ? "high" : mode === "unsubmitted" ? "low" : "medium";
  const sessionName = sessionId === "all" ? "all sessions" : (m.options?.sessions.find((s) => s.id === sessionId)?.title ?? "the chosen session");
  return (
    <CardShell
      icon={RotateCcw}
      severity={severity}
      title="Student results"
      detail={`Clear answer records ${mode === "unsubmitted" ? "that were never submitted" : mode === "submitted" ? "that were marked" : "of every kind"} in ${sessionName}.`}
      keptSafe="Exam timetables, questions, students and classes stay as they are."
      running={running}
      queued={queued}
      waitingNote={waitingNote("attempts")}
      footer={
        <CleanupConfirm
          title="Clear these student results"
          description={`About ${(estimate?.total ?? 0).toLocaleString()} result records in ${sessionName} will be cleared with their marked answers.`}
          severity={severity}
          actionLabel="Clear results"
          running={running}
          onConfirm={() => m.clear("attempts", filter, "Clearing student results")}
        />
      }
    >
      <ScopePills
        label="Which results"
        value={mode}
        onChange={setMode}
        options={[
          { value: "unsubmitted", label: "Unfinished only" },
          { value: "submitted", label: "Marked only" },
          { value: "all", label: "Everything" },
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5 block text-xs font-semibold">Session</Label>
          <Select value={sessionId} onValueChange={(value) => setSessionId(value ?? "all")}>
            <SelectTrigger className="w-full"><SelectValue placeholder="All sessions" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sessions</SelectItem>
              {(m.options?.sessions ?? []).map((session) => (
                <SelectItem key={session.id} value={session.id}>
                  {session.title} · {session.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-semibold" htmlFor="attempts-older">Older than (days, optional)</Label>
          <Input
            id="attempts-older"
            type="number"
            min={1}
            inputMode="numeric"
            value={olderThan}
            onChange={(event) => setOlderThan(event.target.value)}
            placeholder="e.g. 90"
          />
        </div>
      </div>
      {running && m.progress ? (
        <div className="rounded-xl border border-border bg-background p-3" role="status" aria-live="polite">
          <p className="inline-flex items-center gap-2 text-xs font-semibold text-foreground">
            <LoaderCircle className="size-3.5 animate-spin" />
            {m.progress.label}
          </p>
          <Progress value={m.progress.total ? Math.min(100, (m.progress.done / m.progress.total) * 100) : null} className="mt-2" />
          <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
            Clearing in small batches so the page stays responsive. Keep this tab open.
          </p>
        </div>
      ) : null}
      <EstimateLine total={estimate?.total} note={estimate?.note} loading={estimate?.loading ?? !estimate} />
    </CardShell>
  );
}

function SessionsCard({ m, waitingNote }: { m: Maintenance; waitingNote: (kind: CleanupKind) => string | null }) {
  const [status, setStatus] = useState<SessionFilter["status"]>("closed");
  const [termId, setTermId] = useState<string>("all");
  const [olderThan, setOlderThan] = useState<string>("");
  const filter: SessionFilter = useMemo(() => ({
    status,
    termId: termId === "all" ? null : termId,
    olderThanDays: olderThan.trim() === "" ? null : Math.max(1, Number(olderThan) || 0),
  }), [status, termId, olderThan]);
  const estimate = useLiveEstimate(m, "sessions", filter);
  const running = m.activeKind === "sessions";
  const queued = m.queuedKinds.includes("sessions");
  const scoped = termId !== "all" || olderThan.trim() !== "";
  const severity: Severity = status === "non-open" && !scoped ? "high" : "medium";
  return (
    <CardShell
      icon={CalendarX2}
      severity={severity}
      title="Exam sessions"
      detail="Remove whole exam sessions. Results recorded under each removed session are cleared first, in batches."
      keptSafe="Questions, students, classes and staff records stay as they are. Open sessions are never included."
      running={running}
      queued={queued}
      waitingNote={waitingNote("sessions")}
      footer={
        <CleanupConfirm
          title="Remove these exam sessions"
          description={`About ${(estimate?.total ?? 0).toLocaleString()} sessions will be removed with their results. Open sessions are never included.`}
          severity={severity}
          actionLabel="Remove sessions"
          running={running}
          onConfirm={() => m.clear("sessions", filter, "Removing exam sessions")}
        />
      }
    >
      <ScopePills
        label="Session state"
        value={status}
        onChange={setStatus}
        options={[
          { value: "closed", label: "Closed" },
          { value: "draft", label: "Drafts" },
          { value: "non-open", label: "Drafts + closed" },
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5 block text-xs font-semibold">Term</Label>
          <Select value={termId} onValueChange={(value) => setTermId(value ?? "all")}>
            <SelectTrigger className="w-full"><SelectValue placeholder="All terms" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All terms</SelectItem>
              {(m.options?.terms ?? []).map((term) => (
                <SelectItem key={term.id} value={term.id}>
                  {term.name}{term.year ? ` · ${term.year}` : ""} · {term.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-semibold" htmlFor="sessions-older">Older than (days, optional)</Label>
          <Input
            id="sessions-older"
            type="number"
            min={1}
            inputMode="numeric"
            value={olderThan}
            onChange={(event) => setOlderThan(event.target.value)}
            placeholder="e.g. 180"
          />
        </div>
      </div>
      {running && m.progress ? (
        <div className="rounded-xl border border-border bg-background p-3" role="status" aria-live="polite">
          <p className="inline-flex items-center gap-2 text-xs font-semibold text-foreground">
            <LoaderCircle className="size-3.5 animate-spin" />
            {m.progress.label}
          </p>
          <Progress value={m.progress.total ? Math.min(100, (m.progress.done / m.progress.total) * 100) : null} className="mt-2" />
          <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
            Clearing in small batches so the page stays responsive. Keep this tab open.
          </p>
        </div>
      ) : null}
      <EstimateLine total={estimate?.total} note={estimate?.note} loading={estimate?.loading ?? !estimate} />
    </CardShell>
  );
}

function StaffQuestionsCard({ m, waitingNote }: { m: Maintenance; waitingNote: (kind: CleanupKind) => string | null }) {
  const [subjectId, setSubjectId] = useState<string>("all");
  const filter: StaffQuestionFilter = useMemo(() => ({
    subjectId: subjectId === "all" ? null : subjectId,
  }), [subjectId]);
  const estimate = useLiveEstimate(m, "staff-questions", filter);
  const running = m.activeKind === "staff-questions";
  const queued = m.queuedKinds.includes("staff-questions");
  const severity: Severity = subjectId === "all" ? "high" : "medium";
  const subjectName = subjectId === "all" ? "every subject" : (m.options?.subjects.find((s) => s.id === subjectId)?.name ?? "the chosen subject");
  return (
    <CardShell
      icon={BookOpenCheck}
      severity={severity}
      title="Staff-written questions"
      detail={`Remove questions written by staff in ${subjectName}. Anything used in marked results is skipped automatically.`}
      keptSafe="Prepared school questions stay available. Used questions are skipped, never force-removed."
      running={running}
      queued={queued}
      waitingNote={waitingNote("staff-questions")}
      footer={
        <CleanupConfirm
          title="Remove staff-written questions"
          description={`About ${(estimate?.total ?? 0).toLocaleString()} questions in ${subjectName} will be removed. Questions used in results are skipped.`}
          severity={severity}
          actionLabel="Remove questions"
          running={running}
          onConfirm={() => m.clear("staff-questions", filter, "Removing staff-written questions")}
        />
      }
    >
      <div>
        <Label className="mb-1.5 block text-xs font-semibold">Subject</Label>
        <Select value={subjectId} onValueChange={(value) => setSubjectId(value ?? "all")}>
          <SelectTrigger className="w-full"><SelectValue placeholder="All subjects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subjects</SelectItem>
            {(m.options?.subjects ?? []).map((subject) => (
              <SelectItem key={subject.id} value={subject.id}>
                {subject.name} · {subject.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {running && m.progress ? (
        <div className="rounded-xl border border-border bg-background p-3" role="status" aria-live="polite">
          <p className="inline-flex items-center gap-2 text-xs font-semibold text-foreground">
            <LoaderCircle className="size-3.5 animate-spin" />
            {m.progress.label}
          </p>
          <Progress value={m.progress.total ? Math.min(100, (m.progress.done / m.progress.total) * 100) : null} className="mt-2" />
          <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
            Clearing in small batches so the page stays responsive. Keep this tab open.
          </p>
        </div>
      ) : null}
      <EstimateLine total={estimate?.total} note={estimate?.note} loading={estimate?.loading ?? !estimate} />
    </CardShell>
  );
}

function WhatsappCard({ m, waitingNote }: { m: Maintenance; waitingNote: (kind: CleanupKind) => string | null }) {
  const [classId, setClassId] = useState<string>("all");
  const filter: WhatsappFilter = useMemo(() => ({
    classId: classId === "all" ? null : classId,
  }), [classId]);
  const estimate = useLiveEstimate(m, "whatsapp", filter);
  const running = m.activeKind === "whatsapp";
  const queued = m.queuedKinds.includes("whatsapp");
  const severity: Severity = classId === "all" ? "medium" : "low";
  const className = classId === "all" ? "every class" : (m.options?.classes.find((c) => c.id === classId)?.label ?? "the chosen class");
  return (
    <CardShell
      icon={MessageCircleOff}
      severity={severity}
      title="Class WhatsApp links"
      detail={`Remove saved WhatsApp group links for ${className}.`}
      keptSafe="Classes, students and their school records stay as they are."
      running={running}
      queued={queued}
      waitingNote={waitingNote("whatsapp")}
      footer={
        <CleanupConfirm
          title="Remove WhatsApp links"
          description={`About ${(estimate?.total ?? 0).toLocaleString()} saved links for ${className} will be removed.`}
          severity={severity}
          actionLabel="Remove links"
          running={running}
          onConfirm={() => m.clear("whatsapp", filter, "Removing WhatsApp links")}
        />
      }
    >
      <div>
        <Label className="mb-1.5 block text-xs font-semibold">Class</Label>
        <Select value={classId} onValueChange={(value) => setClassId(value ?? "all")}>
          <SelectTrigger className="w-full"><SelectValue placeholder="All classes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All classes</SelectItem>
            {(m.options?.classes ?? []).map((cls) => (
              <SelectItem key={cls.id} value={cls.id}>
                {cls.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {running && m.progress ? (
        <div className="rounded-xl border border-border bg-background p-3" role="status" aria-live="polite">
          <p className="inline-flex items-center gap-2 text-xs font-semibold text-foreground">
            <LoaderCircle className="size-3.5 animate-spin" />
            {m.progress.label}
          </p>
          <Progress value={m.progress.total ? Math.min(100, (m.progress.done / m.progress.total) * 100) : null} className="mt-2" />
          <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
            Clearing in small batches so the page stays responsive. Keep this tab open.
          </p>
        </div>
      ) : null}
      <EstimateLine total={estimate?.total} note={estimate?.note} loading={estimate?.loading ?? !estimate} />
    </CardShell>
  );
}

function IntegrityCard({ m, waitingNote }: { m: Maintenance; waitingNote: (kind: CleanupKind) => string | null }) {
  const [olderThan, setOlderThan] = useState<string>("30");
  const filter: IntegrityFilter = useMemo(() => ({
    olderThanDays: olderThan.trim() === "" ? null : Math.max(1, Number(olderThan) || 0),
  }), [olderThan]);
  const estimate = useLiveEstimate(m, "integrity-events", filter);
  const running = m.activeKind === "integrity-events";
  const queued = m.queuedKinds.includes("integrity-events");
  const severity: Severity = olderThan.trim() === "" ? "medium" : "low";
  return (
    <CardShell
      icon={ListChecks}
      severity={severity}
      title="Check-in trails"
      detail="Remove old focus and supervision check-in events. These are audit trails only — results are untouched."
      keptSafe="Results, sessions, questions and every other record stay as they are."
      running={running}
      queued={queued}
      waitingNote={waitingNote("integrity-events")}
      footer={
        <CleanupConfirm
          title="Clear check-in trails"
          description={`About ${(estimate?.total ?? 0).toLocaleString()} check-in events will be cleared. Results are untouched.`}
          severity={severity}
          actionLabel="Clear trails"
          running={running}
          onConfirm={() => m.clear("integrity-events", filter, "Clearing check-in trails")}
        />
      }
    >
      <div>
        <Label className="mb-1.5 block text-xs font-semibold" htmlFor="integrity-older">Older than (days — empty means everything)</Label>
        <Input
          id="integrity-older"
          type="number"
          min={1}
          inputMode="numeric"
          value={olderThan}
          onChange={(event) => setOlderThan(event.target.value)}
          placeholder="All events"
        />
      </div>
      {running && m.progress ? (
        <div className="rounded-xl border border-border bg-background p-3" role="status" aria-live="polite">
          <p className="inline-flex items-center gap-2 text-xs font-semibold text-foreground">
            <LoaderCircle className="size-3.5 animate-spin" />
            {m.progress.label}
          </p>
          <Progress value={m.progress.total ? Math.min(100, (m.progress.done / m.progress.total) * 100) : null} className="mt-2" />
          <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
            Clearing in small batches so the page stays responsive. Keep this tab open.
          </p>
        </div>
      ) : null}
      <EstimateLine total={estimate?.total} note={estimate?.note} loading={estimate?.loading ?? !estimate} />
    </CardShell>
  );
}

function GroupSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title}>
      <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">{eyebrow}</p>
      <h2 className="mt-1 font-display text-lg font-extrabold text-foreground">{title}</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      <ol className="mt-4 flex flex-col gap-4">{children}</ol>
    </section>
  );
}

export function DataMaintenance() {
  const m = useSchoolDataMaintenance();
  const waitingNote = (kind: CleanupKind) => {
    if (!m.activeKind || m.activeKind === kind) return null;
    const titles: Record<CleanupKind, string> = {
      attempts: "student results",
      sessions: "exam sessions",
      "staff-questions": "staff-written questions",
      whatsapp: "WhatsApp links",
      "integrity-events": "check-in trails",
    };
    return `Waiting — runs by itself after ${titles[m.activeKind]}.`;
  };

  return (
    <section aria-labelledby="cleanup-actions-heading" className="flex flex-col gap-8">
      <h2 id="cleanup-actions-heading" className="sr-only">Clean-up actions</h2>

      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>These actions remove school records</AlertTitle>
        <AlertDescription>
          Nothing here publishes new content. Every card shows how many records match before anything runs, and full-table
          wipes ask you to type DELETE. The page stays in place while work clears in small batches.
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        <Database className="size-4 shrink-0" />
        <span className="font-semibold text-foreground">How to read the badges:</span>
        <SeverityBadge level="low" />
        <span>safe to run often.</span>
        <SeverityBadge level="medium" />
        <span>check the count first.</span>
        <SeverityBadge level="high" />
        <span>wipes a whole table — typing required.</span>
      </div>

      {m.feedback ? (
        <Alert variant={m.feedback.tone === "error" ? "destructive" : "default"}>
          <AlertTitle>{m.feedback.tone === "error" ? "Clean-up did not finish" : "Clean-up finished"}</AlertTitle>
          <AlertDescription>{m.feedback.message}</AlertDescription>
        </Alert>
      ) : null}

      <GroupSection
        eyebrow="Exam activity"
        title="Results & sessions"
        description="Day-to-day resets: unfinished attempts, marked results for one session or term, and old sessions. Open sessions are always protected."
      >
        <ResultsCard m={m} waitingNote={waitingNote} />
        <SessionsCard m={m} waitingNote={waitingNote} />
      </GroupSection>

      <GroupSection
        eyebrow="Question bank"
        title="Staff-written questions"
        description="Remove questions written by staff, for one subject or all. Anything used in marked results is skipped, never force-removed."
      >
        <StaffQuestionsCard m={m} waitingNote={waitingNote} />
      </GroupSection>

      <GroupSection
        eyebrow="Connections & trails"
        title="Links & audit trails"
        description="Small, safe removals: WhatsApp group links per class and old supervision check-in events."
      >
        <WhatsappCard m={m} waitingNote={waitingNote} />
        <IntegrityCard m={m} waitingNote={waitingNote} />
      </GroupSection>
    </section>
  );
}
