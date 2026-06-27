-- Demo API keys and credentials for local PostgreSQL mode.

INSERT INTO api_keys (id, name, project, scope, expires_at, status, masked_preview, last_used_at)
VALUES
  ('key_customer', 'ak_live_customer', 'customer-service-agent', 'llm:chat skill:invoke', '2026-09-01', 'Active', 'ak-****-omer', now()),
  ('key_knowledge', 'ak_live_knowledge', 'knowledge-rag', 'llm:embedding skill:read', '2026-08-15', 'Active', 'ak-****-edge', now())
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  project = EXCLUDED.project,
  scope = EXCLUDED.scope,
  expires_at = EXCLUDED.expires_at,
  status = EXCLUDED.status,
  masked_preview = EXCLUDED.masked_preview,
  last_used_at = EXCLUDED.last_used_at;

INSERT INTO credentials (id, ref, purpose, scope, expires_at, status, masked_preview, rotated_at)
VALUES
  ('cred_openai', 'cred.openai.default', 'LLM provider', 'Gateway / Model', '2026-07-01', 'Active', 'sk-****-4f2a', null),
  ('cred_claude', 'cred.claude.backup', 'LLM fallback', 'Gateway / Model', '2026-06-28', 'Expiring', 'sk-****-91cb', null)
ON CONFLICT (id) DO UPDATE
SET
  ref = EXCLUDED.ref,
  purpose = EXCLUDED.purpose,
  scope = EXCLUDED.scope,
  expires_at = EXCLUDED.expires_at,
  status = EXCLUDED.status,
  masked_preview = EXCLUDED.masked_preview,
  rotated_at = EXCLUDED.rotated_at;
