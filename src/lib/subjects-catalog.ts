import subjectFixture from "../../public/seed/subjects.json";

export type AcademicTrack = "SCIENCE" | "HUMANITIES" | "BUSINESS";
export type OfferingParticipation = "REQUIRED" | "ELECTIVE";
export type SubjectKind = "CURRICULUM" | "QUALIFIER";

export interface SubjectCurriculumRuleDefinition {
  level: "SS1" | "SS2" | "SS3";
  track: AcademicTrack;
  participation: OfferingParticipation;
}

export interface CatalogSubject {
  code: string;
  name: string;
  kind: SubjectKind;
  active: boolean;
  curriculum: SubjectCurriculumRuleDefinition[];
}

interface SubjectFixture {
  schemaVersion: number;
  fixtureId: string;
  tracks: AcademicTrack[];
  levels: string[];
  subjects: CatalogSubject[];
}

const fixture = subjectFixture as SubjectFixture;

if (fixture.schemaVersion !== 5) {
  throw new Error(`Unsupported subject fixture schema version ${fixture.schemaVersion}`);
}

/** Canonical senior-secondary/qualifier subject catalog. */
export const SUBJECT_CATALOG: readonly CatalogSubject[] = fixture.subjects;

export const WAEC_SUBJECTS = SUBJECT_CATALOG.filter((subject) => subject.kind === "CURRICULUM");

export const SUBJECT_BY_CODE = new Map(SUBJECT_CATALOG.map((subject) => [subject.code, subject] as const));

export function subjectSupportsTrack(
  subject: CatalogSubject,
  track: AcademicTrack,
  level?: "SS1" | "SS2" | "SS3",
): boolean {
  return subject.curriculum.some((rule) => rule.track === track && (!level || rule.level === level));
}
