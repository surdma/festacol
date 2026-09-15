import subjectFixture from "../../public/seed/subjects.json";

export type AcademicTrack = "SCIENCE" | "ART" | "SOCIAL_SCIENCE";
export type OfferingParticipation = "REQUIRED" | "ELECTIVE";

export interface SubjectTrackRuleDefinition {
  track: AcademicTrack;
  participation: OfferingParticipation;
}

export interface CatalogSubject {
  code: string;
  name: string;
  active: boolean;
  levels: string[];
  modes: string[];
  trackRules: SubjectTrackRuleDefinition[];
}

interface SubjectFixture {
  schemaVersion: number;
  fixtureId: string;
  tracks: AcademicTrack[];
  subjects: CatalogSubject[];
}

const fixture = subjectFixture as SubjectFixture;

if (fixture.schemaVersion !== 4) {
  throw new Error(`Unsupported subject fixture schema version ${fixture.schemaVersion}`);
}

/**
 * Canonical subject catalog used by application code.
 *
 * The JSON fixture is the single editable source of truth. Track eligibility is
 * relational metadata (`trackRules`), not a duplicated stream/category field.
 */
export const SUBJECT_CATALOG: readonly CatalogSubject[] = fixture.subjects;

// Kept as a source-compatible alias while callers migrate from the old name.
// It no longer carries the old `category`/`streams` contract.
export const WAEC_SUBJECTS = SUBJECT_CATALOG;

export const SUBJECT_BY_CODE = new Map(SUBJECT_CATALOG.map((subject) => [subject.code, subject] as const));

export function subjectSupportsTrack(subject: CatalogSubject, track: AcademicTrack): boolean {
  return subject.trackRules.some((rule) => rule.track === track);
}
