-- Demo model routes, skills and request logs for local PostgreSQL mode.

INSERT INTO model_routes (id, alias, scenario, primary_model, fallback_model, status)
VALUES
  ('model_chat_default', 'chat-default', '客服 Agent', 'gpt-4.1-mini', 'claude-haiku', 'Active'),
  ('model_embedding_default', 'embedding-default', 'RAG', 'text-embedding-3', 'local-bge', 'Active')
ON CONFLICT (id) DO UPDATE
SET
  alias = EXCLUDED.alias,
  scenario = EXCLUDED.scenario,
  primary_model = EXCLUDED.primary_model,
  fallback_model = EXCLUDED.fallback_model,
  status = EXCLUDED.status;

INSERT INTO skill_bindings (id, name, protocol, route, timeout, status)
VALUES
  ('skill_search', 'search-knowledge', 'MCP', '/api/v1/skills/search', '8s', 'Published'),
  ('skill_message', 'send-message', 'HTTP', '/api/v1/skills/send-message', '8s', 'Draft')
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  protocol = EXCLUDED.protocol,
  route = EXCLUDED.route,
  timeout = EXCLUDED.timeout,
  status = EXCLUDED.status;

INSERT INTO request_logs (id, request, consumer, latency, result, status)
VALUES
  ('req_chat', 'POST /llm/chat', 'customer-service-agent', '76ms', '200', 'Success'),
  ('req_skill', 'POST /skills/search', 'knowledge-rag', '118ms', '200', 'Success')
ON CONFLICT (id) DO UPDATE
SET
  request = EXCLUDED.request,
  consumer = EXCLUDED.consumer,
  latency = EXCLUDED.latency,
  result = EXCLUDED.result,
  status = EXCLUDED.status;
