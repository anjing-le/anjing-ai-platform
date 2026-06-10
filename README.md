# anjing-ai-platform

Anjing AI Infra Platform 是面向 AI 应用、Agent、内部工具和业务系统的 public 开源基础设施平台。

当前阶段先从前端体验开始迭代：用一个统一的 `admin-console` 讲清平台定位、模块边界和后续 Console 的信息架构。

## 当前内容

- `frontend/admin-console`: Vue 3 + TypeScript + Vite 首页原型
- 第一屏：平台定位
- 第二屏：模块化单体架构与核心模块说明

## 本地启动

```bash
cd frontend/admin-console
pnpm install
pnpm dev
```

默认访问：

```text
http://localhost:13007/
```

## 方向

V1 先采用模块化单体，逐步沉淀：

- `gateway`: 统一 API 入口、路由、限流、鉴权前置、请求审计
- `iam`: 用户、组织、角色、权限、OAuth、Token、API Key
- `llm`: 多模型统一调用、供应商管理、Key 池、Token 用量
- `skill`: Skill 注册、发现、Schema、版本、协议适配、调用治理
- `audit`: 操作日志、调用日志、失败追踪、指标聚合
- `quota`: 配额、限额、用量统计
- `credential`: 凭据引用、脱敏、供应商 Key 管理

