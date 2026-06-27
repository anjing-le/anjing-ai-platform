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

INSERT INTO skill_bindings (id, name, protocol, route, timeout, schema_version, status)
VALUES
  ('skill_search', 'search-knowledge', 'MCP', '/api/v1/skills/search', '8s', '0.1', 'Published'),
  ('skill_message', 'send-message', 'HTTP', '/api/v1/skills/send-message', '8s', '0.1', 'Draft')
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  protocol = EXCLUDED.protocol,
  route = EXCLUDED.route,
  timeout = EXCLUDED.timeout,
  schema_version = EXCLUDED.schema_version,
  status = EXCLUDED.status;

INSERT INTO skill_schemas (id, skill_name, version, description, required_fields, optional_fields, status)
VALUES
  (
    'schema_search_knowledge_v01',
    'search-knowledge',
    '0.1',
    'Knowledge retrieval input contract',
    '[{"name":"query","type":"string","description":"Search query"}]'::jsonb,
    '[{"name":"topK","type":"number","description":"Maximum result count"}]'::jsonb,
    'Published'
  ),
  (
    'schema_send_message_v01',
    'send-message',
    '0.1',
    'Outbound message input contract',
    '[{"name":"target","type":"string","description":"Recipient or channel target"},{"name":"content","type":"string","description":"Message content"}]'::jsonb,
    '[{"name":"channel","type":"string","description":"Delivery channel"}]'::jsonb,
    'Draft'
  ),
  (
    'schema_generate_image_v02',
    'generate-image',
    '0.2',
    'Image generation prompt contract',
    '[{"name":"prompt","type":"string","description":"Generation prompt"}]'::jsonb,
    '[{"name":"size","type":"string","description":"Image size"},{"name":"style","type":"string","description":"Visual style"}]'::jsonb,
    'Published'
  )
ON CONFLICT (id) DO UPDATE
SET
  skill_name = EXCLUDED.skill_name,
  version = EXCLUDED.version,
  description = EXCLUDED.description,
  required_fields = EXCLUDED.required_fields,
  optional_fields = EXCLUDED.optional_fields,
  status = EXCLUDED.status,
  updated_at = now();

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
