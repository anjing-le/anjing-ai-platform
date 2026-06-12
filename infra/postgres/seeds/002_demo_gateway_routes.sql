-- Demo gateway routes for local PostgreSQL mode.

INSERT INTO gateway_routes (id, route, upstream, auth, rate_limit, status)
VALUES
  ('route_llm', '/api/v1/llm/**', 'gateway-api', 'API Key', '1200/min', 'Active'),
  ('route_skill', '/api/v1/skills/**', 'gateway-api', 'API Key', '800/min', 'Active')
ON CONFLICT (id) DO UPDATE
SET
  route = EXCLUDED.route,
  upstream = EXCLUDED.upstream,
  auth = EXCLUDED.auth,
  rate_limit = EXCLUDED.rate_limit,
  status = EXCLUDED.status;
