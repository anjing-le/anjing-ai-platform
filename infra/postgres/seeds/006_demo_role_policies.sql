-- Demo role policies for local PostgreSQL mode.

INSERT INTO role_policies (id, name, visible_entries, config_scope, restriction, status)
VALUES
  ('role_admin', 'Administrator', 'all', 'all', 'none', 'Active'),
  ('role_user', 'User', 'overview,quota,docs', 'self-service', 'no runtime config', 'Active'),
  ('role_developer', 'Developer', 'overview,gateway,quota,docs', 'gateway routes,model aliases,skill adapters', 'no billing settlement', 'Active'),
  ('role_operator', 'Operator', 'overview,gateway,quota', 'runtime policy', 'no developer-owned route schema', 'Active')
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  visible_entries = EXCLUDED.visible_entries,
  config_scope = EXCLUDED.config_scope,
  restriction = EXCLUDED.restriction,
  status = EXCLUDED.status;
