"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/student";
import { studentHashFor } from "@/lib/assessment";
import { currentStaff } from "@/lib/auth/staff";

async function requireTask7Admin() {
  const context = await currentStaff();
  if (!context.scope.isAdmin) throw new Error("Administrator sign-in required.");
  return context.supabase;
}

export async function deleteClassSafelyAction(classId: string): Promise<ActionResult> {
  try {
    const supabase = await requireTask7Admin();
    const { count, error: countError } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("role", "student")
      .eq("class_id", classId);
    if (countError) return { ok: false, error: countError.message };
    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error: `Move the ${count} assigned student${count === 1 ? "" : "s"} to another class before deleting this class.`,
      };
    }

    const { error } = await supabase.from("classes").delete().eq("id", classId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/classes");
    revalidatePath("/admin/students");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Delete failed." };
  }
}

function validWhatsappInvite(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "chat.whatsapp.com" || url.hostname === "www.whatsapp.com");
  } catch {
    return false;
  }
}

export async function upsertSingleClassWhatsappAction(input: {
  id?: string;
  classId: string;
  name: string;
  inviteUrl: string;
}): Promise<ActionResult & { id?: string }> {
  try {
    const supabase = await requireTask7Admin();
    if (!input.classId) return { ok: false, error: "Choose a class." };
    if (!input.name.trim()) return { ok: false, error: "Enter a group name." };
    if (!validWhatsappInvite(input.inviteUrl)) {
      return { ok: false, error: "Use an official https://chat.whatsapp.com/ invite link." };
    }

    const { data: conflicts, error: conflictError } = await supabase
      .from("whatsapp_groups")
      .select("id,class_id")
      .eq("class_id", input.classId)
      .limit(2);
    if (conflictError) return { ok: false, error: conflictError.message };
    const conflict = ((conflicts ?? []) as { id: string; class_id: string }[]).find((group) => group.id !== input.id);
    if (conflict) {
      return { ok: false, error: "This class already has a WhatsApp group. Edit the existing class mapping instead." };
    }

    const now = Date.now();
    const id = input.id ?? `WA-${now.toString(36).toUpperCase()}`;
    const row = {
      class_id: input.classId,
      name: input.name.trim().slice(0, 80),
      invite_url: input.inviteUrl.trim(),
      updated_at: now,
    };
    const result = input.id
      ? await supabase.from("whatsapp_groups").update(row).eq("id", input.id)
      : await supabase.from("whatsapp_groups").insert({ ...row, id, created_at: now });
    if (result.error) return { ok: false, error: result.error.message };
    revalidatePath("/admin/classes");
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "WhatsApp group save failed." };
  }
}

export async function getStudentAcademicRecordAction(userId: string) {
  const { supabase, scope } = await currentStaff();
  const { data: user } = await supabase.from("users").select("*").eq("id", userId).eq("role", "student").maybeSingle();
  const student = user as {
    id: string;
    first_name: string;
    last_name: string;
    class_id: string | null;
  } | null;
  if (!student) return { user: null, classRow: null, whatsappGroup: null, attempts: [], stats: [], events: [] };

  const studentHash = await studentHashFor(student.first_name, student.last_name);
  const [{ data: classRow }, { data: whatsapp }, { data: attempts }] = await Promise.all([
    student.class_id
      ? supabase.from("classes").select("*").eq("id", student.class_id).maybeSingle()
      : Promise.resolve({ data: null }),
    student.class_id
      ? supabase.from("whatsapp_groups").select("id,class_id,name,invite_url,updated_at").eq("class_id", student.class_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("exam_attempts")
      .select("attempt_hash,session_id,session_title,class_level,class_group,mode,score,integrity_score,assigned_track,placement_confidence,started_at,submitted_at,rewrite_archived_at,rewrite_source_attempt_hash,created_at")
      .eq("student_hash", studentHash)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const attemptRows = (attempts ?? []) as { attempt_hash: string; session_id: string | null }[];
  const hashes = attemptRows.map((attempt) => attempt.attempt_hash);
  const sessionIds = [...new Set(attemptRows.map((attempt) => attempt.session_id).filter((value): value is string => Boolean(value)))];
  const [{ data: stats }, { data: events }, { data: sessions }] = await Promise.all([
    hashes.length
      ? supabase.from("exam_attempt_subject_stats").select("attempt_hash,subject_code,subject_name,total,correct,seconds,percent").in("attempt_hash", hashes)
      : Promise.resolve({ data: [] }),
    hashes.length
      ? supabase.from("exam_integrity_events").select("attempt_hash,session_id,type,detail,at").in("attempt_hash", hashes).order("at", { ascending: false })
      : Promise.resolve({ data: [] }),
    sessionIds.length
      ? supabase.from("exam_sessions").select("id,title,class_level,class_group,mode,subjects,status").in("id", sessionIds)
      : Promise.resolve({ data: [] }),
  ]);

  // Teachers may inspect student records, but downstream exam detail routes still
  // enforce their own subject/cohost scope. Do not broaden those contracts here.
  void scope;
  return {
    user,
    classRow,
    whatsappGroup: whatsapp,
    attempts: attempts ?? [],
    stats: stats ?? [],
    events: events ?? [],
    sessions: sessions ?? [],
  };
}

export async function getClassAcademicRecordAction(classId: string) {
  const { supabase } = await currentStaff();
  const { data: classRow } = await supabase.from("classes").select("*").eq("id", classId).maybeSingle();
  const cls = classRow as { id: string; class_level: string; stream: string; capacity: number } | null;
  if (!cls) return { classRow: null, students: [], whatsappGroup: null, sessions: [], attempts: [] };

  const [{ data: students }, { data: whatsapp }, { data: sessions }] = await Promise.all([
    supabase.from("users").select("id,full_name,first_name,last_name,status,class_id").eq("role", "student").eq("class_id", classId).order("full_name").limit(500),
    supabase.from("whatsapp_groups").select("id,class_id,name,invite_url,updated_at").eq("class_id", classId).maybeSingle(),
    supabase.from("exam_sessions").select("id,title,class_level,class_group,mode,status,question_count,created_at").eq("class_level", cls.class_level).eq("class_group", cls.stream).order("created_at", { ascending: false }).limit(100),
  ]);
  const sessionIds = ((sessions ?? []) as { id: string }[]).map((session) => session.id);
  const { data: attempts } = sessionIds.length
    ? await supabase.from("exam_attempts").select("attempt_hash,session_id,student_hash,student_name,score,integrity_score,submitted_at,rewrite_archived_at").in("session_id", sessionIds).limit(2000)
    : { data: [] };
  return { classRow, students: students ?? [], whatsappGroup: whatsapp, sessions: sessions ?? [], attempts: attempts ?? [] };
}
