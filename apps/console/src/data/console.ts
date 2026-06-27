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
    tags: ["总览", "开始"],
  },
  {
    id: "overview",
    name: "Operations",
    label: "运营总览",
    summary: "统一查看运营状态、服务健康、调用日志、审计事件和待办。",
    roles: ["admin", "user", "developer", "operator"],
    icon: Activity,
    tags: ["健康", "审计"],
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
    summary: "沉淀接入指南、API 示例、部署说明和排障路径。",
    roles: ["admin", "user", "developer"],
    icon: BookOpen,
    tags: ["Guides", "API"],
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
    title: "用户与权限服务",
    note: ":1820 · 用户、角色、API Key、credentialRef。",
    command: "pnpm dev:control",
    health: "http://localhost:1820/healthz",
    icon: Gauge,
  },
  {
    label: "gateway-api",
    title: "网关与模型服务",
    note: ":1821 · API 路由、模型路由、Skill、请求日志。",
    command: "pnpm dev:gateway",
    health: "http://localhost:1821/healthz",
    icon: ShieldCheck,
  },
  {
    label: "billing-service",
    title: "计费与配额服务",
    note: ":1822 · 套餐、配额、用量、预算告警。",
    command: "pnpm dev:billing",
    health: "http://localhost:1822/healthz",
    icon: KeyRound,
  },
  {
    label: "ops-api",
    title: "运营总览服务",
    note: ":1823 · 总览、健康、审计、待办。",
    command: "pnpm dev:ops",
    health: "http://localhost:1823/healthz",
    icon: Gauge,
  },
];

export const consoleServiceMap = [
  {
    id: "operations",
    entry: "运营总览",
    owner: "ops-api",
    scope: "服务健康、调用日志、审计事件、今日待办",
    apis: ["/api/ops/platform-snapshot", "/api/ops/dashboard", "/api/ops/todos", "/api/ops/audit-events"],
  },
  {
    id: "access",
    entry: "用户与权限",
    owner: "control-api",
    scope: "用户、角色、权限、API Key、credentialRef",
    apis: ["/api/control/users", "/api/control/applications", "/api/control/api-keys"],
  },
  {
    id: "gateway",
    entry: "网关与模型",
    owner: "gateway-api",
    scope: "API 路由、模型路由、Skill 调用、请求日志",
    apis: ["/api/gateway/routes", "/api/gateway/model-routes", "/api/gateway/llm/invoke"],
  },
  {
    id: "billing",
    entry: "计费与配额",
    owner: "billing-service",
    scope: "套餐、配额、用量统计、预算告警",
    apis: ["/api/billing/plans", "/api/billing/usage", "/api/billing/usage-events", "/api/billing/budget-alerts"],
  },
  {
    id: "docs",
    entry: "帮助文档",
    owner: "console-web + APIs",
    scope: "Guides、API Examples、Deployment、Troubleshooting",
    apis: ["/", "/api/*"],
  },
];

