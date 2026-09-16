-- Festacol member hard-delete audit record.
-- The only retained row after an admin hard-delete (auth user + member +
-- attempts/results removed by design). Deliberately free of foreign keys so the
-- ordered cascade in hardDeleteMemberAction can never remove or block it.

CREATE TABLE member_deletion_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_member_id uuid NOT NULL,
  target_role text NOT NULL,
  target_name text NOT NULL,
  target_student_number text,
  deleted_by_id uuid,
  reason text NOT NULL DEFAULT '',
  attempt_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX member_deletion_audits_target_idx ON member_deletion_audits(target_member_id);
