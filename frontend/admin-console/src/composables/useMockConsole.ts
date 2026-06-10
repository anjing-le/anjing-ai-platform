import { reactive } from 'vue'

export type ConsoleModuleId =
  | 'overview'
  | 'gateway'
  | 'iam'
  | 'llm'
  | 'skill'
  | 'observability'
  | 'quota'
  | 'credential'
  | 'examples'

export interface WorkspaceTab {
  eyebrow: string
  title: string
  description: string
  columns: string[]
}

export interface ConsoleRecord {
  id: string
  moduleId: ConsoleModuleId
  tab: string
  title: string
  status: string
  owner: string
  updatedAt: string
  cells: Record<string, string>
  details: Array<{ label: string; value: string }>
  related: Array<{ label: string; route: string }>
}

export interface ActionField {
  id: string
  label: string
  defaultValue: string
  options?: string[]
}

export interface ActionSpec {
  title: string
  description: string
  fields: ActionField[]
  impact: string[]
}

const storageKey = 'anjing-ai-platform-console-mock-v3'

const routeByModule: Record<ConsoleModuleId, string> = {
  overview: '/console/overview',
  gateway: '/console/gateway',
  iam: '/console/iam',
  llm: '/console/gateway',
  skill: '/console/gateway',
  observability: '/console/overview',
  quota: '/console/quota',
  credential: '/console/iam',
  examples: '/console/docs'
}

const moduleLabel: Record<ConsoleModuleId, string> = {
  overview: '运营总览',
  gateway: '网关与模型',
  iam: '用户与权限',
  llm: '网关与模型',
  skill: '网关与模型',
  observability: '运营总览',
  quota: '计费与配额',
  credential: '用户与权限',
  examples: '帮助文档'
}

