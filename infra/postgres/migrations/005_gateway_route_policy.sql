-- Persist gateway route traffic policy for V1 routing.

ALTER TABLE gateway_routes
  ADD COLUMN IF NOT EXISTS strategy TEXT NOT NULL DEFAULT 'ordered',
  ADD COLUMN IF NOT EXISTS upstream_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS canary_header TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS canary_value TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS canary_upstream TEXT NOT NULL DEFAULT '';

UPDATE gateway_routes
SET
  strategy = COALESCE(NULLIF(strategy, ''), 'ordered'),
  upstream_weights = COALESCE(upstream_weights, '{}'::jsonb),
  canary_header = COALESCE(canary_header, ''),
  canary_value = COALESCE(canary_value, ''),
  canary_upstream = COALESCE(canary_upstream, '');
