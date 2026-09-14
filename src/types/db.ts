// Supabase row types — derived from the Prisma schema (single source of truth).
// Prisma owns table SHAPE (schema.prisma → migrations). These types translate
// camelCase → snake_case to match PostgREST payloads:
//   - scalar fields flow through automatically (new columns appear here too;
//     removed columns break stale accesses at typecheck instead of drifting);
//   - relations are omitted (server payloads are flat rows);
//   - bigint → number (PostgREST serializes int8 as JSON numbers);
//   - Json columns get per-table refinements where the app needs shapes.
// If Prisma models change, run `prisma generate` and fix any tsc errors here.

import type {
  Class as PrismaClass,
  ExamAttempt as PrismaAttempt,
  ExamSession as PrismaSession,
  ExamState as PrismaState,
  Question as PrismaQuestion,
  QuestionBank as PrismaBank,
  StudentProfile as PrismaProfile,
  Subject as PrismaSubject,
  User as PrismaUser,
} from "@/generated/prisma/client";

type Snake<S extends string> = S extends `${infer H}${infer T}`
  ? H extends Lowercase<H>
    ? `${H}${Snake<T>}`
    : `_${Lowercase<H>}${Snake<T>}`
  : S;

type DbValue<V> =
  V extends bigint | null ? number | null
  : V extends bigint ? number
  : V;

type DbRow<M> = {
  [K in keyof M as K extends string ? Snake<K> : never]: DbValue<M[K]>;
};

type Override<T, U extends Record<string, unknown>> = Omit<T, keyof U> & U;

export type ClassRow = DbRow<Omit<PrismaClass, "users" | "whatsappGroups">>;

export type SubjectRow = Override<
  DbRow<PrismaSubject>,
  { streams: string[] }
>;

export type UserRow = Override<
  DbRow<Omit<PrismaUser, "class">>,
  { subjects: string[] }
>;

export type StudentProfileRow = DbRow<PrismaProfile>;

export type ExamSessionRow = Override<
  DbRow<Omit<PrismaSession, "attempts" | "states" | "resetMarkers" | "backgroundMarks" | "proctorPolicy">>,
  {
    subjects: string[];
    placement_tracks: string[];
    integrity_policy: Record<string, unknown>;
    randomization: Record<string, unknown>;
    cohosts: string[];
  }
>;

export interface IntegrityEvent {
  type: string;
  detail?: string;
  at: number;
}

export type ExamAttemptRow = Override<
  DbRow<Omit<PrismaAttempt, "session">>,
  {
    subjects: string[];
    integrity_events: IntegrityEvent[];
    subject_stats: { subject: string; percent: number }[];
    placement: { assignedTrack: string; confidence: number } | null;
    details: { questionId: number; correct: boolean | null; correctAnswer: string }[];
    question_ids: number[];
  }
>;

export type ExamStateRow = Override<
  DbRow<PrismaState>,
  { state: Record<string, unknown> & { integrityEvents?: IntegrityEvent[] } }
>;

export type QuestionRow = Override<
  DbRow<Omit<PrismaQuestion, "override">>,
  { data: { prompt?: string } & Record<string, unknown> }
>;

export type QuestionBankRow = DbRow<PrismaBank>;
