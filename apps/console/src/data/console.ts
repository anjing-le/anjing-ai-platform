import {
  Activity,
  BookOpen,
  CreditCard,
  Gauge,
  Home,
  KeyRound,
  Network,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

import type {
  MetricItem,
  ModulePageDefinition,
  NavItem,
  RoleDefinition,
  TodoItem,
} from "../types";

export const roles: RoleDefinition[] = [
  {
    id: "admin",
    name: "Administrator",
    label: "管理员",
    purpose: "拥有全局视角，可以看到所有后台入口和关键配置。",
  },
  {
    id: "user",
    name: "User",
    label: "使用用户",
    purpose: "关注接入方式、调用用量、账单状态和帮助文档。",
  },
  {
    id: "developer",
    name: "Developer",
    label: "开发人员",
    purpose: "负责接入网关、模型路由、Skill 调用和技术配置。",
  },
  {
    id: "operator",
    name: "Operator",
    label: "运维人员",
    purpose: "关注运行状态、网关稳定性、用量水位和告警处理。",
  },
];

export const navItems: NavItem[] = [
  {
    id: "home",
    name: "Home",
    label: "后台首页",
    summary: "平台状态、模块边界、今日待办和推荐操作路径。",
    roles: ["admin", "user", "developer", "operator"],
    icon: Home,
    tags: ["Overview", "Start"],
  },
  {
    id: "overview",
    name: "Operations",
    label: "运营总览",
    summary: "统一查看运营状态、服务健康、调用日志、审计事件和待办。",
    roles: ["admin", "user", "developer", "operator"],
    icon: Activity,
    tags: ["Health", "Audit"],
  },
  {
    id: "iam",
    name: "Access",
    label: "用户与权限",
    summary: "管理组织、用户、角色、权限、API Key 和凭据引用。",
    roles: ["admin"],
    icon: UsersRound,
    tags: ["IAM", "Key"],
  },
  {
    id: "gateway",
    name: "Gateway",
    label: "网关与模型",
    summary: "统一管理 API 路由、模型路由、模型供应商、Skill 调用和请求日志。",
    roles: ["admin", "developer"],
    icon: Network,
    tags: ["LLM", "Skill"],
  },
  {
    id: "quota",
    name: "Billing",
    label: "计费与配额",
    summary: "管理套餐、配额、用量、账单和预算告警。",
    roles: ["admin", "user", "developer", "operator"],
    icon: CreditCard,
    tags: ["Quota", "Usage"],
  },
  {
    id: "docs",
    name: "Docs",
    label: "帮助文档",
    summary: "沉淀 Quickstart、API 文档、SDK、示例和常见问题。",
    roles: ["admin", "user", "developer"],
    icon: BookOpen,
    tags: ["API", "FAQ"],
  },
];

export const homeMetrics: MetricItem[] = [
  { label: "业务入口", value: "5", note: "按角色显示", tone: "neutral" },
  { label: "待处理", value: "4", note: "告警 / 审批 / 预算", tone: "watch" },
  { label: "成功率", value: "99.21%", note: "近 24 小时", tone: "good" },
  { label: "V1 服务", value: "4 Go cmds", note: "DVSkyFolding", tone: "neutral" },
];

export const todos: TodoItem[] = [
  {
    id: "todo-fallback",
    moduleId: "gateway",
    moduleLabel: "网关与模型",
    title: "模型 fallback 率升高",
    status: "Watching",
    owner: "运维人员",
    tone: "watch",
  },
  {
    id: "todo-budget",
    moduleId: "quota",
    moduleLabel: "计费与配额",
    title: "aigc-lab 预算接近阈值",
    status: "Warning",
    owner: "管理员",
    tone: "warn",
  },
  {
    id: "todo-key",
    moduleId: "iam",
    moduleLabel: "用户与权限",
    title: "新项目 API Key 待审批",
    status: "Pending",
    owner: "管理员",
    tone: "neutral",
  },
  {
    id: "todo-credential",
    moduleId: "iam",
    moduleLabel: "用户与权限",
    title: "cred.claude.backup 即将过期",
    status: "Expiring",
    owner: "管理员",
    tone: "watch",
  },
];

export const backendPlan = [
  {
    label: "control-api",
    title: "Access / IAM",
    note: ":1820 · 用户、角色、API Key、credentialRef。",
    command: "go run ./cmd/control-api",
    health: "/api/control/healthz",
    icon: Gauge,
  },
  {
    label: "gateway-api",
    title: "Gateway / Model",
    note: ":1821 · API 路由、模型路由、Skill、请求日志。",
    command: "go run ./cmd/gateway-api",
    health: "/api/gateway/healthz",
    icon: ShieldCheck,
  },
  {
    label: "billing-service",
    title: "Quota / Billing",
    note: ":1822 · 套餐、配额、用量、预算告警。",
    command: "go run ./cmd/billing-service",
    health: "/api/billing/healthz",
    icon: KeyRound,
  },
  {
    label: "ops-api",
    title: "Operations",
    note: ":1823 · 总览、健康、审计、待办。",
    command: "go run ./cmd/ops-api",
    health: "/api/ops/healthz",
    icon: Gauge,
  },
];

export const modulePages: ModulePageDefinition[] = [
  {
    id: "overview",
    eyebrow: "Operations",
    title: "运营总览",
    description: "进入后台后的工作台：只看平台是否健康、哪些事项需要处理、调用与审计是否正常。",
    primaryAction: "处理事项",
    tabs: ["运营总览", "服务健康", "调用与审计"],
    metrics: [
      { label: "今日调用", value: "128.4K", note: "API / Model / Skill", tone: "neutral" },
      { label: "成功率", value: "99.21%", note: "近 24 小时", tone: "good" },
      { label: "待处理", value: "7", note: "告警 / 审批 / 预算", tone: "watch" },
      { label: "今日成本", value: "$842", note: "estimated", tone: "neutral" },
    ],
    table: {
      eyebrow: "Operations",
      title: "今日运营事项",
      columns: ["事项", "来源", "负责人", "状态"],
      rows: [
        {
          id: "fallback",
          cells: ["模型 fallback 率升高", "网关与模型", "运维人员", "Watching"],
          status: "Watching",
          tone: "watch",
        },
        {
          id: "budget",
          cells: ["aigc-lab 预算接近阈值", "计费与配额", "管理员", "Warning"],
          status: "Warning",
          tone: "warn",
        },
        {
          id: "key",
          cells: ["新项目 API Key 待审批", "用户与权限", "管理员", "Pending"],
          status: "Pending",
          tone: "neutral",
        },
      ],
    },
    panels: [
      {
        eyebrow: "Focus",
        title: "今日重点",
        items: [
          { label: "先处理", value: "预算与权限审批", note: "影响接入和成本控制" },
          { label: "再观察", value: "模型 fallback", note: "确认供应商稳定性" },
          { label: "最后复盘", value: "调用与审计", note: "看关键链路是否闭环" },
        ],
      },
      {
        eyebrow: "Scope",
        title: "合并范围",
        items: [
          { label: "Observability", value: "已并入", note: "健康、日志、Trace、失败追踪" },
          { label: "Audit", value: "已并入", note: "配置变更与权限操作审计" },
          { label: "Ops Board", value: "保留", note: "后台默认首页后的工作台" },
        ],
      },
    ],
  },
  {
    id: "iam",
    eyebrow: "Access",
    title: "用户与权限",
    description: "统一管理用户、角色权限、API Key 和 credentialRef，先把访问边界定义清楚。",
    primaryAction: "邀请用户",
    tabs: ["用户", "角色权限", "API Key", "凭据"],
    metrics: [
      { label: "用户", value: "42", note: "活跃 31", tone: "neutral" },
      { label: "角色", value: "4", note: "admin / user / developer / operator", tone: "neutral" },
      { label: "API Key", value: "16", note: "有效密钥", tone: "good" },
      { label: "凭据引用", value: "28", note: "credentialRef", tone: "watch" },
    ],
    table: {
      eyebrow: "Users",
      title: "用户列表",
      columns: ["用户", "组织", "角色", "MFA", "状态"],
      rows: [
        {
          id: "lin",
          cells: ["lin.chen@anjing.ai", "Platform", "Administrator", "Enabled", "Active"],
          status: "Active",
          tone: "good",
        },
        {
          id: "dev",
          cells: ["dev-api@anjing.ai", "Engineering", "Developer", "Enabled", "Active"],
          status: "Active",
          tone: "good",
        },
        {
          id: "ops",
          cells: ["ops-console@anjing.ai", "Operations", "Operator", "Required", "Pending"],
          status: "Pending",
          tone: "neutral",
        },
      ],
    },
    panels: [
      {
        eyebrow: "Roles",
        title: "角色边界",
        items: [
          { label: "管理员", value: "全部可见", note: "用户、网关、计费、文档" },
          { label: "使用用户", value: "接入与用量", note: "不看关键配置" },
          { label: "运维人员", value: "运行期配置", note: "不改开发侧网关配置" },
        ],
      },
      {
        eyebrow: "Secrets",
        title: "凭据策略",
        items: [
          { label: "明文读取", value: "Blocked", note: "runtime only" },
          { label: "脱敏展示", value: "Enabled", note: "last 4 only" },
          { label: "轮换周期", value: "90d", note: "default policy" },
        ],
      },
    ],
  },
  {
    id: "gateway",
    eyebrow: "Gateway",
    title: "网关与模型",
    description: "把 API 网关、模型路由和 Skill 调用合到一个运行入口，减少后台导航复杂度。",
    primaryAction: "新增路由",
    tabs: ["API 路由", "模型路由", "Skill 调用", "请求日志"],
    metrics: [
      { label: "API 路由", value: "24", note: "生产入口", tone: "neutral" },
      { label: "模型别名", value: "8", note: "chat / embedding / rerank", tone: "neutral" },
      { label: "Skill", value: "12", note: "published 9", tone: "good" },
      { label: "P95 延迟", value: "82ms", note: "近 1 小时", tone: "watch" },
    ],
    table: {
      eyebrow: "Routes",
      title: "API 路由",
      columns: ["Route", "Upstream", "Auth", "Limit", "状态"],
      rows: [
        {
          id: "llm",
          cells: ["/api/v1/llm/**", "gateway-api", "API Key", "1200/min", "Active"],
          status: "Active",
          tone: "good",
        },
        {
          id: "skills",
          cells: ["/api/v1/skills/**", "gateway-api", "API Key + RBAC", "600/min", "Active"],
          status: "Active",
          tone: "good",
        },
        {
          id: "internal",
          cells: ["/internal/audit/**", "ops-api", "Session", "admin only", "Guarded"],
          status: "Guarded",
          tone: "watch",
        },
      ],
    },
    panels: [
      {
        eyebrow: "Runtime",
        title: "运行策略",
        items: [
          { label: "鉴权前置", value: "API Key + RBAC", note: "all routes" },
          { label: "模型 fallback", value: "Enabled", note: "provider timeout" },
          { label: "Skill timeout", value: "8s", note: "default policy" },
        ],
      },
      {
        eyebrow: "Scope",
        title: "合并范围",
        items: [
          { label: "API Gateway", value: "主入口", note: "路由、限流、请求日志" },
          { label: "LLM Gateway", value: "已并入", note: "供应商、模型别名、fallback" },
          { label: "Skill Hub", value: "已并入", note: "注册、协议、调用治理" },
        ],
      },
    ],
  },
  {
    id: "quota",
    eyebrow: "Billing",
    title: "计费与配额",
    description: "把套餐、配额、用量和预算告警放在一个入口，后续再接真实账单与计费。",
    primaryAction: "新增套餐",
    tabs: ["套餐", "用量", "预算告警"],
    metrics: [
      { label: "本月成本", value: "$18.4K", note: "estimated", tone: "neutral" },
      { label: "今日 Token", value: "8.6M", note: "+14%", tone: "watch" },
      { label: "预算告警", value: "3", note: "near limit", tone: "warn" },
      { label: "超限拒绝", value: "27", note: "today", tone: "neutral" },
    ],
    table: {
      eyebrow: "Plans",
      title: "套餐与配额",
      columns: ["套餐", "适用对象", "RPS", "Token / day", "状态"],
      rows: [
        {
          id: "free",
          cells: ["Free", "trial users", "20", "50K", "Active"],
          status: "Active",
          tone: "good",
        },
        {
          id: "business",
          cells: ["Business", "production agents", "1200", "10M", "Active"],
          status: "Active",
          tone: "good",
        },
        {
          id: "enterprise",
          cells: ["Enterprise", "private deployment", "custom", "custom", "Draft"],
          status: "Draft",
          tone: "neutral",
        },
      ],
    },
    panels: [
      {
        eyebrow: "Billing",
        title: "账单状态",
        items: [
          { label: "当前周期", value: "$4.8K", note: "未出账" },
          { label: "成本分摊", value: "Project based", note: "tags required" },
          { label: "计量延迟", value: "< 2s", note: "mock target" },
        ],
      },
      {
        eyebrow: "Controls",
        title: "配额控制",
        items: [
          { label: "硬限制", value: "Enabled", note: "block when exceeded" },
          { label: "软告警", value: "70% / 85%", note: "console notice" },
          { label: "重置窗口", value: "daily", note: "UTC+8 reset" },
        ],
      },
    ],
  },
  {
    id: "docs",
    eyebrow: "Docs",
    title: "帮助文档",
    description: "给使用者和开发者一个轻量接入入口：Quickstart、API 文档和常见问题先跑通。",
    primaryAction: "创建接入应用",
    tabs: ["Quickstart", "API 文档", "FAQ"],
    metrics: [
      { label: "文档", value: "12", note: "quickstart / api / faq", tone: "neutral" },
      { label: "示例", value: "3", note: "客服 / RAG / AIGC", tone: "neutral" },
      { label: "SDK", value: "2", note: "TypeScript / Go planned", tone: "watch" },
      { label: "待补充", value: "4", note: "planned docs", tone: "neutral" },
    ],
    table: {
      eyebrow: "Quickstart",
      title: "接入步骤",
      columns: ["步骤", "说明", "产物", "Owner", "状态"],
      rows: [
        {
          id: "app",
          cells: ["1", "创建应用与 API Key", "appId / key scope", "使用用户", "Ready"],
          status: "Ready",
          tone: "good",
        },
        {
          id: "route",
          cells: ["2", "选择模型路由", "model alias", "开发人员", "Ready"],
          status: "Ready",
          tone: "good",
        },
        {
          id: "observe",
          cells: ["3", "观察调用与预算", "usage / audit", "运维人员", "Draft"],
          status: "Draft",
          tone: "neutral",
        },
      ],
    },
    panels: [
      {
        eyebrow: "Start",
        title: "推荐路径",
        items: [
          { label: "第一步", value: "创建应用", note: "生成 appId 和 owner" },
          { label: "第二步", value: "签发 API Key", note: "绑定 scope 和套餐" },
          { label: "第三步", value: "配置路由", note: "选择模型或 Skill" },
        ],
      },
      {
        eyebrow: "Support",
        title: "帮助状态",
        items: [
          { label: "API Reference", value: "Ready", note: "gateway endpoints" },
          { label: "SDK Guide", value: "Draft", note: "client examples" },
          { label: "FAQ", value: "6", note: "common issues" },
        ],
      },
    ],
  },
];
