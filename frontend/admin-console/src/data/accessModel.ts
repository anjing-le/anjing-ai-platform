import type { ConsoleEntry, PlatformRole } from '@/types/accessModel'

export const platformRoles: PlatformRole[] = [
  {
    id: 'admin',
    name: 'Administrator',
    label: '管理员',
    purpose: '拥有全局视角，可以看到所有后台入口和关键配置。'
  },
  {
    id: 'user',
    name: 'User',
    label: '使用用户',
    purpose: '关注接入方式、调用用量、账单状态和帮助文档。'
  },
  {
    id: 'developer',
    name: 'Developer',
    label: '开发人员',
    purpose: '负责接入网关、模型路由、Skill 调用和技术配置。'
  },
  {
    id: 'operator',
    name: 'Operator',
    label: '运维人员',
    purpose: '关注运行状态、网关稳定性、用量水位和告警处理。'
  }
]

export const consoleEntries: ConsoleEntry[] = [
  {
    id: 'overview',
    name: 'Operations',
    title: '运营总览',
    route: '/console/overview',
    summary: '统一查看运营状态、服务健康、调用日志、审计事件和待办。',
    status: 'ready',
    roles: ['admin', 'user', 'developer', 'operator']
  },
  {
    id: 'iam',
    name: 'Access',
    title: '用户与权限',
    route: '/console/iam',
    summary: '管理组织、用户、角色、权限、API Key 和凭据引用。',
    status: 'ready',
    roles: ['admin']
  },
  {
    id: 'gateway',
    name: 'Gateway',
    title: '网关与模型',
    route: '/console/gateway',
    summary: '统一管理 API 路由、模型路由、模型供应商、Skill 调用和请求日志。',
    status: 'ready',
    roles: ['admin', 'developer', 'operator']
  },
  {
    id: 'quota',
    name: 'Billing',
    title: '计费与配额',
    route: '/console/quota',
    summary: '管理套餐、配额、用量、账单、发票和预算告警。',
    status: 'ready',
    roles: ['admin', 'user', 'developer', 'operator']
  },
  {
    id: 'examples',
    name: 'Docs',
    title: '帮助文档',
    route: '/console/docs',
    summary: '沉淀 Quickstart、API 文档、SDK、示例和常见问题。',
    status: 'ready',
    roles: ['admin', 'user', 'developer']
  }
]
