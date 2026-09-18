-- The application contract has always allowed examinations up to four hours
-- and 200 questions. The original database checks were narrower (three hours
-- and 150 questions), which caused valid administrator edits to fail at write
-- time. Keep the original lower bounds while aligning the persisted maxima
-- with the validated server/UI contract.

ALTER TABLE "exam_sessions"
  DROP CONSTRAINT "exam_sessions_duration_check";

ALTER TABLE "exam_sessions"
  ADD CONSTRAINT "exam_sessions_duration_check"
  CHECK ("duration_seconds" BETWEEN 30 AND 14400);

ALTER TABLE "exam_sessions"
  DROP CONSTRAINT "exam_sessions_question_count_check";

ALTER TABLE "exam_sessions"
  ADD CONSTRAINT "exam_sessions_question_count_check"
  CHECK ("question_count" BETWEEN 1 AND 200);
