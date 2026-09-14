// WAEC-grounded subject catalog (Nigerian SS curriculum).
// Core (all streams): English, Mathematics, Civic Education (+ trade subject).
// Codes match the live question bank's subject_code values so exams,
// questions and teacher scopes join without translation tables.
// Sources: WASSCE syllabus index + WAEC Nigeria approved-subject list (2026).

export interface CatalogSubject {
  code: string;
  name: string;
  category: "core" | "science" | "art" | "commercial" | "legacy";
  streams: string[];
}

const ALL = ["Science", "Art", "Commercial"];

export const WAEC_SUBJECTS: CatalogSubject[] = [
  // Core — every child class takes these
  { code: "eng", name: "English Language", category: "core", streams: ALL },
  { code: "mat", name: "General Mathematics", category: "core", streams: ALL },
  { code: "civ", name: "Civic Education", category: "core", streams: ALL },
  // Sciences
  { code: "phy", name: "Physics", category: "science", streams: ["Science"] },
  { code: "chem", name: "Chemistry", category: "science", streams: ["Science"] },
  { code: "bio", name: "Biology", category: "science", streams: ["Science"] },
  { code: "agric", name: "Agricultural Science", category: "science", streams: ["Science"] },
  { code: "geo", name: "Geography", category: "science", streams: ["Science", "Art", "Commercial"] },
  { code: "comp", name: "Computer Studies", category: "science", streams: ALL },
  { code: "fmath", name: "Further Mathematics", category: "science", streams: ["Science"] },
  { code: "dproc", name: "Data Processing", category: "science", streams: ALL },
  // Arts & Humanities
  { code: "lit", name: "Literature in English", category: "art", streams: ["Art"] },
  { code: "gov", name: "Government", category: "art", streams: ["Art", "Commercial"] },
  { code: "hist", name: "History", category: "art", streams: ["Art"] },
  { code: "crs", name: "Christian Religious Studies", category: "art", streams: ["Art"] },
  { code: "french", name: "French", category: "art", streams: ALL },
  { code: "vart", name: "Visual Art", category: "art", streams: ["Art"] },
  // Commercial
  { code: "eco", name: "Economics", category: "commercial", streams: ["Commercial", "Art", "Science"] },
  { code: "acct", name: "Financial Accounting", category: "commercial", streams: ["Commercial"] },
  { code: "comm", name: "Commerce", category: "commercial", streams: ["Commercial"] },
  { code: "busm", name: "Business Management", category: "commercial", streams: ["Commercial"] },
  { code: "mkt", name: "Marketing", category: "commercial", streams: ["Commercial"] },
  // Legacy bank codes (720 seeded questions use these) — kept working
  { code: "q-eng", name: "English (legacy bank)", category: "legacy", streams: ALL },
  { code: "q-math", name: "Mathematics (legacy bank)", category: "legacy", streams: ALL },
  { code: "q-bst", name: "Basic Science (legacy bank)", category: "legacy", streams: ALL },
  { code: "q-social", name: "Social Studies (legacy bank)", category: "legacy", streams: ALL },
  { code: "q-business", name: "Business (legacy bank)", category: "legacy", streams: ALL },
  { code: "q-digital", name: "Digital/ICT (legacy bank)", category: "legacy", streams: ALL },
];
