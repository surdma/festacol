-- DropForeignKey
ALTER TABLE "academic_terms" DROP CONSTRAINT "academic_terms_academic_year_id_fkey";

-- DropForeignKey
ALTER TABLE "class_enrollments" DROP CONSTRAINT "class_enrollments_class_id_fkey";

-- DropForeignKey
ALTER TABLE "class_enrollments" DROP CONSTRAINT "class_enrollments_student_id_fkey";

-- DropForeignKey
ALTER TABLE "class_subject_offerings" DROP CONSTRAINT "class_subject_offerings_class_id_fkey";

-- DropForeignKey
ALTER TABLE "class_subject_offerings" DROP CONSTRAINT "class_subject_offerings_subject_id_fkey";

-- DropForeignKey
ALTER TABLE "classes" DROP CONSTRAINT "classes_academic_year_id_fkey";

-- DropForeignKey
ALTER TABLE "classes" DROP CONSTRAINT "classes_level_id_fkey";

-- DropForeignKey
ALTER TABLE "exam_attempt_responses" DROP CONSTRAINT "exam_attempt_responses_attempt_id_fkey";

-- DropForeignKey
ALTER TABLE "exam_attempt_responses" DROP CONSTRAINT "exam_attempt_responses_question_id_fkey";

-- DropForeignKey
ALTER TABLE "exam_attempts" DROP CONSTRAINT "exam_attempts_rewrite_source_attempt_id_fkey";

-- DropForeignKey
ALTER TABLE "exam_attempts" DROP CONSTRAINT "exam_attempts_session_id_fkey";

-- DropForeignKey
ALTER TABLE "exam_attempts" DROP CONSTRAINT "exam_attempts_student_id_fkey";

-- DropForeignKey
ALTER TABLE "exam_class_targets" DROP CONSTRAINT "exam_class_targets_class_id_fkey";

-- DropForeignKey
ALTER TABLE "exam_class_targets" DROP CONSTRAINT "exam_class_targets_session_id_fkey";

-- DropForeignKey
ALTER TABLE "exam_integrity_events" DROP CONSTRAINT "exam_integrity_events_attempt_id_fkey";

-- DropForeignKey
ALTER TABLE "exam_offering_targets" DROP CONSTRAINT "exam_offering_targets_offering_id_fkey";

-- DropForeignKey
ALTER TABLE "exam_offering_targets" DROP CONSTRAINT "exam_offering_targets_session_id_fkey";

-- DropForeignKey
ALTER TABLE "exam_placement_tracks" DROP CONSTRAINT "exam_placement_tracks_session_id_fkey";

-- DropForeignKey
ALTER TABLE "exam_qr_codes" DROP CONSTRAINT "exam_qr_codes_link_id_fkey";

-- DropForeignKey
ALTER TABLE "exam_retake_grants" DROP CONSTRAINT "exam_retake_grants_granted_by_id_fkey";

-- DropForeignKey
ALTER TABLE "exam_retake_grants" DROP CONSTRAINT "exam_retake_grants_session_id_fkey";

-- DropForeignKey
ALTER TABLE "exam_retake_grants" DROP CONSTRAINT "exam_retake_grants_student_id_fkey";

-- DropForeignKey
ALTER TABLE "exam_session_links" DROP CONSTRAINT "exam_session_links_session_id_fkey";

-- DropForeignKey
ALTER TABLE "exam_sessions" DROP CONSTRAINT "exam_sessions_academic_term_id_fkey";

-- DropForeignKey
ALTER TABLE "exam_sessions" DROP CONSTRAINT "exam_sessions_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "exam_staff_assignments" DROP CONSTRAINT "exam_staff_assignments_session_id_fkey";

-- DropForeignKey
ALTER TABLE "exam_staff_assignments" DROP CONSTRAINT "exam_staff_assignments_staff_id_fkey";

-- DropForeignKey
ALTER TABLE "exam_student_access" DROP CONSTRAINT "exam_student_access_granted_by_id_fkey";

-- DropForeignKey
ALTER TABLE "exam_student_access" DROP CONSTRAINT "exam_student_access_session_id_fkey";

