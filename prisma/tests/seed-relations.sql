-- Canonical-schema and seed assertions. Run after prisma migrate deploy + db seed.
DO $$
DECLARE
  v_count integer;
BEGIN
  IF to_regclass('public.school_members') IS NULL THEN
    RAISE EXCEPTION 'canonical_school_members_missing';
  END IF;

  IF to_regclass('public.academic_profiles') IS NOT NULL
     OR to_regclass('public.student_academic_profiles') IS NOT NULL
     OR to_regclass('public.staff_academic_profiles') IS NOT NULL
     OR to_regclass('public.academic_programmes') IS NOT NULL
     OR to_regclass('public.exam_placement_programmes') IS NOT NULL
     OR to_regclass('public.exam_attempt_runtime_states') IS NOT NULL
     OR to_regclass('public.exam_attempt_answers') IS NOT NULL THEN
    RAISE EXCEPTION 'legacy_or_duplicate_table_survived';
  END IF;

  SELECT count(*) INTO v_count FROM public.academic_levels;
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'expected_3_academic_levels_got_%',v_count;
  END IF;

  SELECT count(*) INTO v_count FROM public.classes;
  IF v_count <> 9 THEN
    RAISE EXCEPTION 'expected_9_seed_classes_got_%',v_count;
  END IF;

  SELECT count(*) INTO v_count FROM public.subjects;
  IF v_count < 40 THEN
    RAISE EXCEPTION 'subject_catalog_too_small_%',v_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.class_subject_offerings o
    JOIN public.subjects s ON s.id=o.subject_id
    WHERE s.kind='qualifier'
  ) THEN
    RAISE EXCEPTION 'qualifier_subject_was_offered_as_senior_curriculum';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.class_subject_offerings o
    JOIN public.classes c ON c.id=o.class_id
    JOIN public.subjects s ON s.id=o.subject_id
    WHERE s.code='chem' AND c.track <> 'science'
  ) THEN
    RAISE EXCEPTION 'chemistry_offered_outside_science';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.class_subject_offerings o
    JOIN public.classes c ON c.id=o.class_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.subject_curriculum_rules r
      WHERE r.subject_id=o.subject_id
        AND r.level_id=c.level_id
        AND r.track=c.track
    )
  ) THEN
    RAISE EXCEPTION 'offering_without_matching_curriculum_rule';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.classes c
    CROSS JOIN (VALUES ('eng'),('mat'),('civ'),('comp')) core(code)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.class_subject_offerings o
      JOIN public.subjects s ON s.id=o.subject_id
      WHERE o.class_id=c.id
        AND s.code=core.code
        AND o.status='active'
    )
  ) THEN
    RAISE EXCEPTION 'class_missing_required_core_offering';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.questions q
    WHERE NOT EXISTS (
      SELECT 1 FROM public.question_academic_levels l WHERE l.question_id=q.id
    )
  ) THEN
    RAISE EXCEPTION 'question_without_academic_level_relation';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.class_subject_offerings o
    WHERE NOT EXISTS (SELECT 1 FROM public.classes c WHERE c.id=o.class_id)
       OR NOT EXISTS (SELECT 1 FROM public.subjects s WHERE s.id=o.subject_id)
  ) THEN
    RAISE EXCEPTION 'offering_fk_graph_incomplete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.questions q
    WHERE NOT EXISTS (SELECT 1 FROM public.subjects s WHERE s.id=q.subject_id)
  ) THEN
    RAISE EXCEPTION 'question_subject_fk_graph_incomplete';
  END IF;
END $$;
