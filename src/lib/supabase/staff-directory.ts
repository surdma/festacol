import type { SupabaseClient } from "@supabase/supabase-js";
import { listClasses } from "@/lib/supabase/queries";

export interface StaffTeachingScope {
  staffId: string;
  offeringId: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  assignmentRole: string;
}

export async function listStaffTeachingScopes(client: SupabaseClient, staffIds: string[]): Promise<StaffTeachingScope[]> {
  if (!staffIds.length) return [];

  const { data: assignments, error: assignmentError } = await client
    .from("teaching_assignments")
    .select("staff_id,offering_id,assignment_role")
    .in("staff_id", staffIds)
    .is("ended_at", null);
  if (assignmentError) throw new Error(assignmentError.message);

  const assignmentRows = (assignments ?? []) as { staff_id: string; offering_id: string; assignment_role: string }[];
  const offeringIds = [...new Set(assignmentRows.map((row) => row.offering_id))];
  if (!offeringIds.length) return [];

  const [{ data: offerings, error: offeringError }, classes] = await Promise.all([
    client.from("class_subject_offerings").select("id,class_id,subject_id,status").in("id", offeringIds),
    listClasses(client),
  ]);
  if (offeringError) throw new Error(offeringError.message);

  const offeringRows = (offerings ?? []) as { id: string; class_id: string; subject_id: string; status: string }[];
  const subjectIds = [...new Set(offeringRows.map((row) => row.subject_id))];
  const { data: subjects, error: subjectError } = subjectIds.length
    ? await client.from("subjects").select("id,name").in("id", subjectIds)
    : { data: [], error: null };
  if (subjectError) throw new Error(subjectError.message);

  const className = new Map<string, string>(classes.map((row) => [row.id, row.display_name]));
  const subjectName = new Map(((subjects ?? []) as { id: string; name: string }[]).map((row) => [row.id, row.name]));
  const offeringById = new Map(offeringRows.map((row) => [row.id, row]));

  return assignmentRows.flatMap((assignment) => {
    const offering = offeringById.get(assignment.offering_id);
    if (!offering || offering.status === "ended") return [];
    return [{
      staffId: assignment.staff_id,
      offeringId: assignment.offering_id,
      classId: offering.class_id,
      className: className.get(offering.class_id) ?? offering.class_id,
      subjectId: offering.subject_id,
      subjectName: subjectName.get(offering.subject_id) ?? "Subject",
      assignmentRole: assignment.assignment_role,
    }];
  });
}
