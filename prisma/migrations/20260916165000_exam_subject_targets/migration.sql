-- Persist direct subject selection for qualifier/placement examinations.
-- Curriculum exams continue to derive subjects from class-subject offering targets.

CREATE TABLE exam_subject_targets (
  session_id text NOT NULL,
  subject_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exam_subject_targets_pkey PRIMARY KEY (session_id, subject_id),
  CONSTRAINT exam_subject_targets_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES exam_sessions(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT exam_subject_targets_subject_id_fkey
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX exam_subject_targets_subject_id_idx ON exam_subject_targets(subject_id);
