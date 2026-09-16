"use server";

import { randomBytes } from "node:crypto";
import { currentStaff } from "@/lib/auth/staff";
import { getExamLink } from "@/lib/exam-links";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface ExamAccessLinkResult {
  ok: boolean;
  path?: string;
  qrRevision?: number;
  error?: string;
}

function newToken() {
  return randomBytes(32).toString("base64url");
}

export async function getExamAccessLinkAction(examIdValue: string): Promise<ExamAccessLinkResult> {
  try {
    const { supabase, scope } = await currentStaff();
    if (!scope.profileId) return { ok: false, error: "Staff sign-in required." };

    const examId = String(examIdValue ?? "").trim().toUpperCase();
    if (!examId) return { ok: false, error: "Examination ID is required." };

    // Verify the signed-in staff member can see this examination before using
    // the service-role client to maintain its opaque navigation link.
    const { data: visibleSession, error: visibilityError } = await supabase
      .from("exam_sessions")
      .select("id")
      .eq("id", examId)
      .maybeSingle();
    if (visibilityError || !visibleSession) {
      return { ok: false, error: "Examination is unavailable or outside your scope." };
    }

    const admin = createSupabaseAdminClient();
    const now = new Date();
    const { data: existing, error: readError } = await admin
      .from("exam_session_links")
      .select("id,token,active,expires_at")
      .eq("session_id", examId)
      .maybeSingle();
    if (readError) return { ok: false, error: "Exam access link could not be read." };

    const existingExpiry = existing?.expires_at ? new Date(String(existing.expires_at)) : null;
    const reusable = Boolean(existing?.active && (!existingExpiry || existingExpiry.getTime() > now.getTime()));
    let linkId = existing?.id ? String(existing.id) : "";
    let token = reusable && existing?.token ? String(existing.token) : newToken();

    if (existing) {
      if (!reusable) {
        const { data: updated, error } = await admin
          .from("exam_session_links")
          .update({ token, active: true, expires_at: null, updated_at: now.toISOString() })
          .eq("id", existing.id)
          .select("id,token")
          .single();
        if (error || !updated) return { ok: false, error: "Exam access link could not be refreshed." };
        linkId = String(updated.id);
        token = String(updated.token);
      }
    } else {
      const { data: created, error } = await admin
        .from("exam_session_links")
        .insert({ session_id: examId, token, active: true })
        .select("id,token")
        .single();
      if (error || !created) return { ok: false, error: "Exam access link could not be created." };
      linkId = String(created.id);
      token = String(created.token);
    }

    const path = getExamLink(token);
    const { data: currentQr, error: qrReadError } = await admin
      .from("exam_qr_codes")
      .select("id,revision,rendered_data")
      .eq("link_id", linkId)
      .maybeSingle();
    if (qrReadError) return { ok: false, error: "Exam QR payload could not be read." };

    let qrRevision = Number(currentQr?.revision ?? 1);
    if (!currentQr) {
      const { data: createdQr, error } = await admin
        .from("exam_qr_codes")
        .insert({ link_id: linkId, revision: 1, content_type: "text/uri-list", rendered_data: path })
        .select("revision")
        .single();
      if (error || !createdQr) return { ok: false, error: "Exam QR payload could not be created." };
      qrRevision = Number(createdQr.revision);
    } else if (String(currentQr.rendered_data ?? "") !== path) {
      qrRevision += 1;
      const { error } = await admin
        .from("exam_qr_codes")
        .update({ revision: qrRevision, content_type: "text/uri-list", rendered_data: path, updated_at: now.toISOString() })
        .eq("id", currentQr.id);
      if (error) return { ok: false, error: "Exam QR payload could not be refreshed." };
    }

    return { ok: true, path, qrRevision };
  } catch {
    return { ok: false, error: "Exam access link could not be prepared." };
  }
}
