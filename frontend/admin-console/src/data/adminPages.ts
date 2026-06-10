import type { AdminPageDefinition } from '@/types/adminPage'

export const adminPages: AdminPageDefinition[] = [
  {
    id: 'overview',
    eyebrow: 'Platform',
    title: '平台总览',
    description: '用最少指标看清平台健康、接入状态、风险和待处理事项。',
    primaryAction: '查看接入状态',
    secondaryAction: '导出日报',
    metrics: [
      { label: '今日调用', value: '12.8K', note: 'Gateway / LLM / Skill' },
      { label: '成功率', value: '99.2%', note: '近 24 小时' },
      { label: '活跃接入方', value: '18', note: '应用与 Agent' },
      { label: '待处理风险', value: '3', note: '凭据与配额' }
    ],
    focusItems: ['服务健康', '模块接入进度', '失败率变化', '凭据到期提醒'],
    records: [
      { name: 'customer-service-agent', type: 'Agent', owner: '使用用户', status: 'Healthy' },
      { name: 'knowledge-rag', type: 'Example', owner: '开发人员', status: 'Designing' },
      { name: 'default-llm-route', type: 'LLM Route', owner: '开发人员', status: 'Draft' },
      { name: 'daily-quota-default', type: 'Quota', owner: '运维人员', status: 'Active' }
    ]
  },
  {
    id: 'gateway',
    eyebrow: 'Gateway',
    title: '统一 API 入口',
    description: '只保留路由、限流、服务配置和请求日志这几个最重要的网关管理面。',
    primaryAction: '新增路由',
    secondaryAction: '查看请求日志',
    metrics: [
      { label: '启用路由', value: '24', note: '生产入口' },
      { label: '限流策略', value: '6', note: '按应用与路径' },
      { label: '平均延迟', value: '82ms', note: '近 1 小时' },
      { label: '失败请求', value: '41', note: '今日' }
    ],
    focusItems: ['路由表', '限流策略', '鉴权前置', '请求审计'],
    records: [
      { name: '/api/llm/**', type: 'Route', owner: '开发人员', status: 'Active' },
      { name: '/api/skills/**', type: 'Route', owner: '开发人员', status: 'Active' },
      { name: 'default-app-limit', type: 'Rate limit', owner: '开发人员', status: 'Active' },
      { name: 'request-audit', type: 'Audit policy', owner: '管理员', status: 'Active' }
    ]
  },
  {
    id: 'iam',
    eyebrow: 'IAM',
    title: '身份与权限',
    description: '管理员管理用户、角色、权限、Token 和 API Key，先把最核心 RBAC 边界定住。',
    primaryAction: '新增角色',
    secondaryAction: '查看 API Key',
    metrics: [
      { label: '用户', value: '42', note: '平台账号' },
      { label: '角色', value: '4', note: '管理员和三类角色' },
      { label: 'API Key', value: '16', note: '有效密钥' },
      { label: 'OAuth', value: '2', note: '预留接入' }
    ],
    focusItems: ['用户', '角色', '权限点', 'API Key'],
    records: [
      { name: 'Administrator', type: 'Role', owner: '管理员', status: 'Active' },
      { name: 'User', type: 'Role', owner: '管理员', status: 'Active' },
      { name: 'Developer', type: 'Role', owner: '管理员', status: 'Active' },
      { name: 'Operator', type: 'Role', owner: '管理员', status: 'Active' }
    ]
  },
  {
    id: 'llm',
    eyebrow: 'LLM',
    title: '模型供应与路由',
    description: '管理供应商、模型、Key 池、用量和路由策略，上层应用只面对统一模型接口。',
    primaryAction: '新增供应商',
    secondaryAction: '查看用量',
    metrics: [
      { label: '供应商', value: '5', note: 'OpenAI / Claude / Gemini' },
      { label: '模型', value: '18', note: '可路由' },
      { label: 'Key 池', value: '12', note: '启用中' },
      { label: 'Token', value: '8.6M', note: '今日消耗' }
    ],
    focusItems: ['供应商', '模型列表', 'Key 池', '路由策略'],
    records: [
      { name: 'openai-primary', type: 'Provider', owner: '开发人员', status: 'Active' },
      { name: 'claude-fallback', type: 'Provider', owner: '开发人员', status: 'Standby' },
      { name: 'chat-default', type: 'Route policy', owner: '开发人员', status: 'Draft' },
      { name: 'daily-token-usage', type: 'Usage', owner: '管理员', status: 'Tracking' }
    ]
  },
  {
    id: 'skill',
    eyebrow: 'Skill',
    title: '能力注册与调度',
    description: '管理 Skill 注册、Schema、版本、调用测试和治理策略，给 Agent 一个稳定能力目录。',
    primaryAction: '注册 Skill',
    secondaryAction: '调用测试',
    metrics: [
      { label: 'Skill', value: '31', note: '已注册' },
      { label: '协议', value: '3', note: 'HTTP / MCP / INTERNAL' },
      { label: '调用成功率', value: '98.6%', note: '近 7 天' },
      { label: '治理策略', value: '12', note: '启用中' }
    ],
    focusItems: ['注册中心', 'Schema', '版本', '治理策略'],
    records: [
      { name: 'search-knowledge', type: 'MCP Skill', owner: '开发人员', status: 'Published' },
      { name: 'send-message', type: 'HTTP Skill', owner: '开发人员', status: 'Draft' },
      { name: 'aigc-render', type: 'HTTP Skill', owner: '开发人员', status: 'Testing' },
      { name: 'default-policy', type: 'Governance', owner: '管理员', status: 'Active' }
    ]
  },
  {
    id: 'observability',
    eyebrow: 'Observability',
    title: '日志与指标',
    description: '把调用日志、失败追踪、指标看板和审计事件放到一个最小可用视图里。',
    primaryAction: '查看失败',
    secondaryAction: '导出日志',
    metrics: [
      { label: '调用日志', value: '86K', note: '近 7 天' },
      { label: '失败追踪', value: '19', note: '待处理' },
      { label: '审计事件', value: '312', note: '今日' },
      { label: '告警', value: '2', note: '运行中' }
    ],
    focusItems: ['调用日志', '失败追踪', '指标看板', '审计事件'],
    records: [
      { name: 'llm-timeout-spike', type: 'Failure', owner: '运维人员', status: 'Open' },
      { name: 'skill-auth-denied', type: 'Audit', owner: '管理员', status: 'Reviewed' },
      { name: 'gateway-5xx', type: 'Metric', owner: '运维人员', status: 'Watching' },
      { name: 'quota-rejected', type: 'Trace', owner: '运维人员', status: 'Open' }
    ]
  },
  {
    id: 'quota',
    eyebrow: 'Quota',
    title: '配额与限额',
    description: '配置资源限额、调用配额、用量统计和未来计费预留边界。',
    primaryAction: '新增策略',
    secondaryAction: '查看用量',
    metrics: [
      { label: '策略', value: '14', note: '启用中' },
      { label: '今日拒绝', value: '27', note: '超限请求' },
      { label: 'Top 应用', value: '5', note: '高用量' },
      { label: '计费接口', value: 'Draft', note: '预留' }
    ],
    focusItems: ['配额策略', '用量计数', '限额规则', '计费预留'],
    records: [
      { name: 'default-token-quota', type: 'Token quota', owner: '运维人员', status: 'Active' },
      { name: 'skill-daily-quota', type: 'Skill quota', owner: '运维人员', status: 'Active' },
      { name: 'gateway-burst-limit', type: 'Rate limit', owner: '开发人员', status: 'Draft' },
      { name: 'billing-usage-export', type: 'Billing', owner: '管理员', status: 'Planned' }
    ]
  },
  {
    id: 'credential',
    eyebrow: 'Credential',
    title: '凭据与密钥',
    description: '统一管理 credentialRef、供应商 Key、脱敏展示和密钥轮换策略。',
    primaryAction: '新增凭据',
    secondaryAction: '轮换检查',
    metrics: [
      { label: '凭据引用', value: '28', note: 'credentialRef' },
      { label: '即将到期', value: '4', note: '30 天内' },
      { label: '供应商 Key', value: '12', note: '启用中' },
      { label: '脱敏规则', value: '6', note: '全局' }
    ],
    focusItems: ['凭据引用', '供应商 Key', '脱敏展示', '轮换策略'],
    records: [
      { name: 'openai-default', type: 'Provider key', owner: '运维人员', status: 'Active' },
      { name: 'skill-http-default', type: 'credentialRef', owner: '开发人员', status: 'Active' },
      { name: 'claude-backup', type: 'Provider key', owner: '运维人员', status: 'Expiring' },
      { name: 'mask-auth-header', type: 'Masking', owner: '管理员', status: 'Active' }
    ]
  },
  {
    id: 'examples',
    eyebrow: 'Examples',
    title: '示例接入',
    description: '给使用用户和开发人员提供客服、知识库、AIGC 等最小示例入口。',
    primaryAction: '新建示例',
    secondaryAction: '查看文档',
    metrics: [
      { label: '示例', value: '3', note: '客服 / RAG / AIGC' },
      { label: '接入文档', value: '6', note: '进行中' },
      { label: '测试调用', value: '128', note: '今日' },
      { label: '模板', value: '4', note: '预留' }
    ],
    focusItems: ['客服 Agent', '知识库 Agent', 'AIGC 示例', '接入文档'],
    records: [
      { name: 'agent-customer-service', type: 'Example', owner: '使用用户', status: 'Ready' },
      { name: 'agent-knowledge', type: 'Example', owner: '使用用户', status: 'Ready' },
      { name: 'agent-aigc', type: 'Example', owner: '开发人员', status: 'Draft' },
      { name: 'quickstart', type: 'Docs', owner: '使用用户', status: 'Writing' }
    ]
  }
]