-- DropForeignKey
ALTER TABLE "exam_student_access" DROP CONSTRAINT "exam_student_access_student_id_fkey";

-- DropForeignKey
ALTER TABLE "question_academic_levels" DROP CONSTRAINT "question_academic_levels_level_id_fkey";

-- DropForeignKey
ALTER TABLE "question_academic_levels" DROP CONSTRAINT "question_academic_levels_question_id_fkey";

-- DropForeignKey
ALTER TABLE "question_blanks" DROP CONSTRAINT "question_blanks_question_id_fkey";

-- DropForeignKey
ALTER TABLE "questions" DROP CONSTRAINT "questions_creator_id_fkey";

-- DropForeignKey
ALTER TABLE "questions" DROP CONSTRAINT "questions_subject_id_fkey";

-- DropForeignKey
ALTER TABLE "staff_subject_qualifications" DROP CONSTRAINT "staff_subject_qualifications_staff_id_fkey";

-- DropForeignKey
ALTER TABLE "staff_subject_qualifications" DROP CONSTRAINT "staff_subject_qualifications_subject_id_fkey";

-- DropForeignKey
ALTER TABLE "student_subject_enrollments" DROP CONSTRAINT "student_subject_enrollments_offering_id_fkey";

-- DropForeignKey
ALTER TABLE "student_subject_enrollments" DROP CONSTRAINT "student_subject_enrollments_student_id_fkey";

-- DropForeignKey
ALTER TABLE "subject_curriculum_rules" DROP CONSTRAINT "subject_curriculum_rules_level_id_fkey";

-- DropForeignKey
ALTER TABLE "subject_curriculum_rules" DROP CONSTRAINT "subject_curriculum_rules_subject_id_fkey";

-- DropForeignKey
ALTER TABLE "teaching_assignments" DROP CONSTRAINT "teaching_assignments_offering_id_fkey";

-- DropForeignKey
ALTER TABLE "teaching_assignments" DROP CONSTRAINT "teaching_assignments_staff_id_fkey";

-- DropForeignKey
ALTER TABLE "whatsapp_groups" DROP CONSTRAINT "whatsapp_groups_class_id_fkey";

-- AlterTable
ALTER TABLE "exam_attempt_responses" ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "exam_attempts" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "exam_sessions" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "questions" ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint;

-- AddForeignKey
ALTER TABLE "academic_terms" ADD CONSTRAINT "academic_terms_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "academic_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_enrollments" ADD CONSTRAINT "class_enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "school_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_enrollments" ADD CONSTRAINT "class_enrollments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_curriculum_rules" ADD CONSTRAINT "subject_curriculum_rules_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_curriculum_rules" ADD CONSTRAINT "subject_curriculum_rules_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "academic_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_subject_offerings" ADD CONSTRAINT "class_subject_offerings_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_subject_offerings" ADD CONSTRAINT "class_subject_offerings_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_subject_enrollments" ADD CONSTRAINT "student_subject_enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "school_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_subject_enrollments" ADD CONSTRAINT "student_subject_enrollments_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "class_subject_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_subject_qualifications" ADD CONSTRAINT "staff_subject_qualifications_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "school_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_subject_qualifications" ADD CONSTRAINT "staff_subject_qualifications_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_assignments" ADD CONSTRAINT "teaching_assignments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "school_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_assignments" ADD CONSTRAINT "teaching_assignments_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "class_subject_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_sessions" ADD CONSTRAINT "exam_sessions_academic_term_id_fkey" FOREIGN KEY ("academic_term_id") REFERENCES "academic_terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_sessions" ADD CONSTRAINT "exam_sessions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "school_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_class_targets" ADD CONSTRAINT "exam_class_targets_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "exam_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_class_targets" ADD CONSTRAINT "exam_class_targets_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_offering_targets" ADD CONSTRAINT "exam_offering_targets_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "exam_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_offering_targets" ADD CONSTRAINT "exam_offering_targets_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "class_subject_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_placement_tracks" ADD CONSTRAINT "exam_placement_tracks_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "exam_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_session_links" ADD CONSTRAINT "exam_session_links_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "exam_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_qr_codes" ADD CONSTRAINT "exam_qr_codes_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "exam_session_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_staff_assignments" ADD CONSTRAINT "exam_staff_assignments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "exam_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_staff_assignments" ADD CONSTRAINT "exam_staff_assignments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "school_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_student_access" ADD CONSTRAINT "exam_student_access_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "exam_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_student_access" ADD CONSTRAINT "exam_student_access_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "school_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_student_access" ADD CONSTRAINT "exam_student_access_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "school_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_retake_grants" ADD CONSTRAINT "exam_retake_grants_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "exam_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_retake_grants" ADD CONSTRAINT "exam_retake_grants_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "school_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_retake_grants" ADD CONSTRAINT "exam_retake_grants_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "school_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "exam_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "school_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_rewrite_source_attempt_id_fkey" FOREIGN KEY ("rewrite_source_attempt_id") REFERENCES "exam_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempt_responses" ADD CONSTRAINT "exam_attempt_responses_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempt_responses" ADD CONSTRAINT "exam_attempt_responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_integrity_events" ADD CONSTRAINT "exam_integrity_events_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "school_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_academic_levels" ADD CONSTRAINT "question_academic_levels_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_academic_levels" ADD CONSTRAINT "question_academic_levels_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "academic_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_blanks" ADD CONSTRAINT "question_blanks_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_groups" ADD CONSTRAINT "whatsapp_groups_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "class_enrollments_class_status_idx" RENAME TO "class_enrollments_class_id_status_idx";