export const workspaceTabs: Record<ConsoleModuleId, Record<string, WorkspaceTab>> = {
  overview: {
    运营总览: {
      eyebrow: 'Operations',
      title: '今日运营事件',
      description: '聚合所有模块的待办、发布、告警和风险，作为后台默认工作台。',
      columns: ['事件', '模块', '负责人', '状态']
    },
    服务健康: {
      eyebrow: 'Health',
      title: '服务健康',
      description: '按模块查看 SLO、延迟和运行状态。',
      columns: ['服务', 'SLO', 'P95', '状态']
    },
    费用风险: {
      eyebrow: 'Cost Risk',
      title: '费用风险',
      description: '按项目查看预算消耗、成本趋势和告警。',
      columns: ['项目', '今日成本', '预算水位', '状态']
    },
    接入进度: {
      eyebrow: 'Onboarding',
      title: '接入进度',
      description: '跟踪应用从创建、授权、路由到用量观测的闭环进度。',
      columns: ['应用', 'Owner', '下一步', '状态']
    }
  },
  gateway: {
    'API 路由': {
      eyebrow: 'API Routes',
      title: 'API 路由',
      description: '统一管理业务系统、Agent 和内部工具的 API 入口。',
      columns: ['Route', 'Upstream', 'Auth', 'Rate Limit', 'Status']
    },
    模型路由: {
      eyebrow: 'Model Routing',
      title: '模型路由',
      description: '用统一别名屏蔽模型供应商差异，并支持 fallback 和预算控制。',
      columns: ['别名', '场景', '首选模型', 'Fallback', '状态']
    },
    模型供应商: {
      eyebrow: 'Providers',
      title: '模型供应商',
      description: '管理供应商、Key 引用、权重和运行状态。',
      columns: ['供应商', '模型数', 'Key Ref', '权重', '状态']
    },
    'Skill 调用': {
      eyebrow: 'Skill Invocation',
      title: 'Skill 调用',
      description: '把 Skill 作为网关后的工具能力统一治理和调用。',
      columns: ['Skill', '协议', 'Route', 'Timeout', '状态']
    },
    路由: {
      eyebrow: 'Routes',
      title: '生产路由表',
      description: '维护外部入口、上游服务、鉴权方式和限流策略。',
      columns: ['Route', 'Upstream', 'Auth', 'Rate Limit', 'Status']
    },
    上游服务: {
      eyebrow: 'Upstreams',
      title: '上游服务',
      description: '管理平台 API、外部 webhook 和内部服务的上游目标。',
      columns: ['Service', 'Target', 'Protocol', 'Health', 'Status']
    },
    消费者: {
      eyebrow: 'Consumers',
      title: '消费者',
      description: '所有应用、Agent 和内部系统都会以消费者身份进入网关。',
      columns: ['Consumer', 'Owner', 'API Key Scope', 'Plan', 'Status']
    },
    限流策略: {
      eyebrow: 'Rate Limit',
      title: '限流策略',
      description: '按消费者、路由、套餐或环境配置流量保护。',
      columns: ['Policy', 'Scope', 'Window', 'Limit', 'Status']
    },
    请求日志: {
      eyebrow: 'Request Log',
      title: '请求日志',
      description: '按请求查看路由命中、鉴权、限流和上游响应。',
      columns: ['Request', 'Consumer', 'Latency', 'Result', 'Status']
    }
  },
  iam: {
    用户: {
      eyebrow: 'Users',
      title: '用户列表',
      description: '管理平台用户、组织归属、角色和登录安全。',
      columns: ['用户', '组织', '角色', 'MFA', '状态']
    },
    组织: {
      eyebrow: 'Organizations',
      title: '组织与空间',
      description: '按租户或团队隔离用户、预算、项目和 API Key。',
      columns: ['组织', 'Owner', '成员', '预算策略', '状态']
    },
    角色: {
      eyebrow: 'Roles',
      title: '角色定义',
      description: '定义管理员、使用用户、开发人员和运维人员的边界。',
      columns: ['角色', '说明', '成员', 'Scope', '状态']
    },
    权限矩阵: {
      eyebrow: 'Permission Matrix',
      title: '权限矩阵',
      description: '逐模块展示角色能读、用、配或管理的权限。',
      columns: ['角色', '网关', '模型服务', '计费', '用户权限', '状态']
    },
    'API Key': {
      eyebrow: 'API Keys',
      title: 'API Key',
      description: 'API Key 同时关联项目、权限范围、配额和计费。',
      columns: ['Key', '项目', 'Scope', '到期', '状态']
    },
    凭据: {
      eyebrow: 'Credentials',
      title: '凭据引用',
      description: 'credentialRef 归属访问控制中心，业务模块只引用、不读取明文。',
      columns: ['credentialRef', '用途', '范围', '到期', '状态']
    },
    'SSO/OAuth': {
      eyebrow: 'SSO',
      title: 'SSO/OAuth',
      description: '管理外部身份提供商、回调地址和登录策略。',
      columns: ['Provider', 'Client ID', 'Callback', 'Login Policy', 'Status']
    }
  },
  llm: {
    供应商: {
      eyebrow: 'Providers',
      title: '模型供应商',
      description: '管理供应商、模型数量、Key 池和默认权重。',
      columns: ['供应商', '模型数', 'Key 池', '默认权重', '状态']
    },
    模型目录: {
      eyebrow: 'Models',
      title: '模型目录',
      description: '按能力类型管理 chat、embedding、rerank 和生成模型。',
      columns: ['模型', '能力', 'Provider', '上下文', '状态']
    },
    路由策略: {
      eyebrow: 'Routing',
      title: '模型路由策略',
      description: '按成本、质量、延迟和 fallback 定义模型别名。',
      columns: ['别名', '场景', '首选模型', 'Fallback', '状态']
    },
    'Key 池': {
      eyebrow: 'Key Pool',
      title: 'Key 池',
      description: 'Key 只通过 credentialRef 进入运行期。',
      columns: ['Key Ref', 'Provider', '配额', '到期', '状态']
    },
    用量统计: {
      eyebrow: 'Usage',
      title: 'Token 用量',
      description: '按模型、项目和 API Key 统计 Token 与成本。',
      columns: ['项目', '模型', 'Token', '成本', '状态']
    }
  },
  skill: {
    注册中心: {
      eyebrow: 'Registry',
      title: 'Skill 注册中心',
      description: '集中管理 Skill 名称、协议、版本和发布状态。',
      columns: ['Skill', '协议', '版本', 'Owner', '状态']
    },
    Schema: {
      eyebrow: 'Schema',
      title: 'Schema 管理',
      description: '维护输入输出 Schema、兼容性和验证策略。',
      columns: ['Schema', 'Skill', '兼容性', 'Validator', '状态']
    },
    版本: {
      eyebrow: 'Versions',
      title: '版本管理',
      description: '管理草稿、发布、回滚和灰度版本。',
      columns: ['Skill', '当前版本', '候选版本', '灰度', '状态']
    },
    调用测试: {
      eyebrow: 'Sandbox',
      title: '调用测试',
      description: '用 mock credential 和 dry run 测试 Skill 调用。',
      columns: ['测试', 'Skill', '输入样例', '耗时', '状态']
    },
    治理策略: {
      eyebrow: 'Governance',
      title: '调用治理',
      description: '配置超时、鉴权、Schema lock 和沙箱策略。',
      columns: ['策略', '范围', '动作', '阈值', '状态']
    }
  },
  observability: {
    运营看板: {
      eyebrow: 'Incidents',
      title: '失败追踪',
      description: '按影响范围追踪告警、事故和处理状态。',
      columns: ['问题', '模块', '影响', '状态']
    },
    调用日志: {
      eyebrow: 'Call Logs',
      title: '调用日志',
      description: '聚合 Gateway、LLM、Skill 的业务调用。',
      columns: ['时间', '入口', '消费者', '摘要', '状态']
    },
    Trace: {
      eyebrow: 'Trace',
      title: '链路追踪',
      description: '串起请求从网关到模型、Skill、计费和审计的链路。',
      columns: ['Trace ID', '入口', '链路', '耗时', '状态']
    },
    失败追踪: {
      eyebrow: 'Failures',
      title: '失败追踪',
      description: '定位失败原因、影响模块和恢复进度。',
      columns: ['失败', '原因', '影响', '负责人', '状态']
    },
    审计事件: {
      eyebrow: 'Audit',
      title: '审计事件',
      description: '记录用户、配置、密钥和权限相关操作。',
      columns: ['时间', '模块', '动作', '对象', '状态']
    }
  },
  quota: {
    套餐: {
      eyebrow: 'Plans',
      title: '套餐与配额',
      description: '定义不同用户组或项目的用量、限速和计费方式。',
      columns: ['套餐', '适用对象', 'RPS', 'Token / day', '状态']
    },
    配额: {
      eyebrow: 'Quota',
      title: '配额策略',
      description: '按项目、API Key、模型和 Skill 配置硬限制。',
      columns: ['策略', 'Scope', '资源', '上限', '状态']
    },
    用量: {
      eyebrow: 'Usage',
      title: '项目用量',
      description: '所有调用链都会落到项目用量和成本分摊。',
      columns: ['项目', 'Token', 'Skill Calls', '成本', '状态']
    },
    发票: {
      eyebrow: 'Invoices',
      title: '发票',
      description: '后续可接真实账单，目前用 mock 数据演示周期。',
      columns: ['发票', '周期', '金额', 'Owner', '状态']
    },
    预算告警: {
      eyebrow: 'Budget',
      title: '预算告警',
      description: '在 70%、85%、100% 阈值上触发运营提示。',
      columns: ['项目', '预算', '当前', '阈值', '状态']
    }
  },
  credential: {
    'Secret Vault': {
      eyebrow: 'Vault',
      title: 'Secret Vault',
      description: '平台内部只展示 credentialRef，不展示明文。',
      columns: ['credentialRef', '用途', '范围', '到期', '状态']
    },
    'Provider Keys': {
      eyebrow: 'Provider Keys',
      title: '供应商 Key',
      description: '供应商 Key 由凭据中心统一托管。',
      columns: ['Key Ref', 'Provider', '绑定模块', '到期', '状态']
    },
    credentialRef: {
      eyebrow: 'References',
      title: 'credentialRef 引用',
      description: '查看哪些模块、Skill 或模型正在引用凭据。',
      columns: ['Ref', 'Consumer', 'Module', 'Last Resolve', '状态']
    },
    轮换任务: {
      eyebrow: 'Rotation',
      title: '轮换任务',
      description: '按到期时间或策略定期轮换密钥。',
      columns: ['任务', '凭据', '负责人', '窗口', '状态']
    },
    脱敏规则: {
      eyebrow: 'Masking',
      title: '脱敏规则',
      description: '统一配置 headers、payload 和控制台展示脱敏。',
      columns: ['规则', '字段', '策略', '范围', '状态']
    }
  },
  examples: {
    'API 文档': {
      eyebrow: 'API Docs',
      title: 'API 文档',
      description: '提供网关、模型、Skill 和计费相关 API 的最小参考。',
      columns: ['文档', '范围', '版本', 'Owner', '状态']
    },
    示例: {
      eyebrow: 'Examples',
      title: '示例',
      description: '用于快速理解平台接入路径的示例应用和模板。',
      columns: ['示例', '依赖模块', 'Owner', '接入状态', '状态']
    },
    FAQ: {
      eyebrow: 'FAQ',
      title: '常见问题',
      description: '记录接入、权限、模型调用、计费和故障排查问题。',
      columns: ['问题', '分类', 'Owner', '更新时间', '状态']
    },
    示例应用: {
      eyebrow: 'Apps',
      title: '示例应用',
      description: '每个示例应用都会关联 API Key、路由、模型、Skill 和配额。',
      columns: ['应用', '依赖模块', 'Owner', '接入状态', '状态']
    },
    'API Access': {
      eyebrow: 'API Access',
      title: 'API 接入',
      description: '接入应用的 endpoint、API Key scope 和调用计划。',
      columns: ['应用', 'Endpoint', 'API Key Scope', 'Plan', '状态']
    },
    Quickstart: {
      eyebrow: 'Quickstart',
      title: '接入步骤',
      description: '从创建应用到观察用量的端到端流程。',
      columns: ['步骤', '说明', '产物', 'Owner', '状态']
    },
    SDK: {
      eyebrow: 'SDK',
      title: 'SDK 与示例代码',
      description: '后续会接真实 SDK 包和版本。',
      columns: ['SDK', '语言', '包名', '版本', '状态']
    },
    模板: {
      eyebrow: 'Templates',
      title: '模板',
      description: '客服、RAG、AIGC 和运维助手模板。',
      columns: ['模板', '场景', '依赖', 'Owner', '状态']
    }
  }
}

