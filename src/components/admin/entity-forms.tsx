"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  deleteClassAction,
  deleteWhatsappAction,
  getUserDetailAction,
  toggleUserAction,
  upsertUserAction,
  upsertWhatsappAction,
} from "@/app/actions/admin";
import { upsertClassAction } from "@/app/actions/academic-structure";
import {
  getAdminFormOptionsAction,
  getClassDetailAction,
  getWhatsappDetailAction,
  upsertQuestionParityAction,
  type SubjectOption,
} from "@/app/actions/admin-parity";
import { getQuestionEditorDetailAction } from "@/app/actions/question-bank";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { AcademicTrack } from "@/types/db";
import type { QuestionType } from "@/types/exam";

function Shell({ title, description, open, onClose, submit, pending, error, children, saveLabel = "Save" }: {
  title: string;
  description?: string;
  open: boolean;
  onClose: () => void;
  submit: () => void;
  pending: boolean;
  error: string | null;
  children: React.ReactNode;
  saveLabel?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle>{description ? <DialogDescription>{description}</DialogDescription> : null}</DialogHeader>
        <FieldGroup>{children}</FieldGroup>
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        <DialogFooter><Button onClick={submit} disabled={pending}>{pending ? "Saving…" : saveLabel}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UserFormDialog({ open, onClose, presetRole = "student", userId }: { open: boolean; onClose: () => void; presetRole?: string; userId?: string }) {
  const router = useRouter();
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [fullName, setFullName] = useState("");
  const [classId, setClassId] = useState("");
  const [guardian, setGuardian] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setError(null);
    void getAdminFormOptionsAction().then((options) => setClasses(options.classes)).catch(() => setError("Class options could not be loaded."));
    if (!userId) { setFullName(""); setClassId(""); setGuardian(""); return; }
    void getUserDetailAction(userId).then((detail) => {
      const user = detail.user as { full_name?: string; class_id?: string | null; guardian?: string; role?: string } | null;
      if (!user || user.role !== "student") { setError("Student record is unavailable."); return; }
      setFullName(user.full_name ?? "");
      setClassId(user.class_id ?? "");
      setGuardian(user.guardian ?? "");
    }).catch(() => setError("Student record could not be loaded."));
  }, [open, userId]);

  return (
    <Shell
      title={userId ? "Edit student" : "Add student"}
      description="Student identity, class assignment and guardian information feed the examination and reporting workflow. Staff accounts are provisioned separately."
      open={open}
      pending={pending}
      error={error}
      onClose={onClose}
      saveLabel={userId ? "Update student" : "Add student"}
      submit={() => startTransition(async () => {
        setError(null);
        const result = await upsertUserAction({ id: userId, fullName, role: presetRole === "student" ? "student" : presetRole, classId, guardian });
        if (!result.ok) { setError(result.error ?? "Save failed."); return; }
        onClose(); router.refresh();
      })}
    >
      <Field><FieldLabel htmlFor="u-name">Full name</FieldLabel><Input id="u-name" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} /></Field>
      <Field><FieldLabel htmlFor="u-class">Class</FieldLabel><NativeSelect id="u-class" value={classId} onChange={(event) => setClassId(event.target.value)}><NativeSelectOption value="">Unassigned</NativeSelectOption>{classes.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}</NativeSelect></Field>
      <Field><FieldLabel htmlFor="u-guardian">Guardian / parent</FieldLabel><Input id="u-guardian" value={guardian} onChange={(event) => setGuardian(event.target.value)} maxLength={80} /></Field>
    </Shell>
  );
}

