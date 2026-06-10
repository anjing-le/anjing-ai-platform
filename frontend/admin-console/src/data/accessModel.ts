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
    name: 'Overview',
    title: '平台总览',
    route: '/console/overview',
    summary: '汇总平台状态、调用趋势、风险提示和下一步接入入口。',
    status: 'designing',
    roles: ['admin', 'user', 'developer', 'operator']
  },
  {
    id: 'gateway',
    name: 'Gateway Console',
    title: '统一 API 入口',
    route: '/console/gateway',
    summary: '面向使用用户展示接入入口；面向开发人员维护路由、限流和服务配置。',
    status: 'planned',
    roles: ['admin', 'user', 'developer']
  },
  {
    id: 'iam',
    name: 'IAM Console',
    title: '身份与权限',
    route: '/console/iam',
    summary: '管理用户、组织、角色、权限、Token 和 API Key。',
    status: 'planned',
    roles: ['admin']
  },
  {
    id: 'llm',
    name: 'LLM Console',
    title: '模型供应与路由',
    route: '/console/llm',
    summary: '使用模型调用能力，或维护供应商、模型列表、Key 池和路由策略。',
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
    name: 'Observability',
    title: '日志与指标',
    route: '/console/observability',
    summary: '查看调用日志、失败追踪、指标看板和审计事件。',
    status: 'planned',
    roles: ['admin', 'developer', 'operator']
  },
  {
    id: 'quota',
    name: 'Quota Console',
    title: '配额与限额',
    route: '/console/quota',
    summary: '配置调用配额、资源限额、用量统计和未来计费边界。',
    status: 'planned',
    roles: ['admin', 'developer', 'operator']
  },
  {
    id: 'credential',
    name: 'Credential Console',
    title: '凭据与密钥',
    route: '/console/credentials',
    summary: '管理 credentialRef、供应商 Key、脱敏展示和密钥读取策略。',
    status: 'planned',
    roles: ['admin', 'developer', 'operator']
  },
  {
    id: 'examples',
    name: 'Examples',
    title: '示例接入',
    route: '/console/examples',
    summary: '沉淀客服、知识库、AIGC 等示例入口，辅助接入验证。',
    status: 'planned',
    roles: ['admin', 'user', 'developer']
  }
]
