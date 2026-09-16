import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClassLevel, ExamSessionDTO } from "@/types/exam";

interface SessionRow {
  id: string;
  title: string;
  academic_term_id: string | null;
  mode: ExamSessionDTO["mode"];
  status: ExamSessionDTO["status"];
  duration_seconds: number;
  question_count: number;
  instructions: string;
  starts_at: number | null;
  ends_at: number | null;
  focus_monitoring: boolean;
  fullscreen_prompt: boolean;
  clipboard_guard: boolean;
  camera_required: boolean;
  warn_after: number;
  question_order: boolean;
  option_order: boolean;
  minimize_collisions: boolean;
}

const CLASS_LEVELS = new Set<ClassLevel>(["SS1", "SS2", "SS3"]);

function displayTrack(value: string): string {
  if (value === "science") return "Science";
  if (value === "humanities") return "Humanities";
  if (value === "business") return "Business";
  return value;
}

export async function loadExamRuntimeSession(
  client: SupabaseClient,
  sessionId: string,
): Promise<{ session: ExamSessionDTO; cameraRequired: boolean } | null> {
  const id = sessionId.toUpperCase();
  const { data: rawSession, error: sessionError } = await client
    .from("exam_sessions")
    .select("id,title,academic_term_id,mode,status,duration_seconds,question_count,instructions,starts_at,ends_at,focus_monitoring,fullscreen_prompt,clipboard_guard,camera_required,warn_after,question_order,option_order,minimize_collisions")
    .eq("id", id)
    .maybeSingle();
  if (sessionError || !rawSession) return null;
  const row = rawSession as SessionRow;
  const isQualifier = row.mode === "qualifier";

  const [offeringTargetResult, classTargetResult, placementResult, subjectTargetResult] = await Promise.all([
    client.from("exam_offering_targets").select("offering_id").eq("session_id", id),
    client.from("exam_class_targets").select("class_id").eq("session_id", id),
    client.from("exam_placement_tracks").select("track").eq("session_id", id),
    client.from("exam_subject_targets").select("subject_id").eq("session_id", id),
  ]);
  if (
    offeringTargetResult.error
    || classTargetResult.error
    || placementResult.error
    || subjectTargetResult.error
  ) return null;

  const offeringIds = ((offeringTargetResult.data ?? []) as { offering_id: string }[]).map((item) => item.offering_id);
  const { data: offeringRows, error: offeringError } = offeringIds.length
    ? await client.from("class_subject_offerings").select("id,class_id,subject_id").in("id", offeringIds)
    : { data: [], error: null };
  if (offeringError) return null;
  const offerings = (offeringRows ?? []) as { id: string; class_id: string; subject_id: string }[];

  const classIds = [...new Set([
    ...((classTargetResult.data ?? []) as { class_id: string }[]).map((item) => item.class_id),
    ...offerings.map((item) => item.class_id),
  ])];
  const { data: classRows, error: classesError } = classIds.length
    ? await client.from("classes").select("id,level_id,academic_year_id,arm").in("id", classIds)
    : { data: [], error: null };
  if (classesError) return null;
  const classes = (classRows ?? []) as { id: string; level_id: string; academic_year_id: string; arm: string }[];
  if (!isQualifier && !classes.length) return null;

  let classLevel: ClassLevel = "SS1";
  if (!isQualifier) {
    const levelIds = [...new Set(classes.map((item) => item.level_id))];
    const { data: levelRows, error: levelError } = await client.from("academic_levels").select("id,name").in("id", levelIds);
    if (levelError) return null;
    const levelNames = [...new Set(((levelRows ?? []) as { id: string; name: string }[]).map((item) => item.name))];
    if (levelNames.length !== 1 || !CLASS_LEVELS.has(levelNames[0] as ClassLevel)) return null;
    classLevel = levelNames[0] as ClassLevel;
  }

  const academicYearIds = [...new Set(classes.map((item) => item.academic_year_id))];
  const { data: yearRows, error: yearError } = academicYearIds.length
    ? await client.from("academic_years").select("id,name").in("id", academicYearIds)
    : { data: [], error: null };
  if (yearError) return null;
  let yearNames = [...new Set(((yearRows ?? []) as { id: string; name: string }[]).map((item) => item.name))];

  let termName = "";
  if (row.academic_term_id) {
    const { data: term, error: termError } = await client
      .from("academic_terms")
      .select("name,academic_year_id")
      .eq("id", row.academic_term_id)
      .maybeSingle();
    if (termError) return null;
    const termRow = term as { name?: string; academic_year_id?: string } | null;
    termName = String(termRow?.name ?? "");

    if (!yearNames.length && termRow?.academic_year_id) {
      const { data: termYear, error: termYearError } = await client
        .from("academic_years")
        .select("name")
        .eq("id", termRow.academic_year_id)
        .maybeSingle();
      if (termYearError) return null;
      const termYearName = String((termYear as { name?: string } | null)?.name ?? "");
      if (termYearName) yearNames = [termYearName];
    }
  }

  let subjectIds = [...new Set(
    ((subjectTargetResult.data ?? []) as { subject_id: string }[]).map((item) => item.subject_id),
  )];
  if (isQualifier && !subjectIds.length) {
    // Qualifier sessions created before exam_subject_targets existed have no
    // recoverable subject selection. Keep those existing links usable by
    // falling back to the active qualifier bank instead of treating the exam
    // as missing. New qualifier sessions persist their exact subject targets.
    const { data: qualifierSubjects, error: qualifierSubjectError } = await client
      .from("subjects")
      .select("id")
      .eq("kind", "qualifier")
      .eq("active", true);
    if (qualifierSubjectError) return null;
    subjectIds = [...new Set(((qualifierSubjects ?? []) as { id: string }[]).map((item) => item.id))];
  } else if (!isQualifier) {
    subjectIds = [...new Set(offerings.map((item) => item.subject_id))];
  }

  const classGroup = isQualifier
    ? "Placement"
    : classes.map((item) => item.arm).filter(Boolean).join(", ");
  const placementTracks = ((placementResult.data ?? []) as { track: string }[]).map((item) => displayTrack(item.track));

  return {
    session: {
      id: row.id,
      title: row.title,
      classLevel,
      classGroup,
      academicSession: yearNames.join(", "),
      term: termName,
      mode: row.mode,
      subjectIds,
      placementTracks,
      durationSeconds: Number(row.duration_seconds),
      questionCount: Number(row.question_count),
      status: row.status,
      instructions: row.instructions ?? "",
      startsAt: row.starts_at == null ? null : Number(row.starts_at),
      endsAt: row.ends_at == null ? null : Number(row.ends_at),
      integrityPolicy: {
        focusMonitoring: row.focus_monitoring !== false,
        fullscreenPrompt: row.fullscreen_prompt !== false,
        clipboardGuard: row.clipboard_guard !== false,
        warnAfter: Number(row.warn_after ?? 2),
      },
      randomization: {
        questionOrder: row.question_order !== false,
        optionOrder: row.option_order !== false,
        minimizePaperCollisions: row.minimize_collisions !== false,
      },
    },
    cameraRequired: row.camera_required === true,
  };
}
