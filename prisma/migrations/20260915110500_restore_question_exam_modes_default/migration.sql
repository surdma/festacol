-- Relational v3 converts questions.exam_modes to exam_mode[]. Restore the
-- canonical empty enum-array default expected by prisma/schema.prisma.
ALTER TABLE public.questions
  ALTER COLUMN exam_modes SET DEFAULT '{}'::exam_mode[];
