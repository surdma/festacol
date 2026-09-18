"use server";

import { currentStaff } from "@/lib/auth/staff";
import { listClasses } from "@/lib/supabase/queries";
import type { AcademicTrack } from "@/types/db";

export interface ExamRelationSummary {
  subjectNames: string[];
  targetLabels: string[];
  cohostIds: string[];
  placementTracks: AcademicTrack[];
}

export async function getExamRelationSummaryAction(examId: string): Promise<ExamRelationSummary | null> {
  const { supabase, scope } = await currentStaff();
  if (!scope.profileId) return null;
  const sessionId = examId.toUpperCase();
  const { data: session } = await supabase.from("exam_sessions").select("id").eq("id", sessionId).maybeSingle();
  if (!session) return null;

  const [offeringTargetsResult, subjectTargetsResult, classTargetsResult, cohostsResult, placementResult, classes] = await Promise.all([
    supabase.from("exam_offering_targets").select("offering_id").eq("session_id", sessionId),
    supabase.from("exam_subject_targets").select("subject_id").eq("session_id", sessionId),
    supabase.from("exam_class_targets").select("class_id").eq("session_id", sessionId),
    supabase.from("exam_staff_assignments").select("staff_id").eq("session_id", sessionId).eq("role", "cohost"),
    supabase.from("exam_placement_tracks").select("track").eq("session_id", sessionId),
    listClasses(supabase),
  ]);

  const offeringIds = ((offeringTargetsResult.data ?? []) as { offering_id: string }[]).map((row) => row.offering_id);
  const { data: offerings } = offeringIds.length
    ? await supabase.from("class_subject_offerings").select("id,class_id,subject_id").in("id", offeringIds)
    : { data: [] };
  const offeringRows = (offerings ?? []) as { id: string; class_id: string; subject_id: string }[];
  const subjectIds = [...new Set([
    ...((subjectTargetsResult.data ?? []) as { subject_id: string }[]).map((row) => row.subject_id),
    ...offeringRows.map((row) => row.subject_id),
  ])];
  const { data: subjects } = subjectIds.length
    ? await supabase.from("subjects").select("id,name").in("id", subjectIds)
    : { data: [] };
  const subjectNames = ((subjects ?? []) as { id: string; name: string }[])
    .map((row) => row.name)
    .sort((a, b) => a.localeCompare(b));

  const explicitClassIds = ((classTargetsResult.data ?? []) as { class_id: string }[]).map((row) => row.class_id);
  const targetedClassIds = new Set([...explicitClassIds, ...offeringRows.map((row) => row.class_id)]);
  const targetLabels = classes
    .filter((row) => targetedClassIds.has(row.id))
    .map((row) => row.display_name)
    .sort((a, b) => a.localeCompare(b));

  return {
    subjectNames,
    targetLabels,
    cohostIds: ((cohostsResult.data ?? []) as { staff_id: string }[]).map((row) => row.staff_id),
    placementTracks: ((placementResult.data ?? []) as { track: AcademicTrack }[]).map((row) => row.track),
  };
}
