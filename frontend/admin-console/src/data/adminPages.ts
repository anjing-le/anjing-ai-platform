import type { AdminPageDefinition } from '@/types/adminPage'

export const adminPages: AdminPageDefinition[] = [
  {
    id: 'overview',
    layout: 'dashboard',
    eyebrow: 'Platform Dashboard',
    title: '运营总览',
    description: '面向管理员、开发和运维的统一工作台，优先看服务健康、调用趋势、费用风险和接入进度。',
    primaryAction: '处理待办',
    secondaryAction: '导出日报',
    tabs: ['运营总览', '服务健康', '费用风险', '接入进度'],
    metrics: [
      { label: '今日调用', value: '128.4K', note: 'Gateway / LLM / Skill 聚合' },
      { label: '平台成功率', value: '99.21%', note: '近 24 小时' },
      { label: '今日成本', value: '$842', note: '模型 Token 与 Skill 调用' },
      { label: '待处理事项', value: '7', note: '告警 / 凭据 / 权限审批' }
    ],
    primaryTable: {
      eyebrow: 'Operations',
      title: '今日运营事件',
      columns: ['事件', '模块', '负责人', '状态'],
      rows: [
        ['LLM fallback rate 升高', '模型服务', '运维人员', 'Watching'],
        ['billing-export 任务待确认', '计费与配额', '管理员', 'Pending'],
        ['search-knowledge schema 更新', 'Skill Hub', '开发人员', 'Review'],
        ['default-key 30 天内到期', '凭据中心', '运维人员', 'Open']
      ]
    },
    secondaryTable: {
      eyebrow: 'Capacity',
      title: '关键资源水位',
      columns: ['资源', '当前值', '阈值', '趋势'],
      rows: [
        ['Token / day', '8.6M', '12M', '+14%'],
        ['Gateway RPS', '1.8K', '3K', '+4%'],
        ['Skill timeout', '1.4%', '2%', '-0.2%'],
        ['Budget usage', '72%', '85%', '+9%']
      ]
    },
    panels: [
      {
        eyebrow: 'Health',
        title: '服务健康',
        items: [
          { label: 'Gateway', value: 'Normal', note: 'P95 82ms' },
          { label: 'Model Service', value: 'Degraded', note: 'fallback rate 4.2%' },
          { label: 'Skill Hub', value: 'Normal', note: '31 skills online' },
          { label: 'Billing Meter', value: 'Normal', note: 'no lag' }
        ]
      },
      {
        eyebrow: 'Todo',
        title: '运营待办',
        items: [
          { label: '权限审批', value: '2', note: '开发角色申请' },
          { label: '预算告警', value: '1', note: 'AIGC team approaching limit' },
          { label: '凭据轮换', value: '3', note: 'provider keys expiring' },
          { label: '失败追踪', value: '1', note: 'gateway 5xx spike' }
        ]
      }
    ]
  },
  {
    id: 'gateway',
    layout: 'management',
    eyebrow: 'API Gateway',
    title: '网关管理',
    description: '统一管理外部 API 入口、服务路由、消费者、限流策略和请求审计，像真正网关控制台一样工作。',
    primaryAction: '新增路由',
    secondaryAction: '查看请求日志',
    tabs: ['路由', '上游服务', '消费者', '限流策略', '请求日志'],
    metrics: [
      { label: '启用路由', value: '24', note: '生产入口' },
      { label: '上游服务', value: '9', note: 'Spring Boot / MCP / external' },
      { label: 'P95 延迟', value: '82ms', note: '近 1 小时' },
      { label: '限流拒绝', value: '41', note: '今日' }
    ],
    primaryTable: {
      eyebrow: 'Routes',
      title: '生产路由表',
      columns: ['Route', 'Upstream', 'Auth', 'Rate Limit', 'Status'],
      rows: [
        ['/api/v1/llm/**', 'platform-api.llm', 'API Key', '1200/min', 'Active'],
        ['/api/v1/skills/**', 'platform-api.skill', 'API Key', '800/min', 'Active'],
        ['/api/v1/admin/**', 'platform-api.admin', 'RBAC', 'internal', 'Locked'],
        ['/webhook/events/**', 'audit-ingest', 'Signature', '300/min', 'Draft']
      ]
    },
    secondaryTable: {
      eyebrow: 'Request Trace',
      title: '最近请求',
      columns: ['Request', 'Consumer', 'Latency', 'Result'],
      rows: [
        ['POST /llm/chat', 'customer-service-agent', '76ms', '200'],
        ['POST /skills/search', 'knowledge-rag', '118ms', '200'],
        ['GET /admin/users', 'console-admin', '42ms', '200'],
        ['POST /llm/chat', 'aigc-lab', '221ms', '429']
      ]
    },
    panels: [
      {
        eyebrow: 'Policy',
        title: '网关策略',
        items: [
          { label: '鉴权前置', value: 'API Key + RBAC', note: 'admin route requires role' },
          { label: '请求审计', value: 'Enabled', note: 'body masked before persist' },
          { label: '限流维度', value: 'consumer + route', note: 'supports burst limit' }
        ]
      },
      {
        eyebrow: 'Release',
        title: '发布检查',
        items: [
          { label: 'Schema diff', value: '1 pending', note: '/webhook/events/**' },
          { label: '灰度路由', value: '5%', note: 'llm route canary' },
          { label: '回滚版本', value: 'v2026.06.08', note: 'ready' }
        ]
      }
    ],
    flow: [
      { label: '01', title: 'Consumer', note: '应用、Agent 或内部服务' },
      { label: '02', title: 'Auth', note: 'API Key / Token / RBAC' },
      { label: '03', title: 'Rate Limit', note: '按 consumer 与 route 限流' },
      { label: '04', title: 'Upstream', note: '转发到平台模块' },
      { label: '05', title: 'Audit', note: '记录调用与失败链路' }
    ]
  },
  {
    id: 'iam',
    layout: 'management',
    eyebrow: 'Users & Access',
    title: '用户与权限',
    description: '这里是平台的用户系统和权限中心：组织、用户、角色、权限矩阵、API Key、OAuth/SSO 都收在一起。',
    primaryAction: '邀请用户',
    secondaryAction: '新增角色',
    tabs: ['用户', '组织', '角色', '权限矩阵', 'API Key', 'SSO/OAuth'],
    metrics: [
      { label: '组织', value: '6', note: 'workspace / tenant' },
      { label: '用户', value: '42', note: '活跃 31' },
      { label: '角色', value: '4', note: '管理员 + 三类核心角色' },
      { label: 'API Key', value: '16', note: '有效密钥' }
    ],
    primaryTable: {
      eyebrow: 'Users',
      title: '用户列表',
      columns: ['用户', '组织', '角色', 'MFA', '状态'],
      rows: [
        ['lin.chen@anjing.ai', 'Platform', 'Administrator', 'Enabled', 'Active'],
        ['dev-api@anjing.ai', 'Engineering', 'Developer', 'Enabled', 'Active'],
        ['ops-oncall@anjing.ai', 'Operations', 'Operator', 'Enabled', 'Active'],
        ['agent-user@anjing.ai', 'Customer Lab', 'User', 'Pending', 'Invited']
      ]
    },
    secondaryTable: {
      eyebrow: 'Permission Matrix',
      title: '权限矩阵',
      columns: ['角色', '网关', '模型服务', '计费', '运营看板', '用户权限'],
      rows: [
        ['Administrator', 'Manage', 'Manage', 'Manage', 'Manage', 'Manage'],
        ['User', 'Read / Use', 'Use', 'Read self', 'None', 'None'],
        ['Developer', 'Manage', 'Manage', 'Read', 'Read', 'None'],
        ['Operator', 'None', 'Read runtime', 'Manage quota', 'Manage', 'None']
      ]
    },
    panels: [
      {
        eyebrow: 'Security',
        title: '安全策略',
        items: [
          { label: 'MFA', value: 'Required', note: 'admin / developer / operator' },
          { label: 'Token TTL', value: '12h', note: 'console session' },
          { label: 'OAuth', value: '2 providers', note: 'GitHub / Google planned' }
        ]
      },
      {
        eyebrow: 'API Keys',
        title: '密钥治理',
        items: [
          { label: '创建审批', value: 'Enabled', note: 'admin reviews production keys' },
          { label: 'Scope', value: 'route + model', note: 'least privilege' },
          { label: 'Rotation', value: '90d', note: 'default policy' }
        ]
      }
    ],
    flow: [
      { label: '01', title: 'Invite', note: '邀请用户进入组织' },
      { label: '02', title: 'Assign Role', note: '绑定角色和权限范围' },
      { label: '03', title: 'Issue Token', note: '签发 Token 或 API Key' },
      { label: '04', title: 'Audit', note: '记录登录与权限变更' }
    ]
  },
  {
    id: 'llm',
    layout: 'management',
    eyebrow: 'Model Service',
    title: '模型服务',
    description: '以 MaaS 控制台的方式管理供应商、模型目录、路由策略、Key 池、Token 用量和失败切换。',
    primaryAction: '新增供应商',
    secondaryAction: '查看用量',
    tabs: ['供应商', '模型目录', '路由策略', 'Key 池', '用量统计'],
    metrics: [
      { label: '供应商', value: '5', note: 'OpenAI / Claude / Gemini / local' },
      { label: '模型', value: '18', note: 'chat / embedding / rerank' },
      { label: '今日 Token', value: '8.6M', note: '+14% vs yesterday' },
      { label: '失败切换', value: '128', note: '近 24 小时' }
    ],
    primaryTable: {
      eyebrow: 'Providers',
      title: '模型供应商',
      columns: ['供应商', '模型数', 'Key 池', '默认权重', '状态'],
      rows: [
        ['openai-primary', '7', '4 keys', '60%', 'Active'],
        ['claude-fallback', '4', '2 keys', '25%', 'Standby'],
        ['gemini-fast', '3', '3 keys', '15%', 'Active'],
        ['local-vllm', '4', 'internal', 'dev only', 'Testing']
      ]
    },
    secondaryTable: {
      eyebrow: 'Routing',
      title: '模型路由策略',
      columns: ['别名', '场景', '首选模型', 'Fallback', '预算'],
      rows: [
        ['chat-default', '客服 Agent', 'gpt-4.1-mini', 'claude-haiku', '$240/day'],
        ['reasoning-high', '复杂任务', 'o3', 'claude-sonnet', '$90/day'],
        ['embedding-default', 'RAG', 'text-embedding-3', 'local-bge', '$60/day'],
        ['aigc-fast', '内容生成', 'gemini-flash', 'gpt-4.1-mini', '$120/day']
      ]
    },
    panels: [
      {
        eyebrow: 'Key Pool',
        title: 'Key 池健康',
        items: [
          { label: '可用 Key', value: '12 / 14', note: '2 expiring' },
          { label: '失败重试', value: '3 times', note: 'provider level' },
          { label: '脱敏展示', value: 'Enabled', note: 'credentialRef only' }
        ]
      },
      {
        eyebrow: 'Cost',
        title: '成本控制',
        items: [
          { label: '按模型计量', value: 'Enabled', note: 'prompt / completion tokens' },
          { label: '预算告警', value: '85%', note: 'daily project budget' },
          { label: '用量导出', value: 'CSV / API', note: 'billing ready' }
        ]
      }
    ],
    flow: [
      { label: '01', title: 'Model Alias', note: '应用调用统一别名' },
      { label: '02', title: 'Policy', note: '按成本、质量、延迟选择模型' },
      { label: '03', title: 'Provider Key', note: '从 Key 池选择 credentialRef' },
      { label: '04', title: 'Fallback', note: '失败后自动切换供应商' },
      { label: '05', title: 'Metering', note: '记录 Token 与成本' }
    ]
  },
  {
    id: 'skill',
    layout: 'management',
    eyebrow: 'Skill Hub',
    title: 'Skill Hub',
    description: '像 Agent 能力市场一样管理 Skill 注册、协议、Schema、版本、调用测试和治理策略。',
    primaryAction: '注册 Skill',
    secondaryAction: '调用测试',
    tabs: ['注册中心', 'Schema', '版本', '调用测试', '治理策略'],
    metrics: [
      { label: 'Skill', value: '31', note: '已注册' },
      { label: '协议类型', value: '3', note: 'HTTP / MCP / INTERNAL' },
      { label: '调用成功率', value: '98.6%', note: '近 7 天' },
      { label: '治理策略', value: '12', note: '启用中' }
    ],
    primaryTable: {
      eyebrow: 'Registry',
      title: 'Skill 注册中心',
      columns: ['Skill', '协议', '版本', 'Owner', '状态'],
      rows: [
        ['search-knowledge', 'MCP', 'v1.4.0', 'RAG team', 'Published'],
        ['send-message', 'HTTP', 'v0.9.2', 'CRM team', 'Draft'],
        ['aigc-render', 'HTTP', 'v0.7.1', 'Content team', 'Testing'],
        ['ticket-create', 'INTERNAL', 'v1.1.0', 'Support team', 'Published']
      ]
    },
    secondaryTable: {
      eyebrow: 'Governance',
      title: '调用治理',
      columns: ['策略', '范围', '动作', '阈值', '状态'],
      rows: [
        ['default-timeout', 'all skills', 'timeout', '8s', 'Active'],
        ['tool-auth', 'external skills', 'require credential', 'always', 'Active'],
        ['schema-lock', 'published skills', 'block breaking change', 'strict', 'Active'],
        ['sandbox-test', 'draft skills', 'test only', 'dev env', 'Draft']
      ]
    },
    panels: [
      {
        eyebrow: 'Protocol',
        title: '协议适配',
        items: [
          { label: 'HTTP', value: '18', note: 'OpenAPI schema' },
          { label: 'MCP', value: '9', note: 'tool registry' },
          { label: 'Internal', value: '4', note: 'platform native' }
        ]
      },
      {
        eyebrow: 'Testing',
        title: '测试控制',
        items: [
          { label: 'Dry run', value: 'Enabled', note: 'no side effects' },
          { label: 'Mock credential', value: 'Enabled', note: 'dev only' },
          { label: 'Schema validator', value: 'Strict', note: 'publish gate' }
        ]
      }
    ],
    flow: [
      { label: '01', title: 'Agent Request', note: 'Agent 请求能力目录' },
      { label: '02', title: 'Resolve Skill', note: '匹配协议、版本和权限' },
      { label: '03', title: 'Validate Schema', note: '检查入参和响应结构' },
      { label: '04', title: 'CredentialRef', note: '注入必要凭据引用' },
      { label: '05', title: 'Invoke', note: '调用并记录治理事件' }
    ]
  },
  {
    id: 'observability',
    layout: 'dashboard',
    eyebrow: 'Operations',
    title: '运营看板',
    description: '给运维和管理员看的运行面：日志、Trace、失败追踪、审计事件、SLO 和告警都在这里闭环。',
    primaryAction: '处理告警',
    secondaryAction: '导出日志',
    tabs: ['运营看板', '调用日志', 'Trace', '失败追踪', '审计事件'],
    metrics: [
      { label: '调用日志', value: '86K', note: '近 7 天' },
      { label: 'Open Alerts', value: '2', note: '需要处理' },
      { label: 'SLO', value: '99.5%', note: '月度可用性' },
      { label: 'Audit Events', value: '312', note: '今日' }
    ],
    primaryTable: {
      eyebrow: 'Incidents',
      title: '失败追踪',
      columns: ['问题', '模块', '影响', '状态'],
      rows: [
        ['llm-timeout-spike', '模型服务', '42 requests', 'Investigating'],
        ['gateway-5xx', '网关管理', '11 requests', 'Watching'],
        ['quota-rejected', '计费与配额', '27 requests', 'Expected'],
        ['skill-auth-denied', 'Skill Hub', '6 calls', 'Reviewed']
      ]
    },
    secondaryTable: {
      eyebrow: 'Logs',
      title: '实时日志流',
      columns: ['时间', '模块', '级别', '摘要'],
      rows: [
        ['12:40:22', 'gateway', 'WARN', 'consumer aigc-lab rate limited'],
        ['12:39:51', 'llm', 'ERROR', 'provider timeout; fallback succeeded'],
        ['12:38:07', 'iam', 'INFO', 'role developer granted'],
        ['12:37:30', 'skill', 'INFO', 'search-knowledge v1.4.0 invoked']
      ]
    },
    panels: [
      {
        eyebrow: 'SLO',
        title: '服务等级',
        items: [
          { label: 'Gateway', value: '99.97%', note: 'target 99.9%' },
          { label: 'Model Service', value: '99.21%', note: 'target 99.5%' },
          { label: 'Skill Hub', value: '99.63%', note: 'target 99.5%' }
        ]
      },
      {
        eyebrow: 'Audit',
        title: '审计重点',
        items: [
          { label: '权限变更', value: '8', note: 'today' },
          { label: '密钥读取', value: '19', note: 'credentialRef only' },
          { label: '配置发布', value: '4', note: 'all approved' }
        ]
      }
    ]
  },
  {
    id: 'quota',
    layout: 'management',
    eyebrow: 'Billing & Quota',
    title: '计费与配额',
    description: '把 MaaS 常见的套餐、用量、预算、发票、限流和配额统一到一个后台页面，后续可直接接真实计费。',
    primaryAction: '新增套餐',
    secondaryAction: '导出账单',
    tabs: ['套餐', '配额', '用量', '发票', '预算告警'],
    metrics: [
      { label: '本月收入', value: '$18.4K', note: 'estimated' },
      { label: '今日用量', value: '8.6M', note: 'tokens' },
      { label: '预算告警', value: '3', note: 'projects near limit' },
      { label: '超限拒绝', value: '27', note: 'today' }
    ],
    primaryTable: {
      eyebrow: 'Plans',
      title: '套餐与配额',
      columns: ['套餐', '适用对象', 'RPS', 'Token / day', '计费方式'],
      rows: [
        ['Free', 'trial users', '20', '50K', 'free'],
        ['Team', 'internal teams', '300', '2M', 'monthly'],
        ['Business', 'production agents', '1200', '10M', 'usage based'],
        ['Enterprise', 'private customers', 'custom', 'custom', 'contract']
      ]
    },
    secondaryTable: {
      eyebrow: 'Usage',
      title: '项目用量',
      columns: ['项目', 'Token', 'Skill Calls', '成本', '预算'],
      rows: [
        ['customer-service-agent', '2.4M', '18.2K', '$241', '61%'],
        ['knowledge-rag', '1.8M', '9.4K', '$168', '48%'],
        ['aigc-lab', '3.1M', '4.8K', '$312', '86%'],
        ['ops-copilot', '620K', '2.1K', '$64', '22%']
      ]
    },
    panels: [
      {
        eyebrow: 'Billing',
        title: '账单状态',
        items: [
          { label: '未出账', value: '$4.8K', note: 'current cycle' },
          { label: '发票', value: '2 pending', note: 'manual review' },
          { label: '成本分摊', value: 'project based', note: 'tags required' }
        ]
      },
      {
        eyebrow: 'Controls',
        title: '配额控制',
        items: [
          { label: '硬限制', value: 'Enabled', note: 'block when exceeded' },
          { label: '软告警', value: '70% / 85%', note: 'email + console' },
          { label: '用量窗口', value: 'daily', note: 'UTC+8 reset' }
        ]
      }
    ],
    flow: [
      { label: '01', title: 'API Key', note: '识别项目和套餐' },
      { label: '02', title: 'Quota Check', note: '检查 RPS 与日配额' },
      { label: '03', title: 'Metering', note: '记录 Token 与 Skill 调用' },
      { label: '04', title: 'Billing', note: '聚合成本、预算与账单' }
    ]
  },
  {
    id: 'credential',
    layout: 'management',
    eyebrow: 'Secrets',
    title: '凭据中心',
    description: '统一管理 credentialRef、供应商 Key、脱敏规则、访问范围和轮换任务，让业务模块不直接碰明文密钥。',
    primaryAction: '新增凭据',
    secondaryAction: '轮换检查',
    tabs: ['Secret Vault', 'Provider Keys', 'credentialRef', '轮换任务', '脱敏规则'],
    metrics: [
      { label: '凭据引用', value: '28', note: 'credentialRef' },
      { label: '供应商 Key', value: '12', note: '启用中' },
      { label: '即将到期', value: '4', note: '30 天内' },
      { label: '脱敏规则', value: '6', note: '全局' }
    ],
    primaryTable: {
      eyebrow: 'Vault',
      title: '凭据引用',
      columns: ['credentialRef', '用途', '范围', '到期', '状态'],
      rows: [
        ['cred.openai.default', 'LLM provider', 'Model Service', '2026-07-01', 'Active'],
        ['cred.claude.backup', 'LLM fallback', 'Model Service', '2026-06-28', 'Expiring'],
        ['cred.skill.http.default', 'HTTP Skill', 'Skill Hub', '2026-09-12', 'Active'],
        ['cred.webhook.signing', 'Webhook signature', 'API Gateway', '2026-08-03', 'Active']
      ]
    },
    secondaryTable: {
      eyebrow: 'Rotation',
      title: '轮换任务',
      columns: ['任务', '凭据', '负责人', '窗口', '状态'],
      rows: [
        ['rotate-claude-backup', 'cred.claude.backup', '运维人员', '2026-06-18', 'Scheduled'],
        ['verify-openai-default', 'cred.openai.default', '运维人员', '2026-06-20', 'Pending'],
        ['mask-auth-header', 'global rule', '管理员', 'always', 'Active'],
        ['skill-ref-audit', 'Skill credentials', '开发人员', 'weekly', 'Running']
      ]
    },
    panels: [
      {
        eyebrow: 'Access',
        title: '读取控制',
        items: [
          { label: '明文读取', value: 'Blocked', note: 'only runtime can resolve' },
          { label: 'Scope', value: 'module + env', note: 'least privilege' },
          { label: 'Audit', value: 'Enabled', note: 'every resolve recorded' }
        ]
      },
      {
        eyebrow: 'Masking',
        title: '脱敏规则',
        items: [
          { label: 'Authorization', value: 'Full mask', note: 'headers' },
          { label: 'API Key', value: 'Last 4 only', note: 'console display' },
          { label: 'Webhook Secret', value: 'Hidden', note: 'no reveal' }
        ]
      }
    ],
    flow: [
      { label: '01', title: 'Create Ref', note: '创建 credentialRef' },
      { label: '02', title: 'Bind Scope', note: '绑定模块、环境和角色' },
      { label: '03', title: 'Resolve Runtime', note: '运行期解析明文' },
      { label: '04', title: 'Rotate', note: '定期轮换并审计' }
    ]
  },
  {
    id: 'examples',
    layout: 'management',
    eyebrow: 'Developer Portal',
    title: '示例接入',
    description: '面向使用用户和开发人员的接入门户：示例应用、API Key、Quickstart、SDK 文档和测试入口。',
    primaryAction: '新建示例',
    secondaryAction: '查看文档',
    tabs: ['示例应用', 'API Access', 'Quickstart', 'SDK', '模板'],
    metrics: [
      { label: '示例', value: '3', note: '客服 / RAG / AIGC' },
      { label: '接入文档', value: '6', note: '进行中' },
      { label: '测试调用', value: '128', note: '今日' },
      { label: '模板', value: '4', note: '预留' }
    ],
    primaryTable: {
      eyebrow: 'Apps',
      title: '示例应用',
      columns: ['示例', '依赖模块', '适用角色', '接入状态', '入口'],
      rows: [
        ['agent-customer-service', 'Gateway / LLM / Skill', '使用用户', 'Ready', '/examples/customer-service'],
        ['agent-knowledge', 'LLM / Skill / Credential', '使用用户', 'Ready', '/examples/knowledge'],
        ['agent-aigc', 'LLM / Billing / Ops', '开发人员', 'Draft', '/examples/aigc'],
        ['ops-copilot', 'Gateway / Observability', '运维人员', 'Planned', '/examples/ops']
      ]
    },
    secondaryTable: {
      eyebrow: 'Quickstart',
      title: '接入步骤',
      columns: ['步骤', '说明', '产物', '状态'],
      rows: [
        ['1', '创建应用与 API Key', 'appId / key scope', 'Ready'],
        ['2', '选择模型路由', 'model alias', 'Ready'],
        ['3', '绑定 Skill 权限', 'skill scopes', 'Draft'],
        ['4', '查看调用与成本', 'dashboard', 'Ready']
      ]
    },
    panels: [
      {
        eyebrow: 'SDK',
        title: '接入工具',
        items: [
          { label: 'TypeScript SDK', value: 'Planned', note: 'browser / node' },
          { label: 'Java SDK', value: 'Planned', note: 'Spring Boot service' },
          { label: 'OpenAPI', value: 'Ready', note: 'contracts/openapi' }
        ]
      },
      {
        eyebrow: 'Docs',
        title: '文档入口',
        items: [
          { label: 'API Access', value: 'Ready', note: 'key + endpoint' },
          { label: 'Model Routing', value: 'Draft', note: 'alias examples' },
          { label: 'Skill Protocol', value: 'Draft', note: 'schema examples' }
        ]
      }
    ],
    flow: [
      { label: '01', title: 'Create App', note: '创建接入应用' },
      { label: '02', title: 'Get API Key', note: '分配调用范围' },
      { label: '03', title: 'Use Modules', note: '调用 Gateway / LLM / Skill' },
      { label: '04', title: 'Observe Cost', note: '查看日志、用量和账单' }
    ]
  }
]
