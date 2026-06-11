import { reactive } from 'vue'

export type ConsoleModuleId = 'overview' | 'gateway' | 'iam' | 'quota' | 'examples'

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

const storageKey = 'anjing-ai-platform-console-mock-v5'

const routeByModule: Record<ConsoleModuleId, string> = {
  overview: '/console/overview',
  gateway: '/console/gateway',
  iam: '/console/iam',
  quota: '/console/quota',
  examples: '/console/docs'
}

const moduleLabel: Record<ConsoleModuleId, string> = {
  overview: '运营总览',
  gateway: '网关与模型',
  iam: '用户与权限',
  quota: '计费与配额',
  examples: '帮助文档'
}

export const workspaceTabs: Record<ConsoleModuleId, Record<string, WorkspaceTab>> = {
  overview: {
    运营总览: {
      eyebrow: 'Operations',
      title: '今日运营事项',
      description: '只保留需要人关注的告警、审批、发布和成本风险。',
      columns: ['事项', '来源', '负责人', '状态']
    },
    服务健康: {
      eyebrow: 'Health',
      title: '服务健康',
      description: '聚合 API、模型、计费和审计链路的核心运行状态。',
      columns: ['服务', 'SLO', 'P95', '状态']
    },
    调用与审计: {
      eyebrow: 'Logs',
      title: '调用与审计',
      description: '把请求日志、Trace 和关键操作审计收进运营视角。',
      columns: ['时间', '入口', '对象', '结果', '状态']
    }
  },
  gateway: {
    'API 路由': {
      eyebrow: 'Routes',
      title: 'API 路由',
      description: '统一管理业务系统、Agent 和内部工具的入口。',
      columns: ['Route', 'Upstream', 'Auth', 'Limit', '状态']
    },
    模型路由: {
      eyebrow: 'Models',
      title: '模型路由',
      description: '用统一别名屏蔽供应商差异，承载 fallback、成本和延迟策略。',
      columns: ['别名', '场景', '主模型', 'Fallback', '状态']
    },
    'Skill 调用': {
      eyebrow: 'Skills',
      title: 'Skill 调用',
      description: '把 Skill 作为网关后的工具能力统一注册、适配和治理。',
      columns: ['Skill', '协议', 'Route', '超时', '状态']
    },
    请求日志: {
      eyebrow: 'Request Log',
      title: '请求日志',
      description: '按请求查看鉴权、限流、路由命中和上游响应。',
      columns: ['请求', '消费者', '延迟', '结果', '状态']
    }
  },
  iam: {
    用户: {
      eyebrow: 'Users',
      title: '用户列表',
      description: '管理用户、组织、角色和登录安全。',
      columns: ['用户', '组织', '角色', 'MFA', '状态']
    },
    角色权限: {
      eyebrow: 'Roles',
      title: '角色权限',
      description: '定义管理员、使用用户、开发人员和运维人员能看到什么、能配置什么。',
      columns: ['角色', '可见入口', '可配置', '限制', '状态']
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
    }
  },
  quota: {
    套餐: {
      eyebrow: 'Plans',
      title: '套餐与配额',
      description: '定义不同用户组或项目的用量、限速和计费方式。',
      columns: ['套餐', '适用对象', 'RPS', 'Token / day', '状态']
    },
    用量: {
      eyebrow: 'Usage',
      title: '项目用量',
      description: '所有调用链都会落到项目用量和成本分摊。',
      columns: ['项目', 'Token', 'Skill Calls', '成本', '状态']
    },
    预算告警: {
      eyebrow: 'Budget',
      title: '预算告警',
      description: '在 70%、85%、100% 阈值上触发运营提示。',
      columns: ['项目', '预算', '当前', '阈值', '状态']
    }
  },
  examples: {
    Quickstart: {
      eyebrow: 'Quickstart',
      title: '接入步骤',
      description: '从创建应用到观察用量的端到端流程。',
      columns: ['步骤', '说明', '产物', 'Owner', '状态']
    },
    'API 文档': {
      eyebrow: 'API Docs',
      title: 'API 文档',
      description: '提供网关、模型、Skill 和计费相关 API 的最小参考。',
      columns: ['文档', '范围', '版本', 'Owner', '状态']
    },
    FAQ: {
      eyebrow: 'FAQ',
      title: '常见问题',
      description: '记录接入、权限、模型调用、计费和故障排查问题。',
      columns: ['问题', '分类', 'Owner', '更新时间', '状态']
    }
  }
}

