# anjing-ai-platform

Anjing AI Infra Platform 是面向 AI 应用、Agent、内部工具和业务系统的 public 开源基础设施平台。

当前阶段先从前端体验开始迭代：用一个统一的 `admin-console` 跑通后台首页、模块入口、Mock 数据和后续后端服务边界。

## 当前内容

- `frontend/admin-console`: Vue 3 + TypeScript + Vite 后台控制台
- 后台首页：平台状态、模块入口、今日待办、模块整合关系、后端服务建议
- 业务入口：运营总览、用户与权限、网关与模型、计费与配额、帮助文档
- Mock 数据：创建应用、API Key、网关路由、用量、审计、调用日志联动
- 后端规划：见 `docs/architecture/backend-services.md`

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

V1 先采用模块化单体，前端后台已经收敛为 5 个业务入口：

- `operations`: 运营总览、健康状态、告警、日志、审计
- `access`: 用户、角色、权限、API Key、credentialRef
- `gateway`: API 路由、模型路由、Skill 调用、限流、请求日志
- `billing`: 套餐、配额、用量、预算告警，未来接账单
- `docs`: Quickstart、API 文档、示例、FAQ

暂不把 `llm`、`skill`、`credential`、`audit` 做成独立后台入口。它们先作为能力被合并进 `gateway`、`access` 和 `operations`，等真实业务边界稳定后再拆。
