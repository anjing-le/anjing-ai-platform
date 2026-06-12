-- Demo users for local PostgreSQL mode.

INSERT INTO users (id, email, org, role, mfa, status)
VALUES
  ('usr_admin', 'lin.chen@anjing.ai', 'Platform', 'Administrator', 'Enabled', 'Active'),
  ('usr_dev', 'dev-api@anjing.ai', 'Engineering', 'Developer', 'Enabled', 'Active')
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  org = EXCLUDED.org,
  role = EXCLUDED.role,
  mfa = EXCLUDED.mfa,
  status = EXCLUDED.status;
