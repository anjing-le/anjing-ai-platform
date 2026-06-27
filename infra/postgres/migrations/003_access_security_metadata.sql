-- Access security metadata keeps public control surfaces safe to display.

ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS masked_preview TEXT NOT NULL DEFAULT '';

ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS rotated_at TIMESTAMPTZ;

ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

UPDATE api_keys
SET masked_preview = concat(left(name, 2), '-****-', right(name, 4))
WHERE masked_preview = '';

CREATE INDEX IF NOT EXISTS idx_api_keys_project ON api_keys (project);
CREATE INDEX IF NOT EXISTS idx_api_keys_status ON api_keys (status);

ALTER TABLE credentials
  ADD COLUMN IF NOT EXISTS rotated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_credentials_status ON credentials (status);
