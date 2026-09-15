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
