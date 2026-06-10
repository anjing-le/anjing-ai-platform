import type { ConsoleEntry, PlatformRole } from '@/types/accessModel'

export const platformRoles: PlatformRole[] = [
  {
    id: 'platform-owner',
    name: 'Platform Owner',
    label: '平台负责人',
    purpose: '看全局健康、模块进度、资源策略和平台边界。'
  },
  {
    id: 'security-admin',
    name: 'Security Admin',
    label: '安全管理员',
    purpose: '负责身份、权限、凭据、审计和访问风险。'
  },
  {
    id: 'ops-admin',
    name: 'Ops Admin',
    label: '平台运维',
    purpose: '负责入口流量、限流、失败追踪、配额和运行指标。'
  },
  {
    id: 'ai-engineer',
    name: 'AI Engineer',
    label: 'AI 工程师',
    purpose: '负责模型供应商、模型路由、Skill 协议和 AI 能力调试。'
  },
  {
    id: 'agent-builder',
    name: 'Agent Builder',
    label: 'Agent 构建者',
    purpose: '组合 LLM、Skill 和示例场景，验证 Agent 调用链路。'
  },
  {
    id: 'app-developer',
    name: 'App Developer',
    label: '应用接入方',
    purpose: '查看接入入口、API Key、模型和 Skill 调用方式。'
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
    roles: ['platform-owner', 'ops-admin', 'security-admin']
  },
  {
    id: 'gateway',
    name: 'Gateway Console',
    title: '统一 API 入口',
    route: '/console/gateway',
    summary: '管理路由、限流、服务配置和请求日志。',
    status: 'planned',
    roles: ['platform-owner', 'ops-admin', 'app-developer']
  },
  {
    id: 'iam',
    name: 'IAM Console',
    title: '身份与权限',
    route: '/console/iam',
    summary: '管理用户、组织、角色、权限、Token 和 API Key。',
    status: 'planned',
    roles: ['platform-owner', 'security-admin']
  },
  {
    id: 'llm',
    name: 'LLM Console',
    title: '模型供应与路由',
    route: '/console/llm',
    summary: '管理模型供应商、模型列表、Key 池、用量和路由策略。',
    status: 'planned',
    roles: ['platform-owner', 'ai-engineer', 'agent-builder', 'app-developer']
  },
  {
    id: 'skill',
    name: 'Skill Console',
    title: '能力注册与调度',
    route: '/console/skills',
    summary: '管理 Skill 注册、Schema、版本、调用测试和治理策略。',
    status: 'planned',
    roles: ['platform-owner', 'ai-engineer', 'agent-builder', 'app-developer']
  },
  {
    id: 'observability',
    name: 'Observability',
    title: '日志与指标',
    route: '/console/observability',
    summary: '查看调用日志、失败追踪、指标看板和审计事件。',
    status: 'planned',
    roles: ['platform-owner', 'ops-admin', 'security-admin', 'ai-engineer']
  },
  {
    id: 'quota',
    name: 'Quota Console',
    title: '配额与限额',
    route: '/console/quota',
    summary: '配置调用配额、资源限额、用量统计和未来计费边界。',
    status: 'planned',
    roles: ['platform-owner', 'ops-admin', 'security-admin']
  },
  {
    id: 'credential',
    name: 'Credential Console',
    title: '凭据与密钥',
    route: '/console/credentials',
    summary: '管理 credentialRef、供应商 Key、脱敏展示和密钥读取策略。',
    status: 'planned',
    roles: ['platform-owner', 'security-admin', 'ops-admin', 'ai-engineer']
  },
  {
    id: 'examples',
    name: 'Examples',
    title: '示例接入',
    route: '/console/examples',
    summary: '沉淀客服、知识库、AIGC 等示例入口，辅助接入验证。',
    status: 'planned',
    roles: ['platform-owner', 'ai-engineer', 'agent-builder', 'app-developer']
  }
]