const seedRows: Array<[ConsoleModuleId, string, string[]]> = [
  ['overview', '运营总览', ['LLM fallback rate 升高', '模型服务', '运维人员', 'Watching']],
  ['overview', '运营总览', ['billing-export 任务待确认', '计费与配额', '管理员', 'Pending']],
  ['overview', '服务健康', ['Gateway', '99.97%', '82ms', 'Normal']],
  ['overview', '服务健康', ['Model Service', '99.21%', '245ms', 'Degraded']],
  ['overview', '费用风险', ['aigc-lab', '$312', '86%', 'Warning']],
  ['overview', '费用风险', ['customer-service-agent', '$241', '61%', 'Normal']],
  ['overview', '接入进度', ['customer-service-agent', '使用用户', '观察用量', 'Ready']],
  ['overview', '接入进度', ['knowledge-rag', '开发人员', '绑定 Skill', 'Review']],

  ['gateway', 'API 路由', ['/api/v1/llm/**', 'platform-api.llm', 'API Key', '1200/min', 'Active']],
  ['gateway', 'API 路由', ['/api/v1/skills/**', 'platform-api.skill', 'API Key', '800/min', 'Active']],
  ['gateway', 'API 路由', ['/api/v1/admin/**', 'platform-api.admin', 'RBAC', 'internal', 'Locked']],
  ['gateway', '模型路由', ['chat-default', '客服 Agent', 'gpt-4.1-mini', 'claude-haiku', 'Active']],
  ['gateway', '模型路由', ['embedding-default', 'RAG', 'text-embedding-3', 'local-bge', 'Active']],
  ['gateway', '模型供应商', ['openai-primary', '7', 'cred.openai.default', '60%', 'Active']],
  ['gateway', '模型供应商', ['claude-fallback', '4', 'cred.claude.backup', '25%', 'Standby']],
  ['gateway', 'Skill 调用', ['search-knowledge', 'MCP', '/api/v1/skills/search', '8s', 'Published']],
  ['gateway', 'Skill 调用', ['send-message', 'HTTP', '/api/v1/skills/send-message', '8s', 'Draft']],
  ['gateway', '路由', ['/api/v1/llm/**', 'platform-api.llm', 'API Key', '1200/min', 'Active']],
  ['gateway', '路由', ['/api/v1/skills/**', 'platform-api.skill', 'API Key', '800/min', 'Active']],
  ['gateway', '上游服务', ['platform-api.llm', 'http://platform-api:8080/llm', 'HTTP', 'Healthy', 'Active']],
  ['gateway', '上游服务', ['audit-ingest', 'http://platform-api:8080/audit', 'HTTP', 'Healthy', 'Active']],
  ['gateway', '消费者', ['customer-service-agent', '使用用户', 'llm:chat skill:invoke', 'Business', 'Active']],
  ['gateway', '消费者', ['knowledge-rag', '开发人员', 'llm:embedding skill:read', 'Team', 'Active']],
  ['gateway', '限流策略', ['business-route-limit', 'Business plan', '1 min', '1200', 'Active']],
  ['gateway', '限流策略', ['team-route-limit', 'Team plan', '1 min', '300', 'Active']],
  ['gateway', '请求日志', ['POST /llm/chat', 'customer-service-agent', '76ms', '200', 'Success']],
  ['gateway', '请求日志', ['POST /skills/search', 'knowledge-rag', '118ms', '200', 'Success']],

  ['iam', '用户', ['lin.chen@anjing.ai', 'Platform', 'Administrator', 'Enabled', 'Active']],
  ['iam', '用户', ['dev-api@anjing.ai', 'Engineering', 'Developer', 'Enabled', 'Active']],
  ['iam', '组织', ['Platform', 'lin.chen', '12', 'Enterprise', 'Active']],
  ['iam', '组织', ['Customer Lab', 'agent-user', '5', 'Business', 'Active']],
  ['iam', '角色', ['Administrator', '全局管理', '3', 'all modules', 'Active']],
  ['iam', '角色', ['Operator', '运行期运维', '6', 'ops modules', 'Active']],
  ['iam', '权限矩阵', ['Administrator', 'Manage', 'Manage', 'Manage', 'Manage', 'Active']],
  ['iam', '权限矩阵', ['Operator', 'None', 'Read runtime', 'Manage quota', 'None', 'Active']],
  ['iam', 'API Key', ['ak_live_customer', 'customer-service-agent', 'llm:chat skill:invoke', '2026-09-01', 'Active']],
  ['iam', 'API Key', ['ak_live_knowledge', 'knowledge-rag', 'llm:embedding skill:read', '2026-08-15', 'Active']],
  ['iam', '凭据', ['cred.openai.default', 'LLM provider', 'Gateway / Model', '2026-07-01', 'Active']],
  ['iam', '凭据', ['cred.claude.backup', 'LLM fallback', 'Gateway / Model', '2026-06-28', 'Expiring']],
  ['iam', '凭据', ['cred.skill.http.default', 'HTTP Skill', 'Gateway / Skill', '2026-09-12', 'Active']],
  ['iam', 'SSO/OAuth', ['GitHub', 'gh_anjing_console', '/oauth/github/callback', 'admin only', 'Draft']],
  ['iam', 'SSO/OAuth', ['Google', 'google_console', '/oauth/google/callback', 'all users', 'Draft']],

  ['llm', '供应商', ['openai-primary', '7', '4 keys', '60%', 'Active']],
  ['llm', '供应商', ['claude-fallback', '4', '2 keys', '25%', 'Standby']],
  ['llm', '模型目录', ['gpt-4.1-mini', 'chat', 'openai-primary', '128k', 'Active']],
  ['llm', '模型目录', ['text-embedding-3', 'embedding', 'openai-primary', '8k', 'Active']],
  ['llm', '路由策略', ['chat-default', '客服 Agent', 'gpt-4.1-mini', 'claude-haiku', 'Active']],
  ['llm', '路由策略', ['embedding-default', 'RAG', 'text-embedding-3', 'local-bge', 'Active']],
  ['llm', 'Key 池', ['cred.openai.default', 'openai-primary', '8M/day', '2026-07-01', 'Active']],
  ['llm', 'Key 池', ['cred.claude.backup', 'claude-fallback', '2M/day', '2026-06-28', 'Expiring']],
  ['llm', '用量统计', ['customer-service-agent', 'gpt-4.1-mini', '2.4M', '$241', 'Tracking']],
  ['llm', '用量统计', ['knowledge-rag', 'text-embedding-3', '1.8M', '$168', 'Tracking']],

  ['skill', '注册中心', ['search-knowledge', 'MCP', 'v1.4.0', 'RAG team', 'Published']],
  ['skill', '注册中心', ['send-message', 'HTTP', 'v0.9.2', 'CRM team', 'Draft']],
  ['skill', 'Schema', ['search-knowledge.input', 'search-knowledge', 'Backward', 'Strict', 'Active']],
  ['skill', 'Schema', ['send-message.input', 'send-message', 'Draft', 'Strict', 'Review']],
  ['skill', '版本', ['search-knowledge', 'v1.4.0', 'v1.5.0-beta', '10%', 'Canary']],
  ['skill', '版本', ['ticket-create', 'v1.1.0', 'v1.1.1', '0%', 'Ready']],
  ['skill', '调用测试', ['rag-smoke-test', 'search-knowledge', 'query: refund policy', '214ms', 'Passed']],
  ['skill', '调用测试', ['crm-message-test', 'send-message', 'template: welcome', '188ms', 'Pending']],
  ['skill', '治理策略', ['default-timeout', 'all skills', 'timeout', '8s', 'Active']],
  ['skill', '治理策略', ['schema-lock', 'published skills', 'block breaking change', 'strict', 'Active']],

  ['observability', '运营看板', ['llm-timeout-spike', '模型服务', '42 requests', 'Investigating']],
  ['observability', '运营看板', ['gateway-5xx', '网关管理', '11 requests', 'Watching']],
  ['observability', '调用日志', ['12:40:22', 'POST /llm/chat', 'customer-service-agent', 'fallback succeeded', 'Success']],
  ['observability', '调用日志', ['12:39:51', 'POST /skills/search', 'knowledge-rag', 'schema validated', 'Success']],
  ['observability', 'Trace', ['trc_1029', 'POST /llm/chat', 'gateway > llm > quota > audit', '221ms', 'Success']],
  ['observability', 'Trace', ['trc_1030', 'POST /skills/search', 'gateway > skill > credential > audit', '188ms', 'Success']],
  ['observability', '失败追踪', ['provider-timeout', 'upstream timeout', '42 calls', '运维人员', 'Investigating']],
  ['observability', '失败追踪', ['rate-limit-hit', 'quota exceeded', '27 calls', '运维人员', 'Expected']],
  ['observability', '审计事件', ['12:38:07', '用户与权限', 'role granted', 'dev-api@anjing.ai', 'Success']],
  ['observability', '审计事件', ['12:37:30', 'Skill Hub', 'version published', 'search-knowledge v1.4.0', 'Success']],

  ['quota', '套餐', ['Free', 'trial users', '20', '50K', 'Active']],
  ['quota', '套餐', ['Business', 'production agents', '1200', '10M', 'Active']],
  ['quota', '配额', ['default-token-quota', 'Business', 'Token', '10M/day', 'Active']],
  ['quota', '配额', ['skill-daily-quota', 'Team', 'Skill Calls', '100K/day', 'Active']],
  ['quota', '用量', ['customer-service-agent', '2.4M', '18.2K', '$241', 'Normal']],
  ['quota', '用量', ['aigc-lab', '3.1M', '4.8K', '$312', 'Warning']],
  ['quota', '发票', ['inv_2026_06_customer', '2026-06', '$241', 'Customer Lab', 'Draft']],
  ['quota', '发票', ['inv_2026_06_platform', '2026-06', '$842', 'Platform', 'Pending']],
  ['quota', '预算告警', ['aigc-lab', '$360/day', '$312', '85%', 'Warning']],
  ['quota', '预算告警', ['customer-service-agent', '$400/day', '$241', '70%', 'Normal']],

  ['credential', 'Secret Vault', ['cred.openai.default', 'LLM provider', 'Model Service', '2026-07-01', 'Active']],
  ['credential', 'Secret Vault', ['cred.claude.backup', 'LLM fallback', 'Model Service', '2026-06-28', 'Expiring']],
  ['credential', 'Provider Keys', ['cred.openai.default', 'openai-primary', 'Model Service', '2026-07-01', 'Active']],
  ['credential', 'Provider Keys', ['cred.webhook.signing', 'internal webhook', 'API Gateway', '2026-08-03', 'Active']],
  ['credential', 'credentialRef', ['cred.skill.http.default', 'send-message', 'Skill Hub', '12:22', 'Active']],
  ['credential', 'credentialRef', ['cred.openai.default', 'chat-default', 'Model Service', '12:40', 'Active']],
  ['credential', '轮换任务', ['rotate-claude-backup', 'cred.claude.backup', '运维人员', '2026-06-18', 'Scheduled']],
  ['credential', '轮换任务', ['verify-openai-default', 'cred.openai.default', '运维人员', '2026-06-20', 'Pending']],
  ['credential', '脱敏规则', ['mask-auth-header', 'Authorization', 'Full mask', 'global', 'Active']],
  ['credential', '脱敏规则', ['mask-api-key', 'apiKey', 'Last 4 only', 'console', 'Active']],

  ['examples', '示例应用', ['agent-customer-service', 'Gateway / LLM / Skill', '使用用户', 'Ready', 'Active']],
  ['examples', '示例应用', ['agent-knowledge', 'LLM / Skill / Credential', '使用用户', 'Ready', 'Active']],
  ['examples', 'API 文档', ['Gateway API', 'route / model / skill', 'v1', '开发人员', 'Ready']],
  ['examples', 'API 文档', ['Billing API', 'usage / invoice', 'v1', '管理员', 'Draft']],
  ['examples', '示例', ['客服 Agent', 'Gateway / Model / Skill', '使用用户', 'Ready', 'Active']],
  ['examples', '示例', ['知识库 RAG', 'Gateway / Model / Skill', '使用用户', 'Ready', 'Active']],
  ['examples', 'FAQ', ['API Key 过期怎么办', 'Access', '管理员', '2026-06-10', 'Ready']],
  ['examples', 'FAQ', ['模型调用失败怎么排查', 'Gateway', '运维人员', '2026-06-10', 'Ready']],
  ['examples', 'API Access', ['agent-customer-service', '/api/v1/llm/chat', 'llm:chat skill:invoke', 'Business', 'Active']],
  ['examples', 'API Access', ['agent-knowledge', '/api/v1/skills/search', 'llm:embedding skill:read', 'Team', 'Active']],
  ['examples', 'Quickstart', ['1', '创建应用与 API Key', 'appId / key scope', '使用用户', 'Ready']],
  ['examples', 'Quickstart', ['2', '选择模型路由', 'model alias', '开发人员', 'Ready']],
  ['examples', 'SDK', ['TypeScript SDK', 'TypeScript', '@anjing-ai-platform/sdk', '0.1.0', 'Planned']],
  ['examples', 'SDK', ['Java SDK', 'Java', 'io.anjing.platform', '0.1.0', 'Planned']],
  ['examples', '模板', ['客服 Agent', 'customer service', 'Gateway / LLM / Skill', '使用用户', 'Ready']],
  ['examples', '模板', ['RAG Agent', 'knowledge base', 'LLM / Skill / Credential', '使用用户', 'Ready']]
]

