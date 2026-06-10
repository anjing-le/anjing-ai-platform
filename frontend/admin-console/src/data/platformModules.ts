import type { PlatformModule } from '@/types/platformModule'

export const platformModules: PlatformModule[] = [
  {
    id: 'gateway',
    name: 'gateway',
    title: '统一入口',
    layer: 'entry',
    summary: '承接外部请求，做路由、限流、鉴权前置和请求审计。',
    role: '平台流量边界',
    responsibilities: ['路由与服务配置', '限流与熔断策略', '统一鉴权前置', '请求日志采集'],
    source: 'infra-api-gateway',
    accent: '#1d1d1f'
  },
  {
    id: 'iam',
    name: 'iam',
    title: '身份与权限',
    layer: 'identity',
    summary: '管理用户、组织、角色、权限、OAuth、Token 和 API Key。',
    role: '平台安全身份中心',
    responsibilities: ['用户与组织模型', 'RBAC 权限模型', 'OAuth 与 Token', 'API Key 生命周期'],
    source: 'infra-auth',
    accent: '#3a3a3c'
  },
  {
    id: 'llm',
    name: 'llm',
    title: '模型调用网关',
    layer: 'ai',
    summary: '统一多模型调用、供应商管理、模型路由、Key 池和流式响应。',
    role: 'AI 算力调度层',
    responsibilities: ['供应商与模型目录', 'Key 池与失败切换', 'Token 用量记录', '流式响应透传'],
    source: 'infra-llm-gateway',
    accent: '#555558'
  },
  {
    id: 'skill',
    name: 'skill',
    title: '能力注册与调度',
    layer: 'ai',
    summary: '管理 Skill 元数据、Schema、版本、协议适配、发现和调用治理。',
    role: 'Agent 能力目录',
    responsibilities: ['Skill 注册与发现', 'Schema 与版本管理', 'HTTP/MCP/内部协议适配', '调用测试入口'],
    source: 'infra-skill-hub',
    accent: '#2c2c2e'
  },
  {
    id: 'audit',
    name: 'audit',
    title: '审计与追踪',
    layer: 'governance',
    summary: '统一记录操作日志、调用日志、失败追踪和指标聚合。',
    role: '平台可观测事实层',
    responsibilities: ['操作审计', '调用日志', '失败追踪', '指标聚合'],
    source: 'new shared module',
    accent: '#515154'
  },
  {
    id: 'quota',
    name: 'quota',
    title: '配额与限额',
    layer: 'governance',
    summary: '沉淀跨模块的配额、限额、用量统计和未来计费接口。',
    role: '平台资源治理层',
    responsibilities: ['配额策略', '调用计数', '用量聚合', '计费预留边界'],
    source: 'new shared module',
    accent: '#424245'
  },
  {
    id: 'credential',
    name: 'credential',
    title: '凭据引用',
    layer: 'shared',
    summary: '托管供应商 Key 与密钥引用，统一脱敏展示和安全读取。',
    role: '敏感配置边界',
    responsibilities: ['credentialRef 引用', '供应商 Key 管理', '脱敏展示', '密钥读取策略'],
    source: 'extracted from skill and llm',
    accent: '#5f5f63'
  }
]
