"use server";

import { getExamEntryContextAction } from "@/app/actions/exam-onboarding";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  examHelpRequestSchema,
  type ExamHelpRequestCategory,
} from "@/lib/validation";

export interface ExamHelpRequestResult {
  ok: boolean;
  duplicate?: boolean;
  error?: string;
}

const CATEGORY_LABELS: Record<ExamHelpRequestCategory, string> = {
  examination_access: "Examination access",
  candidate_identity: "Candidate identity",
  device_browser: "Device or browser",
  other_examination_support: "Other examination support",
};

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export async function requestExamHelpAction(input: {
  token: string;
  requesterName: string;
  category: ExamHelpRequestCategory;
  message: string;
}): Promise<ExamHelpRequestResult> {
  const parsed = examHelpRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Complete the examination support form.",
    };
  }

  const entry = await getExamEntryContextAction(parsed.data.token);
  if (!entry.ok) return { ok: false, error: entry.error };

  const admin = createSupabaseAdminClient();
  const { data: session, error: sessionError } = await admin
    .from("exam_sessions")
    .select("id,created_by_id")
    .eq("id", entry.exam.id)
    .maybeSingle();
  if (sessionError || !session) {
    return { ok: false, error: "This examination could not be resolved." };
  }

  const creatorId = String(session.created_by_id ?? "");
  if (!creatorId) {
    return {
      ok: false,
      error: "The examination support contact is unavailable. Please contact your school directly.",
    };
  }

  const { data: creator, error: creatorError } = await admin
    .from("school_members")
    .select("id,role,status")
    .eq("id", creatorId)
    .maybeSingle();
  if (
    creatorError ||
    !creator ||
    creator.status !== "active" ||
    (creator.role !== "teacher" && creator.role !== "administrator")
  ) {
    return {
      ok: false,
      error: "The examination support contact is unavailable. Please contact your school directly.",
    };
  }

  const requesterName = normalizeName(parsed.data.requesterName);
  const category = CATEGORY_LABELS[parsed.data.category];
  const message = parsed.data.message.trim().replace(/\s+/g, " ");
  const recentCutoff = new Date(Date.now() - 60_000).toISOString();
  const { data: recent } = await admin
    .from("exam_support_requests")
    .select("id")
    .eq("session_id", entry.exam.id)
    .eq("recipient_staff_id", creatorId)
    .eq("requester_name", requesterName)
    .eq("category", category)
    .eq("message", message)
    .gte("created_at", recentCutoff)
    .limit(1)
    .maybeSingle();

  if (recent) return { ok: true, duplicate: true };

  const { error: insertError } = await admin.from("exam_support_requests").insert({
    session_id: entry.exam.id,
    recipient_staff_id: creatorId,
    requester_name: requesterName,
    category,
    message,
  });
  if (insertError) {
    return {
      ok: false,
      error: "Your examination support request could not be sent. Please try again.",
    };
  }

  return { ok: true };
}
