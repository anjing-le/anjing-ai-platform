import type { ConsoleEntry, PlatformRole } from '@/types/accessModel'

export const platformRoles: PlatformRole[] = [
  {
    id: 'admin',
    name: 'Administrator',
    label: '管理员',
    purpose: '拥有全局视角，可以看到所有模块入口和关键配置边界。'
  },
  {
    id: 'user',
    name: 'User',
    label: '使用用户',
    purpose: '关注怎样接入平台、怎样拿到调用入口、怎样使用模型和 Skill。'
  },
  {
    id: 'developer',
    name: 'Developer',
    label: '开发人员',
    purpose: '负责平台能力开发、协议配置、模型与 Skill 接入，能看到大多数模块。'
  },
  {
    id: 'operator',
    name: 'Operator',
    label: '运维人员',
    purpose: '负责运行期稳定性、日志、配额和凭据轮换，不进入关键开发配置。'
  }
]

export const consoleEntries: ConsoleEntry[] = [
  {
    id: 'overview',
    name: 'Dashboard',
    title: '运营总览',
    route: '/console/overview',
    summary: '汇总平台状态、调用趋势、账单风险、告警和运营待办。',
    status: 'designing',
    roles: ['admin', 'user', 'developer', 'operator']
  },
  {
    id: 'gateway',
    name: 'API Gateway',
    title: '网关管理',
    route: '/console/gateway',
    summary: '维护 API 路由、上游服务、消费者、限流策略和请求追踪。',
    status: 'planned',
    roles: ['admin', 'user', 'developer']
  },
  {
    id: 'iam',
    name: 'Users & Access',
    title: '用户与权限',
    route: '/console/iam',
    summary: '管理组织、用户、角色、权限矩阵、SSO/OAuth、Token 和 API Key。',
    status: 'planned',
    roles: ['admin']
  },
  {
    id: 'llm',
    name: 'Model Service',
    title: '模型服务',
    route: '/console/llm',
    summary: '维护模型供应商、模型目录、路由策略、Key 池和 Token 用量。',
    status: 'planned',
    roles: ['admin', 'user', 'developer']
  },
  {
    id: 'skill',
    name: 'Skill Console',
    title: '能力注册与调度',
    route: '/console/skills',
    summary: '使用或维护 Skill 注册、Schema、版本、调用测试和治理策略。',
    status: 'planned',
    roles: ['admin', 'user', 'developer']
  },
  {
    id: 'observability',
    name: 'Operations',
    title: '运营看板',
    route: '/console/observability',
    summary: '查看调用日志、失败追踪、指标看板、审计事件和告警处理。',
    status: 'planned',
    roles: ['admin', 'developer', 'operator']
  },
  {
    id: 'quota',
    name: 'Billing & Quota',
    title: '计费与配额',
    route: '/console/quota',
    summary: '管理套餐、配额、预算告警、用量统计和账单导出。',
    status: 'planned',
    roles: ['admin', 'developer', 'operator']
  },
  {
    id: 'credential',
    name: 'Secrets',
    title: '凭据中心',
    route: '/console/credentials',
    summary: '管理 credentialRef、供应商 Key、脱敏展示和密钥读取策略。',
    status: 'planned',
    roles: ['admin', 'developer', 'operator']
  },
  {
    id: 'examples',
    name: 'Developer Portal',
    title: '示例接入',
    route: '/console/examples',
    summary: '沉淀客服、知识库、AIGC 等示例入口，辅助接入验证。',
    status: 'planned',
    roles: ['admin', 'user', 'developer']
  }
]
