"use server";

import { getStudentAcademicRecordAction } from "@/app/actions/academic-records";
import { currentStaff } from "@/lib/auth/staff";
import { listClasses } from "@/lib/supabase/queries";

interface EnrollmentHistoryRow {
  id: string;
  class_id: string;
  status: string;
  enrolled_at: string;
  ended_at: string | null;
}

export async function getStudentDossierAction(userId: string) {
  const base = await getStudentAcademicRecordAction(userId);
  if (!base.user) return { ...base, enrollmentHistory: [] };

  const { supabase } = await currentStaff();
  const [{ data: enrollments, error }, classes] = await Promise.all([
    supabase
      .from("class_enrollments")
      .select("id,class_id,status,enrolled_at,ended_at")
      .eq("student_id", userId)
      .order("enrolled_at", { ascending: true })
      .limit(50),
    listClasses(supabase),
  ]);
  if (error) throw new Error(error.message);

  const classById = new Map<string, { display_name: string; level_name: string; track_name: string; academic_year_name: string }>(
    classes.map((row) => [row.id, row]),
  );
  const enrollmentHistory = ((enrollments ?? []) as EnrollmentHistoryRow[]).map((row) => {
    const classRow = classById.get(row.class_id);
    return {
      id: row.id,
      classId: row.class_id,
      className: classRow?.display_name ?? row.class_id,
      levelName: classRow?.level_name ?? "",
      trackName: classRow?.track_name ?? "",
      academicYear: classRow?.academic_year_name ?? "",
      status: row.status,
      enrolledAt: row.enrolled_at,
      endedAt: row.ended_at,
    };
  });

  return { ...base, enrollmentHistory };
}
