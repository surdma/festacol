-- Candidate examination-access support requests.
-- Requests are created only by the trusted server action after the opaque
-- examination link has been revalidated. Authenticated clients receive no
-- direct table privileges; staff notifications are read server-side.

CREATE TABLE exam_support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  recipient_staff_id uuid NOT NULL,
  requester_name text NOT NULL,
  category text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exam_support_requests_session_fk
    FOREIGN KEY (session_id) REFERENCES exam_sessions(id) ON DELETE CASCADE,
  CONSTRAINT exam_support_requests_recipient_fk
    FOREIGN KEY (recipient_staff_id) REFERENCES school_members(id) ON DELETE CASCADE,
  CONSTRAINT exam_support_requests_requester_name_length
    CHECK (char_length(trim(requester_name)) BETWEEN 2 AND 80),
  CONSTRAINT exam_support_requests_category_check
    CHECK (category IN (
      'Examination access',
      'Candidate identity',
      'Device or browser',
      'Other examination support'
    )),
  CONSTRAINT exam_support_requests_message_length
    CHECK (char_length(trim(message)) BETWEEN 6 AND 500)
);

CREATE INDEX exam_support_requests_recipient_created_idx
  ON exam_support_requests(recipient_staff_id, created_at DESC);
CREATE INDEX exam_support_requests_session_created_idx
  ON exam_support_requests(session_id, created_at DESC);

ALTER TABLE exam_support_requests ENABLE ROW LEVEL SECURITY;