export function ClassFormDialog({ open, onClose, classId }: { open: boolean; onClose: () => void; classId?: string }) {
  const router = useRouter();
  const [classLevel, setClassLevel] = useState("SS1");
  const [track, setTrack] = useState<AcademicTrack>("science");
  const [arm, setArm] = useState("A");
  const [capacity, setCapacity] = useState(40);
  const [room, setRoom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (!classId) { setClassLevel("SS1"); setTrack("science"); setArm("A"); setCapacity(40); setRoom(""); return; }
    void getClassDetailAction(classId).then((detail) => {
      const item = detail.classRow as { level_name?: string; track?: AcademicTrack; arm?: string; capacity?: number; room?: string } | null;
      if (!item) { setError("Class record is unavailable."); return; }
      setClassLevel(item.level_name ?? "SS1");
      setTrack(item.track ?? "science");
      setArm(item.arm ?? "A");
      setCapacity(Number(item.capacity ?? 40));
      setRoom(item.room ?? "");
    }).catch(() => setError("Class record could not be loaded."));
  }, [classId, open]);

  return (
    <Shell title={classId ? "Edit class" : "Add class"} description="Class identity is level + academic track + arm for an academic year. Subject offerings are configured separately." open={open} pending={pending} error={error} onClose={onClose} saveLabel={classId ? "Update class" : "Add class"} submit={() => startTransition(async () => {
      setError(null);
      const result = await upsertClassAction({ id: classId, classLevel, track, arm, capacity, room });
      if (!result.ok) { setError(result.error ?? "Save failed."); return; }
      onClose(); router.refresh();
    })}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field><FieldLabel htmlFor="c-level">Level</FieldLabel><NativeSelect id="c-level" value={classLevel} onChange={(event) => setClassLevel(event.target.value)}>{["SS1", "SS2", "SS3"].map((level) => <NativeSelectOption key={level} value={level}>{level}</NativeSelectOption>)}</NativeSelect></Field>
        <Field><FieldLabel htmlFor="c-track">Academic track</FieldLabel><NativeSelect id="c-track" value={track} onChange={(event) => setTrack(event.target.value as AcademicTrack)}><NativeSelectOption value="science">Science</NativeSelectOption><NativeSelectOption value="humanities">Humanities</NativeSelectOption><NativeSelectOption value="business">Business</NativeSelectOption></NativeSelect></Field>
        <Field><FieldLabel htmlFor="c-arm">Arm</FieldLabel><Input id="c-arm" value={arm} onChange={(event) => setArm(event.target.value.toUpperCase())} maxLength={4} /></Field>
        <Field><FieldLabel htmlFor="c-cap">Capacity</FieldLabel><Input id="c-cap" type="number" min={1} max={500} value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} /></Field>
      </div>
      <Field><FieldLabel htmlFor="c-room">Room / location</FieldLabel><Input id="c-room" value={room} onChange={(event) => setRoom(event.target.value)} maxLength={50} /></Field>
    </Shell>
  );
}

export function WhatsappFormDialog({ open, onClose, classId, groupId }: { open: boolean; onClose: () => void; classId: string; groupId?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (!groupId) { setName(""); setInviteUrl(""); return; }
    void getWhatsappDetailAction(groupId).then((group) => {
      const item = group as { name?: string; invite_url?: string } | null;
      if (!item) { setError("WhatsApp group is unavailable."); return; }
      setName(item.name ?? ""); setInviteUrl(item.invite_url ?? "");
    }).catch(() => setError("WhatsApp group could not be loaded."));
  }, [groupId, open]);

  return (
    <Shell title={groupId ? "Edit WhatsApp group" : "Add WhatsApp group"} description="Use the official class invite link. The link is exposed to administrators and class communication workflows." open={open} pending={pending} error={error} onClose={onClose} saveLabel={groupId ? "Update group" : "Add group"} submit={() => startTransition(async () => {
      setError(null);
      const result = await upsertWhatsappAction({ id: groupId, classId, name, inviteUrl });
      if (!result.ok) { setError(result.error ?? "Save failed."); return; }
      onClose(); router.refresh();
    })}>
      <Field><FieldLabel htmlFor="w-name">Group name</FieldLabel><Input id="w-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} /></Field>
      <Field><FieldLabel htmlFor="w-url">Invite link</FieldLabel><Input id="w-url" type="url" inputMode="url" value={inviteUrl} onChange={(event) => setInviteUrl(event.target.value)} placeholder="https://chat.whatsapp.com/..." /></Field>
    </Shell>
  );
}