const seedRows: Array<[ConsoleModuleId, string, string[]]> = [
  ['overview', '运营总览', ['模型 fallback 率升高', '网关与模型', '运维人员', 'Watching']],
  ['overview', '运营总览', ['aigc-lab 预算接近阈值', '计费与配额', '管理员', 'Warning']],
  ['overview', '运营总览', ['新项目 API Key 待审批', '用户与权限', '管理员', 'Pending']],
  ['overview', '服务健康', ['Gateway Runtime', '99.97%', '82ms', 'Normal']],
  ['overview', '服务健康', ['Model Routing', '99.21%', '245ms', 'Degraded']],
  ['overview', '服务健康', ['Metering Job', '99.99%', '1.4s lag', 'Normal']],
  ['overview', '调用与审计', ['12:40:22', 'POST /llm/chat', 'customer-service-agent', 'fallback succeeded', 'Success']],
  ['overview', '调用与审计', ['12:38:07', '用户与权限', 'role granted', 'dev-api@anjing.ai', 'Success']],

  ['gateway', 'API 路由', ['/api/v1/llm/**', 'gateway-api', 'API Key', '1200/min', 'Active']],
  ['gateway', 'API 路由', ['/api/v1/skills/**', 'gateway-api', 'API Key', '800/min', 'Active']],
  ['gateway', '模型路由', ['chat-default', '客服 Agent', 'gpt-4.1-mini', 'claude-haiku', 'Active']],
  ['gateway', '模型路由', ['embedding-default', 'RAG', 'text-embedding-3', 'local-bge', 'Active']],
  ['gateway', 'Skill 调用', ['search-knowledge', 'MCP', '/api/v1/skills/search', '8s', 'Published']],
  ['gateway', 'Skill 调用', ['send-message', 'HTTP', '/api/v1/skills/send-message', '8s', 'Draft']],
  ['gateway', '请求日志', ['POST /llm/chat', 'customer-service-agent', '76ms', '200', 'Success']],
  ['gateway', '请求日志', ['POST /skills/search', 'knowledge-rag', '118ms', '200', 'Success']],

  ['iam', '用户', ['lin.chen@anjing.ai', 'Platform', 'Administrator', 'Enabled', 'Active']],
  ['iam', '用户', ['dev-api@anjing.ai', 'Engineering', 'Developer', 'Enabled', 'Active']],
  ['iam', '角色权限', ['Administrator', '全部入口', '全部配置', '无', 'Active']],
  ['iam', '角色权限', ['Operator', '运营 / 网关 / 计费', '运行期策略', '不改开发配置', 'Active']],
  ['iam', 'API Key', ['ak_live_customer', 'customer-service-agent', 'llm:chat skill:invoke', '2026-09-01', 'Active']],
  ['iam', 'API Key', ['ak_live_knowledge', 'knowledge-rag', 'llm:embedding skill:read', '2026-08-15', 'Active']],
  ['iam', '凭据', ['cred.openai.default', 'LLM provider', 'Gateway / Model', '2026-07-01', 'Active']],
  ['iam', '凭据', ['cred.claude.backup', 'LLM fallback', 'Gateway / Model', '2026-06-28', 'Expiring']],

  ['quota', '套餐', ['Free', 'trial users', '20', '50K', 'Active']],
  ['quota', '套餐', ['Business', 'production agents', '1200', '10M', 'Active']],
  ['quota', '用量', ['customer-service-agent', '2.4M', '18.2K', '$241', 'Normal']],
  ['quota', '用量', ['aigc-lab', '3.1M', '4.8K', '$312', 'Warning']],
  ['quota', '预算告警', ['aigc-lab', '$360/day', '$312', '85%', 'Warning']],
  ['quota', '预算告警', ['customer-service-agent', '$400/day', '$241', '70%', 'Normal']],

  ['examples', 'Quickstart', ['1', '创建应用与 API Key', 'appId / key scope', '使用用户', 'Ready']],
  ['examples', 'Quickstart', ['2', '选择模型路由', 'model alias', '开发人员', 'Ready']],
  ['examples', 'API 文档', ['Gateway API', 'route / model / skill', 'v1', '开发人员', 'Ready']],
  ['examples', 'API 文档', ['Billing API', 'usage / budget', 'v1', '管理员', 'Draft']],
  ['examples', 'FAQ', ['API Key 过期怎么办', 'Access', '管理员', '2026-06-10', 'Ready']],
  ['examples', 'FAQ', ['模型调用失败怎么排查', 'Gateway', '运维人员', '2026-06-10', 'Ready']]
]