const actionSpecs: Record<ConsoleModuleId, ActionSpec> = {
  overview: {
    title: '处理运营待办',
    description: '把一个待办标记为已处理，并写入审计事件。',
    fields: [{ id: 'target', label: '待办对象', defaultValue: 'billing-export 任务待确认' }],
    impact: ['更新运营总览状态', '写入审计事件', '追加实时调用日志']
  },
  gateway: {
    title: '新增网关路由',
    description: '创建 Route，并联动消费者、请求日志和审计事件。',
    fields: [
      { id: 'route', label: 'Route', defaultValue: '/api/v1/demo-agent/**' },
      { id: 'upstream', label: 'Upstream', defaultValue: 'platform-api.demo' },
      { id: 'rateLimit', label: 'Rate Limit', defaultValue: '600/min' }
    ],
    impact: ['新增网关路由', '生成一条请求日志', '运营看板出现发布审计']
  },
  iam: {
    title: '邀请用户',
    description: '邀请用户后会创建用户记录，并为后续 API Key 审批留出入口。',
    fields: [
      { id: 'email', label: '邮箱', defaultValue: 'new-user@anjing.ai' },
      { id: 'role', label: '角色', defaultValue: 'Developer', options: ['User', 'Developer', 'Operator', 'Administrator'] },
      { id: 'org', label: '组织', defaultValue: 'Engineering' }
    ],
    impact: ['新增用户', '写入权限审计', '运营总览出现接入待办']
  },
  llm: {
    title: '新增模型供应商',
    description: '供应商会绑定 credentialRef，并加入模型路由候选。',
    fields: [
      { id: 'provider', label: '供应商', defaultValue: 'openai-compatible-demo' },
      { id: 'model', label: '默认模型', defaultValue: 'demo-chat-fast' },
      { id: 'credentialRef', label: 'credentialRef', defaultValue: 'cred.demo.provider' }
    ],
    impact: ['新增模型供应商', '新增 Key 池引用', '凭据中心同步引用']
  },
  skill: {
    title: '注册 Skill',
    description: 'Skill 会进入注册中心、Schema 管理和调用测试。',
    fields: [
      { id: 'skillName', label: 'Skill 名称', defaultValue: 'demo-ticket-search' },
      { id: 'protocol', label: '协议', defaultValue: 'HTTP', options: ['HTTP', 'MCP', 'INTERNAL'] },
      { id: 'owner', label: 'Owner', defaultValue: 'Support team' }
    ],
    impact: ['新增 Skill', '生成 Schema 草稿', '创建沙箱测试']
  },
  observability: {
    title: '处理告警',
    description: '模拟把告警从 Investigating 推进到 Resolved。',
    fields: [{ id: 'incident', label: '告警', defaultValue: 'llm-timeout-spike' }],
    impact: ['更新失败追踪状态', '写入审计事件', '追加处理日志']
  },
  quota: {
    title: '新增套餐',
    description: '新增套餐后可被 API Key、消费者和项目用量引用。',
    fields: [
      { id: 'plan', label: '套餐', defaultValue: 'Startup' },
      { id: 'rps', label: 'RPS', defaultValue: '100' },
      { id: 'tokenLimit', label: 'Token / day', defaultValue: '1M' }
    ],
    impact: ['新增套餐', '创建默认配额', '写入计费审计']
  },
  credential: {
    title: '新增凭据',
    description: '凭据只以 credentialRef 暴露给业务模块。',
    fields: [
      { id: 'credentialRef', label: 'credentialRef', defaultValue: 'cred.demo.integration' },
      { id: 'purpose', label: '用途', defaultValue: 'HTTP Skill' },
      { id: 'expiresAt', label: '到期时间', defaultValue: '2026-09-30' }
    ],
    impact: ['新增 Secret Vault 记录', '创建轮换任务', '追加读取控制审计']
  },
  examples: {
    title: '创建接入应用',
    description: '端到端创建一个应用，并联动 API Key、网关消费者、配额、用量和审计。',
    fields: [
      { id: 'appName', label: '应用名称', defaultValue: 'demo-agent-workbench' },
      { id: 'owner', label: 'Owner', defaultValue: '使用用户' },
      { id: 'plan', label: '套餐', defaultValue: 'Business', options: ['Free', 'Team', 'Business', 'Enterprise'] }
    ],
    impact: ['新增示例应用', '生成 API Access', '创建 API Key', '加入网关消费者', '绑定套餐与用量', '写入审计和调用日志']
  }
}

