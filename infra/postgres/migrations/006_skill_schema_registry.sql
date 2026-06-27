CREATE TABLE IF NOT EXISTS skill_schemas (
  id TEXT PRIMARY KEY,
  skill_name TEXT NOT NULL,
  version TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  required_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  optional_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'Draft',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (skill_name, version)
);
