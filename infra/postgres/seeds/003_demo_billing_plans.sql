-- Demo billing plans for local PostgreSQL mode.

INSERT INTO billing_plans (id, name, target, rps, token_per_day, status)
VALUES
  ('plan_free', 'Free', 'trial users', '20', '50K', 'Active'),
  ('plan_business', 'Business', 'production agents', '1200', '10M', 'Active')
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  target = EXCLUDED.target,
  rps = EXCLUDED.rps,
  token_per_day = EXCLUDED.token_per_day,
  status = EXCLUDED.status;