interface ConsoleState {
  records: ConsoleRecord[]
  lastMessage: string
}

function nowLabel() {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date())
}

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`
}

function buildRecord(moduleId: ConsoleModuleId, tab: string, values: string[], id = createId(moduleId)): ConsoleRecord {
  const workspace = workspaceTabs[moduleId][tab]
  const cells = workspace.columns.reduce<Record<string, string>>((result, column, index) => {
    result[column] = values[index] || ''
    return result
  }, {})
  const owner = cells.Owner || cells['负责人'] || cells['组织'] || cells['适用对象'] || cells['模块'] || moduleLabel[moduleId]
  const status = values[workspace.columns.length - 1] || 'Active'

  return {
    id,
    moduleId,
    tab,
    title: values[0] || id,
    status,
    owner,
    updatedAt: nowLabel(),
    cells,
    details: workspace.columns.map((column) => ({ label: column, value: cells[column] || '-' })),
    related: [
      { label: moduleLabel[moduleId], route: routeByModule[moduleId] },
      { label: '运营总览', route: routeByModule.observability }
    ]
  }
}

function createInitialState(): ConsoleState {
  return {
    records: seedRows.map(([moduleId, tab, values], index) => buildRecord(moduleId, tab, values, `${moduleId}_${index}`)),
    lastMessage: 'Mock 数据已就绪'
  }
}

function readStoredState(): ConsoleState {
  if (typeof window === 'undefined') {
    return createInitialState()
  }

  const stored = window.localStorage.getItem(storageKey)
  if (!stored) {
    return createInitialState()
  }

  try {
    const parsed = JSON.parse(stored) as ConsoleState
    if (!Array.isArray(parsed.records)) {
      return createInitialState()
    }
    return parsed
  } catch {
    return createInitialState()
  }
}

const state = reactive<ConsoleState>(readStoredState())

function persist() {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(storageKey, JSON.stringify(state))
  }
}

function addRecord(moduleId: ConsoleModuleId, tab: string, values: string[]) {
  const record = buildRecord(moduleId, tab, values)
  state.records.unshift(record)
  return record
}

function addAudit(moduleId: ConsoleModuleId, action: string, target: string, status = 'Success') {
  addRecord('observability', '审计事件', [nowLabel(), moduleLabel[moduleId], action, target, status])
  addRecord('overview', '运营总览', [target, moduleLabel[moduleId], '当前用户', status])
}

function findFirst(moduleId: ConsoleModuleId, tab: string, title: string) {
  return state.records.find((record) => record.moduleId === moduleId && record.tab === tab && record.title === title)
}

function executeAction(moduleId: ConsoleModuleId, draft: Record<string, string>) {
  switch (moduleId) {
    case 'overview': {
      const target = draft.target || '运营待办'
      const todo = findFirst('overview', '运营总览', target)
      if (todo) {
        todo.status = 'Resolved'
        todo.cells['状态'] = 'Resolved'
        todo.updatedAt = nowLabel()
      }
      addRecord('observability', '调用日志', [nowLabel(), 'console action', 'admin-console', `resolved ${target}`, 'Success'])
      addAudit(moduleId, 'resolve todo', target)
      state.lastMessage = `已处理待办：${target}`
      break
    }
    case 'gateway': {
      const route = draft.route || '/api/v1/demo-agent/**'
      const upstream = draft.upstream || 'platform-api.demo'
      const rateLimit = draft.rateLimit || '600/min'
      addRecord('gateway', 'API 路由', [route, upstream, 'API Key', rateLimit, 'Draft'])
      addRecord('gateway', '请求日志', [`POST ${route.replace('/**', '/invoke')}`, 'demo-agent-workbench', '64ms', '201', 'Mocked'])
      addAudit(moduleId, 'create route', route)
      state.lastMessage = `已创建网关路由：${route}`
      break
    }
    case 'iam': {
      const email = draft.email || 'new-user@anjing.ai'
      const role = draft.role || 'Developer'
      const org = draft.org || 'Engineering'
      addRecord('iam', '用户', [email, org, role, 'Pending', 'Invited'])
      addRecord('overview', '接入进度', [email, role, '完成首次登录', 'Invited'])
      addAudit(moduleId, 'invite user', email)
      state.lastMessage = `已邀请用户：${email}`
      break
    }
    case 'llm': {
      const provider = draft.provider || 'openai-compatible-demo'
      const model = draft.model || 'demo-chat-fast'
      const credentialRef = draft.credentialRef || 'cred.demo.provider'
      addRecord('llm', '供应商', [provider, '1', '1 key', '10%', 'Testing'])
      addRecord('llm', '模型目录', [model, 'chat', provider, '32k', 'Testing'])
      addRecord('llm', 'Key 池', [credentialRef, provider, '1M/day', '2026-09-30', 'Testing'])
      addRecord('credential', 'credentialRef', [credentialRef, provider, 'Model Service', nowLabel(), 'Testing'])
      addAudit(moduleId, 'create provider', provider)
      state.lastMessage = `已新增模型供应商：${provider}`
      break
    }
    case 'skill': {
      const skillName = draft.skillName || 'demo-ticket-search'
      const protocol = draft.protocol || 'HTTP'
      const owner = draft.owner || 'Support team'
      addRecord('skill', '注册中心', [skillName, protocol, 'v0.1.0', owner, 'Draft'])
      addRecord('skill', 'Schema', [`${skillName}.input`, skillName, 'Draft', 'Strict', 'Draft'])
      addRecord('skill', '调用测试', [`${skillName}-smoke-test`, skillName, 'mock input', '0ms', 'Ready'])
      addAudit(moduleId, 'register skill', skillName)
      state.lastMessage = `已注册 Skill：${skillName}`
      break
    }
    case 'observability': {
      const incident = draft.incident || 'llm-timeout-spike'
      const target = findFirst('observability', '运营看板', incident)
      if (target) {
        target.status = 'Resolved'
        target.cells['状态'] = 'Resolved'
        target.updatedAt = nowLabel()
      }
      addRecord('observability', '调用日志', [nowLabel(), 'incident workflow', 'ops-oncall', `resolved ${incident}`, 'Success'])
      addAudit(moduleId, 'resolve incident', incident)
      state.lastMessage = `已处理告警：${incident}`
      break
    }
    case 'quota': {
      const plan = draft.plan || 'Startup'
      const rps = draft.rps || '100'
      const tokenLimit = draft.tokenLimit || '1M'
      addRecord('quota', '套餐', [plan, 'new projects', rps, tokenLimit, 'Draft'])
      addRecord('quota', '配额', [`${plan.toLowerCase()}-token-quota`, plan, 'Token', `${tokenLimit}/day`, 'Draft'])
      addAudit(moduleId, 'create plan', plan)
      state.lastMessage = `已新增套餐：${plan}`
      break
    }
    case 'credential': {
      const credentialRef = draft.credentialRef || 'cred.demo.integration'
      const purpose = draft.purpose || 'HTTP Skill'
      const expiresAt = draft.expiresAt || '2026-09-30'
      addRecord('credential', 'Secret Vault', [credentialRef, purpose, 'shared', expiresAt, 'Active'])
      addRecord('credential', '轮换任务', [`rotate-${credentialRef.replace(/\./g, '-')}`, credentialRef, '运维人员', expiresAt, 'Scheduled'])
      addAudit(moduleId, 'create credential', credentialRef)
      state.lastMessage = `已新增凭据：${credentialRef}`
      break
    }
    case 'examples': {
      const appName = draft.appName || 'demo-agent-workbench'
      const owner = draft.owner || '使用用户'
      const plan = draft.plan || 'Business'
      addRecord('examples', '示例', [appName, 'Gateway / Model / Skill', owner, 'Provisioning', 'Active'])
      addRecord('examples', '示例应用', [appName, 'Gateway / LLM / Skill', owner, 'Provisioning', 'Active'])
      addRecord('examples', 'API Access', [appName, '/api/v1/llm/chat', 'llm:chat skill:invoke', plan, 'Active'])
      addRecord('iam', 'API Key', [`ak_live_${appName.replace(/-/g, '_')}`, appName, 'llm:chat skill:invoke', '2026-09-30', 'Active'])
      addRecord('gateway', '消费者', [appName, owner, 'llm:chat skill:invoke', plan, 'Active'])
      addRecord('quota', '用量', [appName, '0', '0', '$0', 'Ready'])
      addRecord('observability', 'Trace', [createId('trc'), 'POST /llm/chat', 'gateway > llm > quota > audit', '0ms', 'Ready'])
      addAudit(moduleId, 'create application', appName)
      state.lastMessage = `已创建接入应用，并完成 API Key、网关消费者、配额和审计联动：${appName}`
      break
    }
  }

  persist()
  return state.lastMessage
}

function executeSecondary(moduleId: ConsoleModuleId) {
  const action = moduleId === 'quota' ? 'export billing report' : 'export module snapshot'
  addAudit(moduleId, action, moduleLabel[moduleId])
  state.lastMessage = `已生成 ${moduleLabel[moduleId]} 的 mock 导出记录`
  persist()
  return state.lastMessage
}

function simulateTraffic(moduleId: ConsoleModuleId) {
  const targetModule = moduleLabel[moduleId]
  const consumer = moduleId === 'examples' ? 'demo-agent-workbench' : `${moduleId}-console`
  addRecord('gateway', '请求日志', [`POST /${moduleId}/mock`, consumer, '93ms', '200', 'Success'])
  addRecord('observability', '调用日志', [nowLabel(), `POST /${moduleId}/mock`, consumer, `${targetModule} mock call`, 'Success'])
  addRecord('observability', 'Trace', [createId('trc'), `POST /${moduleId}/mock`, 'gateway > module > quota > audit', '93ms', 'Success'])
  addRecord('quota', '用量', [consumer, '12K', '18', '$1.20', 'Normal'])
  addAudit(moduleId, 'simulate call flow', consumer)
  state.lastMessage = `已模拟一次 ${targetModule} 调用链路，日志、Trace、用量和审计已同步`
  persist()
  return state.lastMessage
}

function updateRecordStatus(recordId: string, status: string) {
  const record = state.records.find((item) => item.id === recordId)
  if (!record) {
    return ''
  }

  record.status = status
  const statusKey = Object.keys(record.cells).find((key) => key.toLowerCase() === 'status' || key === '状态')
  if (statusKey) {
    record.cells[statusKey] = status
  }
  record.details = record.details.map((detail) => (detail.label === statusKey ? { ...detail, value: status } : detail))
  record.updatedAt = nowLabel()
  addAudit(record.moduleId, 'update status', record.title, status)
  state.lastMessage = `已更新 ${record.title} 为 ${status}`
  persist()
  return state.lastMessage
}

function resetMockData() {
  const fresh = createInitialState()
  state.records = fresh.records
  state.lastMessage = 'Mock 数据已重置'
  persist()
  return state.lastMessage
}

export function useMockConsole() {
  return {
    state,
    workspaceTabs,
    actionSpecs,
    routeByModule,
    moduleLabel,
    executeAction,
    executeSecondary,
    simulateTraffic,
    updateRecordStatus,
    resetMockData
  }
}