export function QuestionFormDialog({ open, onClose, questionId }: { open: boolean; onClose: () => void; questionId?: number }) {
  const router = useRouter();
  const [catalog, setCatalog] = useState<SubjectOption[]>([]);
  const [scope, setScope] = useState<{ isAdmin: boolean; subjectIds: string[]; qualifierAccess: boolean } | null>(null);
  const [subjectId, setSubjectId] = useState("");
  const [kind, setKind] = useState<QuestionType>("single");
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctAnswers, setCorrectAnswers] = useState<string[]>([]);
  const [levels, setLevels] = useState<string[]>(["SS1", "SS2", "SS3"]);
  const [fillTemplate, setFillTemplate] = useState("");
  const [blankAnswers, setBlankAnswers] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [domain, setDomain] = useState("");
  const [explanation, setExplanation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setError(null);
    void getAdminFormOptionsAction().then((data) => {
      setCatalog(data.subjects);
      setScope({ isAdmin: data.scope.isAdmin, subjectIds: data.scope.subjectIds, qualifierAccess: data.scope.qualifierAccess });
    }).catch(() => setError("Question form options could not be loaded."));
    if (!questionId) {
      setSubjectId(""); setKind("single"); setPrompt(""); setOptions(["", "", "", ""]); setCorrectAnswers([]); setLevels(["SS1", "SS2", "SS3"]); setFillTemplate(""); setBlankAnswers(""); setDifficulty("medium"); setDomain(""); setExplanation("");
      return;
    }
    void getQuestionEditorDetailAction(questionId).then((detail) => {
      const question = detail.question as { subject_id?: string; qtype?: QuestionType; prompt?: string; options?: string[]; correct_answers?: string[]; levels?: string[]; fill_template?: string | null; difficulty?: string; domain?: string; explanation?: string } | null;
      const blanks = detail.blanks as { accepted?: string[] }[];
      if (!question) { setError("Question is unavailable or outside your scope."); return; }
      setSubjectId(question.subject_id ?? ""); setKind(question.qtype ?? "single"); setPrompt(question.prompt ?? ""); setOptions(question.options?.length ? [...question.options] : ["", "", "", ""]); setCorrectAnswers(question.correct_answers ?? []); setLevels(question.levels?.length ? question.levels : ["SS1", "SS2", "SS3"]); setFillTemplate((question.fill_template ?? "").replace(/\{\{\d+\}\}/g, "___")); setBlankAnswers(blanks.map((blank) => (blank.accepted ?? []).join(" | ")).join("\n")); setDifficulty(question.difficulty ?? "medium"); setDomain(question.domain ?? ""); setExplanation(question.explanation ?? "");
    }).catch(() => setError("Question could not be loaded."));
  }, [open, questionId]);

  const visibleSubjects = useMemo(() => {
    if (!scope || scope.isAdmin) return catalog;
    return catalog.filter((subject) => scope.subjectIds.includes(subject.id) || (scope.qualifierAccess && subject.code.startsWith("q-")));
  }, [catalog, scope]);

  function toggleLevel(level: string) { setLevels((current) => current.includes(level) ? current.filter((item) => item !== level) : [...current, level]); }
  function toggleCorrect(option: string) {
    if (!option.trim()) return;
    if (kind === "single") { setCorrectAnswers([option]); return; }
    setCorrectAnswers((current) => current.includes(option) ? current.filter((item) => item !== option) : [...current, option]);
  }

  const fillLines = blankAnswers.split(/\n/).map((line) => line.split("|").map((answer) => answer.trim()).filter(Boolean));

  return (
    <Shell title={questionId ? "Edit question" : "Add question"} description="Author against the same typed question model consumed by the production exam engine." open={open} pending={pending} error={error} onClose={onClose} saveLabel={questionId ? "Update question" : "Add question"} submit={() => startTransition(async () => {
      setError(null);
      const result = await upsertQuestionParityAction({ id: questionId, subjectId, kind, prompt, options, correctAnswers: kind === "boolean" ? [correctAnswers[0] ?? ""] : correctAnswers, levels, fillTemplate, blankAnswers: fillLines, difficulty, domain, explanation });
      if (!result.ok) { setError(result.error ?? "Save failed."); return; }
      onClose(); router.refresh();
    })}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field><FieldLabel htmlFor="q-subject">Subject</FieldLabel><NativeSelect id="q-subject" value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><NativeSelectOption value="">Choose subject</NativeSelectOption>{visibleSubjects.map((subject) => <NativeSelectOption key={subject.id} value={subject.id}>{subject.name}</NativeSelectOption>)}</NativeSelect></Field>
        <Field><FieldLabel htmlFor="q-type">Question type</FieldLabel><NativeSelect id="q-type" value={kind} onChange={(event) => { setKind(event.target.value as QuestionType); setCorrectAnswers([]); }}><NativeSelectOption value="single">Single choice</NativeSelectOption><NativeSelectOption value="multi">Multiple answers</NativeSelectOption><NativeSelectOption value="boolean">True / False</NativeSelectOption><NativeSelectOption value="fill">Fill one gap</NativeSelectOption><NativeSelectOption value="fill-multi">Fill multiple gaps</NativeSelectOption></NativeSelect></Field>
      </div>
      <Field><FieldLabel htmlFor="q-prompt">Prompt</FieldLabel><Textarea id="q-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={4} /></Field>

      {kind === "single" || kind === "multi" ? (
        <Field>
          <FieldLabel>Answer options</FieldLabel>
          <div className="grid gap-2">
            {options.map((option, index) => {
              const active = correctAnswers.includes(option) && option.trim().length > 0;
              return <div key={index} className="flex gap-2"><Input aria-label={`Option ${index + 1}`} value={option} onChange={(event) => { const previous = option; const value = event.target.value; setOptions((current) => current.map((item, itemIndex) => itemIndex === index ? value : item)); if (correctAnswers.includes(previous)) setCorrectAnswers((current) => current.map((item) => item === previous ? value : item)); }} /><Button type="button" variant={active ? "default" : "outline"} onClick={() => toggleCorrect(option)}>{active ? "Correct" : "Mark correct"}</Button>{options.length > 2 ? <Button type="button" size="icon" variant="ghost" aria-label={`Remove option ${index + 1}`} onClick={() => { setOptions((current) => current.filter((_, itemIndex) => itemIndex !== index)); setCorrectAnswers((current) => current.filter((item) => item !== option)); }}><Trash2 /></Button> : null}</div>;
            })}
            {options.length < 8 ? <Button type="button" variant="outline" className="justify-self-start" onClick={() => setOptions((current) => [...current, ""])}><Plus data-icon="inline-start" />Add option</Button> : null}
          </div>
        </Field>
      ) : null}

      {kind === "boolean" ? <Field><FieldLabel htmlFor="q-boolean">Correct answer</FieldLabel><NativeSelect id="q-boolean" value={correctAnswers[0] ?? ""} onChange={(event) => setCorrectAnswers([event.target.value])}><NativeSelectOption value="">Choose answer</NativeSelectOption><NativeSelectOption value="true">True</NativeSelectOption><NativeSelectOption value="false">False</NativeSelectOption></NativeSelect></Field> : null}

      {kind === "fill" || kind === "fill-multi" ? <>
        <Field><FieldLabel htmlFor="q-template">Sentence with blank markers</FieldLabel><Textarea id="q-template" value={fillTemplate} onChange={(event) => setFillTemplate(event.target.value)} placeholder={kind === "fill" ? "Water freezes at ___ degrees Celsius." : "The colours are ___, ___ and ___."} /><p className="mt-1 text-xs text-muted-foreground">Use three underscores (___) for each answer box.</p></Field>
        <Field><FieldLabel htmlFor="q-blank-answers">Accepted answers</FieldLabel><Textarea id="q-blank-answers" value={blankAnswers} onChange={(event) => setBlankAnswers(event.target.value)} placeholder={kind === "fill" ? "0 | zero" : "red | crimson\ngreen\nblue"} /><p className="mt-1 text-xs text-muted-foreground">One line per blank. Separate accepted alternatives with |.</p></Field>
      </> : null}

      <Field><FieldLabel>Class levels</FieldLabel><div className="flex flex-wrap gap-2">{["SS1", "SS2", "SS3"].map((level) => <Button key={level} type="button" size="sm" variant={levels.includes(level) ? "default" : "outline"} onClick={() => toggleLevel(level)}>{level}</Button>)}</div></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field><FieldLabel htmlFor="q-difficulty">Difficulty</FieldLabel><NativeSelect id="q-difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>{["easy", "medium", "hard"].map((value) => <NativeSelectOption key={value} value={value}>{value}</NativeSelectOption>)}</NativeSelect></Field>
        <Field><FieldLabel htmlFor="q-domain">Domain / topic</FieldLabel><Input id="q-domain" value={domain} onChange={(event) => setDomain(event.target.value)} maxLength={80} /></Field>
      </div>
      <Field><FieldLabel htmlFor="q-explanation">Explanation (optional)</FieldLabel><Textarea id="q-explanation" value={explanation} onChange={(event) => setExplanation(event.target.value)} rows={3} /></Field>
    </Shell>
  );
}

export function DeleteButtons({ kind, id }: { kind: "class" | "whatsapp" | "user"; id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <Button size="sm" variant="destructive" disabled={pending} onClick={() => startTransition(async () => {
    if (kind === "class") await deleteClassAction(id);
    else if (kind === "whatsapp") await deleteWhatsappAction(id);
    else await toggleUserAction(id, false);
    router.refresh();
  })}>{kind === "user" ? "Suspend" : "Delete"}</Button>;
}
