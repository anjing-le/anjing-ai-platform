-- Demo gateway routes for local PostgreSQL mode.

INSERT INTO gateway_routes (id, route, upstream, auth, rate_limit, strategy, upstream_weights, canary_header, canary_value, canary_upstream, status)
VALUES
  ('route_llm', '/api/v1/llm/**', 'gateway-api', 'API Key', '1200/min', 'ordered', '{}'::jsonb, '', '', '', 'Active'),
  ('route_skill', '/api/v1/skills/**', 'gateway-api', 'API Key', '800/min', 'ordered', '{}'::jsonb, '', '', '', 'Active')
ON CONFLICT (id) DO UPDATE
SET
  route = EXCLUDED.route,
  upstream = EXCLUDED.upstream,
  auth = EXCLUDED.auth,
  rate_limit = EXCLUDED.rate_limit,
  strategy = EXCLUDED.strategy,
  upstream_weights = EXCLUDED.upstream_weights,
  canary_header = EXCLUDED.canary_header,
  canary_value = EXCLUDED.canary_value,
  canary_upstream = EXCLUDED.canary_upstream,
  status = EXCLUDED.status;
