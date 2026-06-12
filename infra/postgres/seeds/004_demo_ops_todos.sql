-- Demo operations todos for local PostgreSQL mode.

INSERT INTO ops_todos (id, title, source, owner, status)
VALUES
  ('todo_fallback', '模型 fallback 率升高', '网关与模型', '运维人员', 'Watching'),
  ('todo_budget', 'aigc-lab 预算接近阈值', '计费与配额', '管理员', 'Warning'),
  ('todo_key', '新项目 API Key 待审批', '用户与权限', '管理员', 'Pending')
ON CONFLICT (id) DO UPDATE
SET
  title = EXCLUDED.title,
  source = EXCLUDED.source,
  owner = EXCLUDED.owner,
  status = EXCLUDED.status;
