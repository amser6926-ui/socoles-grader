-- Variant draws. Apply on a fresh database, or on an existing one only after a backup.
-- Rollback drops stored draws and does not restore them:
--   DROP TABLE IF EXISTS assignment_draws;
--   DROP TABLE IF EXISTS assignment_variants;
--   ALTER TABLE assignment_questions DROP COLUMN IF EXISTS variant_id;
--   ALTER TABLE assignments DROP COLUMN IF EXISTS draw_count;

ALTER TABLE assignments ADD COLUMN IF NOT EXISTS draw_count INT NULL;

CREATE TABLE IF NOT EXISTS assignment_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  owner_id UUID REFERENCES instructors(id) ON DELETE CASCADE,
  course_id UUID NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, label)
);

ALTER TABLE assignment_questions
  ADD COLUMN IF NOT EXISTS variant_id UUID NULL REFERENCES assignment_variants(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS assignment_draws (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student TEXT NOT NULL,
  variant_id UUID NOT NULL REFERENCES assignment_variants(id) ON DELETE RESTRICT,
  question_ids UUID[] NOT NULL,
  owner_id UUID REFERENCES instructors(id) ON DELETE CASCADE,
  course_id UUID NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, student, owner_id)
);
