import type { AdminPageDefinition } from '@/types/adminPage'

export const adminPages: AdminPageDefinition[] = [
  {
    id: 'overview',
    layout: 'dashboard',
    eyebrow: 'Operations',
    title: '运营总览',
    description: '进入后台后的工作台：只看平台是否健康、哪些事项需要处理、调用与审计是否正常。',
    primaryAction: '处理事项',
    tabs: ['运营总览', '服务健康', '调用与审计'],
    metrics: [
      { label: '今日调用', value: '128.4K', note: 'API / Model / Skill' },
      { label: '成功率', value: '99.21%', note: '近 24 小时' },
      { label: '待处理', value: '7', note: '告警 / 审批 / 预算' },
      { label: '今日成本', value: '$842', note: 'estimated' }
    ],
    primaryTable: {
      eyebrow: 'Operations',
      title: '今日运营事项',
      columns: ['事项', '来源', '负责人', '状态'],
      rows: []
    },
    panels: [
      {
        eyebrow: 'Focus',
        title: '今日重点',
        items: [
          { label: '先处理', value: '预算与权限审批', note: '影响接入和成本控制' },
          { label: '再观察', value: '模型 fallback', note: '确认供应商稳定性' },
          { label: '最后复盘', value: '调用与审计', note: '看关键链路是否闭环' }
        ]
      },
      {
        eyebrow: 'Scope',
        title: '合并范围',
        items: [
          { label: 'Observability', value: '已并入', note: '健康、日志、Trace、失败追踪' },
          { label: 'Audit', value: '已并入', note: '配置变更与权限操作审计' },
          { label: 'Ops Board', value: '保留', note: '后台默认首页后的工作台' }
        ]
      }
    ]
  },
  {
    id: 'iam',
    layout: 'management',
    eyebrow: 'Access',
    title: '用户与权限',
    description: '统一管理用户、角色权限、API Key 和 credentialRef，先把访问边界定义清楚。',
    primaryAction: '邀请用户',
    tabs: ['用户', '角色权限', 'API Key', '凭据'],
    metrics: [
      { label: '用户', value: '42', note: '活跃 31' },
      { label: '角色', value: '4', note: 'admin / user / developer / operator' },
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
        eyebrow: 'Roles',
        title: '角色边界',
        items: [
          { label: '管理员', value: '全部可见', note: '用户、网关、计费、文档' },
          { label: '使用用户', value: '接入与用量', note: '不看关键配置' },
          { label: '运维人员', value: '运行期配置', note: '不改开发侧网关配置' }
        ]
      },
      {
        eyebrow: 'Secrets',
        title: '凭据策略',
        items: [
          { label: '明文读取', value: 'Blocked', note: 'runtime only' },
          { label: '脱敏展示', value: 'Enabled', note: 'last 4 only' },
          { label: '轮换周期', value: '90d', note: 'default policy' }
        ]
      }
    ]
  },
  {
    id: 'gateway',
    layout: 'management',
    eyebrow: 'Gateway',
    title: '网关与模型',
    description: '把 API 网关、模型路由和 Skill 调用合到一个运行入口，减少后台导航复杂度。',
    primaryAction: '新增路由',
    tabs: ['API 路由', '模型路由', 'Skill 调用', '请求日志'],
    metrics: [
      { label: 'API 路由', value: '24', note: '生产入口' },
      { label: '模型别名', value: '8', note: 'chat / embedding / rerank' },
      { label: 'Skill', value: '12', note: 'published 9' },
      { label: 'P95 延迟', value: '82ms', note: '近 1 小时' }
    ],
    primaryTable: {
      eyebrow: 'Routes',
      title: 'API 路由',
      columns: ['Route', 'Upstream', 'Auth', 'Limit', '状态'],
      rows: []
    },
    panels: [
      {
        eyebrow: 'Runtime',
        title: '运行策略',
        items: [
          { label: '鉴权前置', value: 'API Key + RBAC', note: 'all routes' },
          { label: '模型 fallback', value: 'Enabled', note: 'provider timeout' },
          { label: 'Skill timeout', value: '8s', note: 'default policy' }
        ]
      },
      {
        eyebrow: 'Scope',
        title: '合并范围',
        items: [
          { label: 'API Gateway', value: '主入口', note: '路由、限流、请求日志' },
          { label: 'LLM Gateway', value: '已并入', note: '供应商、模型别名、fallback' },
          { label: 'Skill Hub', value: '已并入', note: '注册、协议、调用治理' }
        ]
      }
    ]
  },
  {
    id: 'quota',
    layout: 'management',
    eyebrow: 'Billing',
    title: '计费与配额',
    description: '把套餐、配额、用量和预算告警放在一个入口，后续再接真实账单与计费。',
    primaryAction: '新增套餐',
    tabs: ['套餐', '用量', '预算告警'],
    metrics: [
      { label: '本月成本', value: '$18.4K', note: 'estimated' },
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
          { label: '当前周期', value: '$4.8K', note: '未出账' },
          { label: '成本分摊', value: 'Project based', note: 'tags required' },
          { label: '计量延迟', value: '< 2s', note: 'mock target' }
        ]
      },
      {
        eyebrow: 'Controls',
        title: '配额控制',
        items: [
          { label: '硬限制', value: 'Enabled', note: 'block when exceeded' },
          { label: '软告警', value: '70% / 85%', note: 'console notice' },
          { label: '重置窗口', value: 'daily', note: 'UTC+8 reset' }
        ]
      }
    ]
  },
  {
    id: 'examples',
    layout: 'management',
    eyebrow: 'Docs',
    title: '帮助文档',
    description: '给使用者和开发者一个轻量接入入口：Quickstart、API 文档和常见问题先跑通。',
    primaryAction: '创建接入应用',
    tabs: ['Quickstart', 'API 文档', 'FAQ'],
    metrics: [
      { label: '文档', value: '12', note: 'quickstart / api / faq' },
      { label: '示例', value: '3', note: '客服 / RAG / AIGC' },
      { label: 'SDK', value: '2', note: 'TypeScript / Java planned' },
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
        title: '推荐路径',
        items: [
          { label: '第一步', value: '创建应用', note: '生成 appId 和 owner' },
          { label: '第二步', value: '签发 API Key', note: '绑定 scope 和套餐' },
          { label: '第三步', value: '配置路由', note: '选择模型或 Skill' }
        ]
      },
      {
        eyebrow: 'Support',
        title: '帮助状态',
        items: [
          { label: 'API Reference', value: 'Ready', note: 'gateway endpoints' },
          { label: 'SDK Guide', value: 'Draft', note: 'client examples' },
          { label: 'FAQ', value: '6', note: 'common issues' }
        ]
      }
    ]
  }
]
