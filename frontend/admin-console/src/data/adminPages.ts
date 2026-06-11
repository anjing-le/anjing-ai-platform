import type { AdminPageDefinition } from '@/types/adminPage'

export const adminPages: AdminPageDefinition[] = [
  {
    id: 'overview',
    layout: 'dashboard',
    eyebrow: 'Operations',
    title: '运营总览',
    description: '一个入口看清平台是否健康、哪些调用异常、哪些成本或权限风险需要处理。',
    primaryAction: '处理待办',
    secondaryAction: '导出日报',
    tabs: ['运营总览', '服务健康', '费用风险'],
    metrics: [
      { label: '今日调用', value: '128.4K', note: 'Gateway / Model / Skill' },
      { label: '成功率', value: '99.21%', note: '近 24 小时' },
      { label: '今日成本', value: '$842', note: 'Token 与 Skill 调用' },
      { label: '待处理', value: '7', note: '告警 / 权限 / 账单' }
    ],
    primaryTable: {
      eyebrow: 'Operations',
      title: '今日运营事件',
      columns: ['事件', '模块', '负责人', '状态'],
      rows: []
    },
    panels: [
      {
        eyebrow: 'Health',
        title: '运行健康',
        items: [
          { label: 'Gateway', value: 'Normal', note: 'P95 82ms' },
          { label: 'Model Routing', value: 'Degraded', note: 'fallback rate 4.2%' },
          { label: 'Billing Meter', value: 'Normal', note: 'no lag' }
        ]
      },
      {
        eyebrow: 'Focus',
        title: '今日重点',
        items: [
          { label: '预算告警', value: '1', note: 'aigc-lab approaching limit' },
          { label: '权限审批', value: '2', note: 'developer role requests' },
          { label: '凭据到期', value: '3', note: 'provider keys expiring' }
        ]
      }
    ]
  },
  {
    id: 'iam',
    layout: 'management',
    eyebrow: 'Access',
    title: '用户与权限',
    description: '把用户、组织、角色、权限、API Key 和 credentialRef 收到一个访问控制中心。',
    primaryAction: '邀请用户',
    secondaryAction: '新增角色',
    tabs: ['用户', '权限矩阵', 'API Key', '凭据'],
    metrics: [
      { label: '用户', value: '42', note: '活跃 31' },
      { label: '组织', value: '6', note: 'workspace / tenant' },
      { label: 'API Key', value: '16', note: '有效密钥' },
      { label: '凭据引用', value: '28', note: 'credentialRef' }
    ],
    primaryTable: {
      eyebrow: 'Users',
      title: '用户列表',
      columns: ['用户', '组织', '角色', 'MFA', '状态'],
      rows: []
    },
    panels: [
      {
        eyebrow: 'Policy',
        title: '访问策略',
        items: [
          { label: 'MFA', value: 'Required', note: 'admin / developer / operator' },
          { label: 'Token TTL', value: '12h', note: 'console session' },
          { label: 'API Key Scope', value: 'route + model', note: 'least privilege' }
        ]
      },
      {
        eyebrow: 'Secrets',
        title: '凭据治理',
        items: [
          { label: '明文读取', value: 'Blocked', note: 'runtime only' },
          { label: '轮换周期', value: '90d', note: 'default policy' },
          { label: '脱敏展示', value: 'Enabled', note: 'last 4 only' }
        ]
      }
    ]
  },
  {
    id: 'gateway',
    layout: 'management',
    eyebrow: 'Gateway',
    title: '网关与模型',
    description: '网关是统一入口：API 路由、模型路由、供应商、Skill 调用、限流和请求日志都在这里配置。',
    primaryAction: '新增路由',
    secondaryAction: '查看日志',
    tabs: ['API 路由', '模型路由', '请求日志'],
    metrics: [
      { label: 'API 路由', value: '24', note: '生产入口' },
      { label: '模型别名', value: '8', note: 'chat / embedding / rerank' },
      { label: '供应商', value: '5', note: 'OpenAI / Claude / Gemini' },
      { label: 'P95 延迟', value: '82ms', note: '近 1 小时' }
    ],
    primaryTable: {
      eyebrow: 'Routes',
      title: 'API 路由',
      columns: ['Route', 'Upstream', 'Auth', 'Rate Limit', 'Status'],
      rows: []
    },
    panels: [
      {
        eyebrow: 'Runtime',
        title: '运行策略',
        items: [
          { label: '鉴权前置', value: 'API Key + RBAC', note: 'all routes' },
          { label: '模型 fallback', value: 'Enabled', note: 'provider timeout' },
          { label: '请求审计', value: 'Enabled', note: 'body masked' }
        ]
      },
      {
        eyebrow: 'Release',
        title: '发布检查',
        items: [
          { label: '灰度路由', value: '5%', note: 'model route canary' },
          { label: 'Schema diff', value: '1 pending', note: 'skill invocation' },
          { label: '回滚版本', value: 'ready', note: 'v2026.06.08' }
        ]
      }
    ]
  },
  {
    id: 'quota',
    layout: 'management',
    eyebrow: 'Billing',
    title: '计费与配额',
    description: '统一管理套餐、配额、用量、账单、发票和预算告警，后续直接接真实计费。',
    primaryAction: '新增套餐',
    secondaryAction: '导出账单',
    tabs: ['套餐', '用量', '预算告警'],
    metrics: [
      { label: '本月收入', value: '$18.4K', note: 'estimated' },
      { label: '今日 Token', value: '8.6M', note: '+14%' },
      { label: '预算告警', value: '3', note: 'near limit' },
      { label: '超限拒绝', value: '27', note: 'today' }
    ],
    primaryTable: {
      eyebrow: 'Plans',
      title: '套餐与配额',
      columns: ['套餐', '适用对象', 'RPS', 'Token / day', '状态'],
      rows: []
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
    ]
  },
  {
    id: 'examples',
    layout: 'management',
    eyebrow: 'Help',
    title: '帮助文档',
    description: '把接入说明、API 文档、SDK、示例和 FAQ 放到一个轻量入口，减少后台主导航复杂度。',
    primaryAction: '新增示例',
    secondaryAction: '查看文档',
    tabs: ['Quickstart', 'API 文档', 'FAQ'],
    metrics: [
      { label: '文档', value: '12', note: 'quickstart / api / sdk' },
      { label: '示例', value: '3', note: '客服 / RAG / AIGC' },
      { label: 'SDK', value: '2', note: 'TypeScript / Java' },
      { label: '待补充', value: '4', note: 'planned docs' }
    ],
    primaryTable: {
      eyebrow: 'Quickstart',
      title: '接入步骤',
      columns: ['步骤', '说明', '产物', 'Owner', '状态'],
      rows: []
    },
    panels: [
      {
        eyebrow: 'Start',
        title: '推荐入口',
        items: [
          { label: '5 分钟接入', value: 'Quickstart', note: 'app + key + route' },
          { label: 'API Reference', value: 'Ready', note: 'gateway endpoints' },
          { label: 'SDK Guide', value: 'Draft', note: 'client examples' }
        ]
      },
      {
        eyebrow: 'Support',
        title: '帮助状态',
        items: [
          { label: 'FAQ', value: '6', note: 'common issues' },
          { label: '示例模板', value: '3', note: 'agent / rag / aigc' },
          { label: 'OpenAPI', value: 'Ready', note: 'contracts/openapi' }
        ]
      }
    ]
  }
]
