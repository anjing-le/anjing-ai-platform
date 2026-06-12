-- Demo usage and budget alerts for local PostgreSQL mode.

INSERT INTO usage_records (id, project, tokens, skill_calls, cost, status)
VALUES
  ('usage_customer', 'customer-service-agent', '2.4M', '18.2K', '$241', 'Normal'),
  ('usage_aigc', 'aigc-lab', '3.1M', '4.8K', '$312', 'Warning')
ON CONFLICT (id) DO UPDATE
SET
  project = EXCLUDED.project,
  tokens = EXCLUDED.tokens,
  skill_calls = EXCLUDED.skill_calls,
  cost = EXCLUDED.cost,
  status = EXCLUDED.status;

INSERT INTO budget_alerts (id, project, budget, current, threshold, status)
VALUES
  ('budget_aigc', 'aigc-lab', '$360/day', '$312', '85%', 'Warning'),
  ('budget_customer', 'customer-service-agent', '$400/day', '$241', '70%', 'Normal')
ON CONFLICT (id) DO UPDATE
SET
  project = EXCLUDED.project,
  budget = EXCLUDED.budget,
  current = EXCLUDED.current,
  threshold = EXCLUDED.threshold,
  status = EXCLUDED.status;