export const modulePages: ModulePageDefinition[] = [
  {
    id: "overview",
    eyebrow: "运营",
    title: "运营总览",
    description: "进入后台后的工作台：只看平台是否健康、哪些事项需要处理、调用与审计是否正常。",
    primaryAction: "处理事项",
    tabs: ["运营总览", "服务健康", "调用与审计"],
    metrics: [
      { label: "今日调用", value: "128.4K", note: "API / Model / Skill", tone: "neutral" },
      { label: "成功率", value: "99.21%", note: "近 24 小时", tone: "good" },
      { label: "待处理", value: "7", note: "告警 / 审批 / 预算", tone: "watch" },
      { label: "今日成本", value: "$842", note: "估算", tone: "neutral" },
    ],
    table: {
      eyebrow: "运营",
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
        eyebrow: "重点",
        title: "今日重点",
        items: [
          { label: "先处理", value: "预算与权限审批", note: "影响接入和成本控制" },
          { label: "再观察", value: "模型 fallback", note: "确认供应商稳定性" },
          { label: "最后复盘", value: "调用与审计", note: "看关键链路是否闭环" },
        ],
      },
      {
        eyebrow: "范围",
        title: "合并范围",
        items: [
          { label: "Observability", value: "已并入", note: "健康、日志、Trace、失败追踪" },
          { label: "审计", value: "已并入", note: "配置变更与权限操作审计" },
          { label: "Ops Board", value: "保留", note: "后台默认首页后的工作台" },
        ],
      },
    ],
  },
  {
    id: "iam",
    eyebrow: "访问",
    title: "用户与权限",
    description: "统一管理用户、角色权限、API Key 和 credentialRef，先把访问边界定义清楚。",
    primaryAction: "邀请用户",
    tabs: ["用户", "角色权限", "API Key", "凭据"],
    metrics: [
      { label: "用户", value: "42", note: "活跃 31", tone: "neutral" },
      { label: "角色", value: "4", note: "管理员 / 使用用户 / 开发人员 / 运维人员", tone: "neutral" },
      { label: "API Key", value: "16", note: "有效密钥", tone: "good" },
      { label: "凭据引用", value: "28", note: "credentialRef", tone: "watch" },
    ],
    table: {
      eyebrow: "用户",
      title: "用户列表",
      columns: ["用户", "组织", "角色", "MFA", "状态"],
      rows: [
        {
          id: "lin",
          cells: ["lin.chen@anjing.ai", "平台管理", "管理员", "已启用", "Active"],
          status: "Active",
          tone: "good",
        },
        {
          id: "dev",
          cells: ["dev-api@anjing.ai", "工程团队", "开发人员", "已启用", "Active"],
          status: "Active",
          tone: "good",
        },
        {
          id: "ops",
          cells: ["ops-console@anjing.ai", "运维团队", "运维人员", "需配置", "Pending"],
          status: "Pending",
          tone: "neutral",
        },
      ],
    },
    panels: [
      {
        eyebrow: "角色",
        title: "角色边界",
        items: [
          { label: "管理员", value: "全部可见", note: "用户、网关、计费、文档" },
          { label: "使用用户", value: "接入与用量", note: "不看关键配置" },
          { label: "运维人员", value: "运行期配置", note: "不改开发侧网关配置" },
        ],
      },
      {
        eyebrow: "凭据",
        title: "凭据策略",
        items: [
          { label: "明文读取", value: "已阻断", note: "仅运行时可用" },
          { label: "脱敏展示", value: "已启用", note: "只显示末 4 位" },
          { label: "轮换周期", value: "90d", note: "默认策略" },
        ],
      },
    ],
  },
  {
    id: "gateway",
    eyebrow: "网关",
    title: "网关与模型",
    description: "把 API 网关、模型路由和 Skill 调用合到一个运行入口，减少后台导航复杂度。",
    primaryAction: "新增路由",
    tabs: ["API 路由", "模型路由", "Skill 调用", "请求日志"],
    metrics: [
      { label: "API 路由", value: "24", note: "生产入口", tone: "neutral" },
      { label: "模型别名", value: "8", note: "chat / embedding / rerank", tone: "neutral" },
      { label: "Skill", value: "12", note: "已发布 9", tone: "good" },
      { label: "P95 延迟", value: "82ms", note: "近 1 小时", tone: "watch" },
    ],
    table: {
      eyebrow: "路由",
      title: "API 路由",
      columns: ["路由", "上游", "鉴权", "限流", "状态"],
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
          cells: ["/internal/audit/**", "ops-api", "登录会话", "仅管理员", "Guarded"],
          status: "Guarded",
          tone: "watch",
        },
      ],
    },
    panels: [
      {
        eyebrow: "运行",
        title: "运行策略",
        items: [
          { label: "鉴权前置", value: "API Key + RBAC", note: "全部路由" },
          { label: "模型兜底", value: "已启用", note: "供应商超时" },
          { label: "Skill 超时", value: "8s", note: "默认策略" },
        ],
      },
      {
        eyebrow: "范围",
        title: "合并范围",
        items: [
          { label: "API Gateway", value: "主入口", note: "路由、限流、请求日志" },
          { label: "模型网关", value: "已并入", note: "供应商、模型别名、失败兜底" },
          { label: "Skill Hub", value: "已并入", note: "注册、协议、调用治理" },
        ],
      },
    ],
  },
  {
    id: "quota",
    eyebrow: "计费",
    title: "计费与配额",
    description: "把套餐、配额、用量和预算告警放在一个入口，后续再接真实账单与计费。",
    primaryAction: "新增套餐",
    tabs: ["套餐", "用量", "预算告警"],
    metrics: [
      { label: "本月成本", value: "$18.4K", note: "估算", tone: "neutral" },
      { label: "今日 Token", value: "8.6M", note: "+14%", tone: "watch" },
      { label: "预算告警", value: "3", note: "接近阈值", tone: "warn" },
      { label: "超限拒绝", value: "27", note: "今日", tone: "neutral" },
    ],
    table: {
      eyebrow: "套餐",
      title: "套餐与配额",
      columns: ["套餐", "适用对象", "RPS", "Token / day", "状态"],
      rows: [
        {
          id: "free",
          cells: ["Free", "试用用户", "20", "50K", "Active"],
          status: "Active",
          tone: "good",
        },
        {
          id: "business",
          cells: ["Business", "生产 Agent", "1200", "10M", "Active"],
          status: "Active",
          tone: "good",
        },
        {
          id: "enterprise",
          cells: ["Enterprise", "私有部署", "合同约定", "合同约定", "Guarded"],
          status: "Guarded",
          tone: "watch",
        },
      ],
    },
    panels: [
      {
        eyebrow: "账单",
        title: "账单状态",
        items: [
          { label: "当前周期", value: "$4.8K", note: "未出账" },
          { label: "成本分摊", value: "按项目", note: "必须带标签" },
          { label: "计量延迟", value: "< 2s", note: "用量流水线" },
        ],
      },
      {
        eyebrow: "控制",
        title: "配额控制",
        items: [
          { label: "硬限制", value: "已启用", note: "超限后拒绝" },
          { label: "软告警", value: "70% / 85%", note: "控制台提醒" },
          { label: "重置窗口", value: "daily", note: "UTC+8 重置" },
        ],
      },
    ],
  },
  {
    id: "docs",
    eyebrow: "文档",
    title: "帮助文档",
    description: "把使用者、开发者和部署维护者最常用的接入路径收敛到一个入口：先能接入，再能调用、部署和排障。",
    primaryAction: "创建接入应用",
    tabs: ["Guides", "API Examples", "Deployment", "Troubleshooting"],
    metrics: [
      { label: "Guides", value: "4", note: "接入 / 权限 / 网关 / 计费", tone: "neutral" },
      { label: "API Examples", value: "5", note: "curl / TypeScript / Go", tone: "neutral" },
      { label: "Deployment", value: "3", note: "本地 / 单镜像 / Compose", tone: "watch" },
      { label: "Runbooks", value: "4", note: "鉴权 / 路由 / 预算 / 服务", tone: "neutral" },
    ],
    table: {
      eyebrow: "Guides",
      title: "接入指南",
      columns: ["指南", "适用角色", "关键产物", "关联模块", "状态"],
      rows: [
        {
          id: "app",
          cells: ["创建接入应用", "使用用户", "appId / API Key", "用户与权限", "已就绪"],
          status: "已就绪",
          tone: "good",
        },
        {
          id: "route",
          cells: ["选择模型路由", "开发人员", "模型别名 / fallback", "网关与模型", "已就绪"],
          status: "已就绪",
          tone: "good",
        },
        {
          id: "observe",
          cells: ["观察调用与预算", "运维人员", "用量 / 审计 / 告警", "计费与配额", "已就绪"],
          status: "已就绪",
          tone: "good",
        },
      ],
    },
    panels: [
      {
        eyebrow: "开始",
        title: "推荐路径",
        items: [
          { label: "第一步", value: "创建应用", note: "生成 appId 和 owner" },
          { label: "第二步", value: "签发 API Key", note: "绑定 scope 和套餐" },
          { label: "第三步", value: "调用验证", note: "选择模型或 Skill" },
        ],
      },
      {
        eyebrow: "帮助",
        title: "文档状态",
        items: [
          { label: "API Examples", value: "已就绪", note: "网关端点" },
          { label: "Deployment", value: "已就绪", note: "本地预览" },
          { label: "Runbooks", value: "4", note: "高频问题" },
        ],
      },
    ],
  },
];
