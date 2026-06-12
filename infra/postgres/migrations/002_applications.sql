-- Application onboarding sits in control-api because it owns access subjects and API keys.

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  owner TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'Sandbox',
  api_key TEXT NOT NULL,
  default_route TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'Free',
  status TEXT NOT NULL DEFAULT 'Provisioning',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_applications_owner ON applications (owner);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications (status);