-- RenameIndex
ALTER INDEX "class_subject_offerings_subject_status_idx" RENAME TO "class_subject_offerings_subject_id_status_idx";

-- RenameIndex
ALTER INDEX "exam_attempts_session_created_idx" RENAME TO "exam_attempts_session_id_created_at_idx";

-- RenameIndex
ALTER INDEX "exam_attempts_student_created_idx" RENAME TO "exam_attempts_student_id_created_at_idx";

-- RenameIndex
ALTER INDEX "exam_integrity_events_attempt_at_idx" RENAME TO "exam_integrity_events_attempt_id_at_idx";

-- RenameIndex
ALTER INDEX "exam_offering_targets_offering_idx" RENAME TO "exam_offering_targets_offering_id_idx";

-- RenameIndex
ALTER INDEX "exam_retake_grants_lookup_idx" RENAME TO "exam_retake_grants_session_id_student_id_revoked_at_expires_idx";

-- RenameIndex
ALTER INDEX "exam_session_links_active_expiry_idx" RENAME TO "exam_session_links_active_expires_at_idx";

-- RenameIndex
ALTER INDEX "exam_sessions_creator_idx" RENAME TO "exam_sessions_created_by_id_idx";

-- RenameIndex
ALTER INDEX "exam_sessions_status_window_idx" RENAME TO "exam_sessions_status_starts_at_ends_at_idx";

-- RenameIndex
ALTER INDEX "question_academic_levels_level_idx" RENAME TO "question_academic_levels_level_id_idx";

-- RenameIndex
ALTER INDEX "questions_subject_idx" RENAME TO "questions_subject_id_idx";

-- RenameIndex
ALTER INDEX "school_members_name_role_status_idx" RENAME TO "school_members_last_name_first_name_role_status_idx";

-- RenameIndex
ALTER INDEX "staff_subject_qualifications_subject_active_idx" RENAME TO "staff_subject_qualifications_subject_id_active_idx";

-- RenameIndex
ALTER INDEX "student_subject_enrollments_offering_status_idx" RENAME TO "student_subject_enrollments_offering_id_status_idx";

-- RenameIndex
ALTER INDEX "subject_curriculum_rules_lookup_idx" RENAME TO "subject_curriculum_rules_level_id_track_participation_idx";

-- RenameIndex
ALTER INDEX "teaching_assignments_offering_active_idx" RENAME TO "teaching_assignments_offering_id_ended_at_idx";

-- RenameIndex
ALTER INDEX "whatsapp_groups_class_idx" RENAME TO "whatsapp_groups_class_id_idx";
