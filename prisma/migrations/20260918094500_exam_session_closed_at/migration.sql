ALTER TABLE "exam_sessions"
ADD COLUMN "closed_at" BIGINT;

CREATE INDEX "exam_sessions_status_closed_at_idx"
ON "exam_sessions"("status", "closed_at");
