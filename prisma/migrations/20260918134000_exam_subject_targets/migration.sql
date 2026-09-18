CREATE TABLE "exam_subject_targets" (
  "session_id" TEXT NOT NULL,
  "subject_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exam_subject_targets_pkey" PRIMARY KEY ("session_id","subject_id")
);

CREATE INDEX "exam_subject_targets_subject_id_idx" ON "exam_subject_targets"("subject_id");

ALTER TABLE "exam_subject_targets"
  ADD CONSTRAINT "exam_subject_targets_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "exam_sessions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "exam_subject_targets"
  ADD CONSTRAINT "exam_subject_targets_subject_id_fkey"
  FOREIGN KEY ("subject_id") REFERENCES "subjects"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill curriculum exams from their concrete offering targets so existing
-- sessions immediately gain an explicit subject contract.
INSERT INTO "exam_subject_targets" ("session_id","subject_id")
SELECT DISTINCT target."session_id", offering."subject_id"
FROM "exam_offering_targets" target
JOIN "class_subject_offerings" offering ON offering."id" = target."offering_id"
ON CONFLICT ("session_id","subject_id") DO NOTHING;
