-- Anjing AI Platform V1 core schema.
-- IDs are text so local seeds and public examples stay easy to read.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  org TEXT NOT NULL,
  role TEXT NOT NULL,
  mfa TEXT NOT NULL DEFAULT 'Pending',
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_policies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  visible_entries TEXT NOT NULL,
  config_scope TEXT NOT NULL,
  restriction TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active'
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  project TEXT NOT NULL,
  scope TEXT NOT NULL,
  expires_at DATE,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS credentials (
  id TEXT PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL,
  scope TEXT NOT NULL,
  expires_at DATE,
  status TEXT NOT NULL DEFAULT 'Active',
  masked_preview TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS gateway_routes (
  id TEXT PRIMARY KEY,
  route TEXT NOT NULL UNIQUE,
  upstream TEXT NOT NULL,
  auth TEXT NOT NULL,
  rate_limit TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS model_routes (
  id TEXT PRIMARY KEY,
  alias TEXT NOT NULL UNIQUE,
  scenario TEXT NOT NULL,
  primary_model TEXT NOT NULL,
  fallback_model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS skill_bindings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  protocol TEXT NOT NULL,
  route TEXT NOT NULL,
  timeout TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS request_logs (
  id TEXT PRIMARY KEY,
  request TEXT NOT NULL,
  consumer TEXT NOT NULL,
  latency TEXT NOT NULL,
  result TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  target TEXT NOT NULL,
  rps TEXT NOT NULL,
  token_per_day TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active'
);

CREATE TABLE IF NOT EXISTS usage_records (
  id TEXT PRIMARY KEY,
  project TEXT NOT NULL,
  tokens TEXT NOT NULL,
  skill_calls TEXT NOT NULL,
  cost TEXT NOT NULL,
  status TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS budget_alerts (
  id TEXT PRIMARY KEY,
  project TEXT NOT NULL,
  budget TEXT NOT NULL,
  current TEXT NOT NULL,
  threshold TEXT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ops_todos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  owner TEXT NOT NULL,
  status TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_health (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slo TEXT NOT NULL,
  p95 TEXT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  event_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  object TEXT NOT NULL,
  status TEXT NOT NULL,
  request_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON request_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_time ON audit_events (event_time DESC);
CREATE INDEX IF NOT EXISTS idx_usage_records_project ON usage_records (project);
CREATE INDEX IF NOT EXISTS idx_ops_todos_status ON ops_todos (status);
