-- Demo applications for local PostgreSQL mode.

INSERT INTO applications (id, name, owner, environment, api_key, default_route, plan, status)
VALUES
  ('app_customer', 'customer-service-agent', 'lin.chen@anjing.ai', 'Production', 'ak_live_customer', '/api/v1/llm/**', 'Business', 'Active'),
  ('app_knowledge', 'knowledge-rag', 'dev-api@anjing.ai', 'Production', 'ak_live_knowledge', '/api/v1/skills/**', 'Business', 'Active'),
  ('app_aigc', 'aigc-lab', 'dev-api@anjing.ai', 'Sandbox', 'ak_live_aigc_lab', '/api/v1/llm/**', 'Free', 'Warning')
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  owner = EXCLUDED.owner,
  environment = EXCLUDED.environment,
  api_key = EXCLUDED.api_key,
  default_route = EXCLUDED.default_route,
  plan = EXCLUDED.plan,
  status = EXCLUDED.status;