const actionSpecs: Record<ConsoleModuleId, ActionSpec> = {
  overview: {
    title: '处理运营事项',
    description: '把一个待办推进到已处理，并留下调用与审计记录。',
    fields: [{ id: 'target', label: '事项', defaultValue: '新项目 API Key 待审批' }],
    impact: ['更新运营状态', '追加调用与审计', '同步模块详情']
  },
  gateway: {
    title: '新增网关路由',
    description: '创建 API Route，并联动请求日志与运营审计。',
    fields: [
      { id: 'route', label: 'Route', defaultValue: '/api/v1/demo-agent/**' },
      { id: 'upstream', label: 'Upstream', defaultValue: 'gateway-api' },
      { id: 'rateLimit', label: 'Limit', defaultValue: '600/min' }
    ],
    impact: ['新增 API 路由', '生成请求日志', '写入运营审计']
  },
  iam: {
    title: '邀请用户',
    description: '邀请用户后创建用户记录，并进入权限审计。',
    fields: [
      { id: 'email', label: '邮箱', defaultValue: 'new-user@anjing.ai' },
      { id: 'role', label: '角色', defaultValue: 'Developer', options: ['User', 'Developer', 'Operator', 'Administrator'] },
      { id: 'org', label: '组织', defaultValue: 'Engineering' }
    ],
    impact: ['新增用户', '写入权限审计', '生成接入待办']
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
  examples: {
    title: '创建接入应用',
    description: '端到端创建一个应用，并联动 API Key、网关路由、用量和审计。',
    fields: [
      { id: 'appName', label: '应用名称', defaultValue: 'demo-agent-workbench' },
      { id: 'owner', label: 'Owner', defaultValue: '使用用户' },
      { id: 'plan', label: '套餐', defaultValue: 'Business', options: ['Free', 'Team', 'Business', 'Enterprise'] }
    ],
    impact: ['新增 Quickstart 记录', '创建 API Key', '加入网关路由', '绑定套餐与用量', '写入审计']
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
  const owner = cells.Owner || cells['负责人'] || cells['组织'] || cells['适用对象'] || cells['来源'] || moduleLabel[moduleId]
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
      { label: '运营总览', route: routeByModule.overview }
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
  addRecord('overview', '调用与审计', [nowLabel(), moduleLabel[moduleId], target, action, status])
}

function findFirst(moduleId: ConsoleModuleId, tab: string, title: string) {
  return state.records.find((record) => record.moduleId === moduleId && record.tab === tab && record.title === title)
}

function executeAction(moduleId: ConsoleModuleId, draft: Record<string, string>) {
  switch (moduleId) {
    case 'overview': {
      const target = draft.target || '运营事项'
      const todo = findFirst('overview', '运营总览', target)
      if (todo) {
        todo.status = 'Resolved'
        todo.cells['状态'] = 'Resolved'
        todo.updatedAt = nowLabel()
      }
      addAudit(moduleId, 'resolve todo', target)
      state.lastMessage = `已处理运营事项：${target}`
      break
    }
    case 'gateway': {
      const route = draft.route || '/api/v1/demo-agent/**'
      const upstream = draft.upstream || 'gateway-api'
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
      addRecord('overview', '运营总览', [`${email} 完成首次登录`, '用户与权限', role, 'Pending'])
      addAudit(moduleId, 'invite user', email)
      state.lastMessage = `已邀请用户：${email}`
      break
    }
    case 'quota': {
      const plan = draft.plan || 'Startup'
      const rps = draft.rps || '100'
      const tokenLimit = draft.tokenLimit || '1M'
      addRecord('quota', '套餐', [plan, 'new projects', rps, tokenLimit, 'Draft'])
      addRecord('quota', '预算告警', [plan, '$300/day', '$0', '70%', 'Ready'])
      addAudit(moduleId, 'create plan', plan)
      state.lastMessage = `已新增套餐：${plan}`
      break
    }
    case 'examples': {
      const appName = draft.appName || 'demo-agent-workbench'
      const owner = draft.owner || '使用用户'
      const plan = draft.plan || 'Business'
      addRecord('examples', 'Quickstart', ['3', `完成 ${appName} 接入`, 'appId / key / route', owner, 'Active'])
      addRecord('iam', 'API Key', [`ak_live_${appName.replace(/-/g, '_')}`, appName, 'llm:chat skill:invoke', '2026-09-30', 'Active'])
      addRecord('gateway', 'API 路由', [`/api/v1/${appName}/**`, 'gateway-api', 'API Key', '600/min', 'Draft'])
      addRecord('quota', '用量', [appName, '0', '0', '$0', plan])
      addAudit(moduleId, 'create application', appName)
      state.lastMessage = `已创建接入应用，并完成 API Key、网关路由、用量和审计联动：${appName}`
      break
    }
  }

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

export function useMockConsole() {
  return {
    state,
    workspaceTabs,
    actionSpecs,
    routeByModule,
    moduleLabel,
    executeAction,
    updateRecordStatus
  }
}
