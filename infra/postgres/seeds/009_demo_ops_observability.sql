-- Demo operations health and audit events for local PostgreSQL mode.

INSERT INTO service_health (id, name, slo, p95, status)
VALUES
  ('health_gateway', 'gateway-api', '99.97%', '82ms', 'Normal'),
  ('health_model', 'model routing', '99.21%', '245ms', 'Degraded'),
  ('health_billing', 'billing-service', '99.99%', '1.4s lag', 'Normal')
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  slo = EXCLUDED.slo,
  p95 = EXCLUDED.p95,
  status = EXCLUDED.status;

INSERT INTO audit_events (id, module, action, object, status, request_id)
VALUES
  ('audit_role', '用户与权限', 'role granted', 'dev-api@anjing.ai', 'Success', 'req_seed_1'),
  ('audit_skill', '网关与模型', 'skill published', 'search-knowledge v1.4.0', 'Success', 'req_seed_2')
ON CONFLICT (id) DO UPDATE
SET
  module = EXCLUDED.module,
  action = EXCLUDED.action,
  object = EXCLUDED.object,
  status = EXCLUDED.status,
  request_id = EXCLUDED.request_id;
