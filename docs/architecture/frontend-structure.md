# Frontend Structure

Anjing AI Platform 的前端只保留一个正式后台入口：`apps/console`。

## Canonical App

`apps/console` 是 React + TypeScript + Vite 控制台，承载所有正式后台体验：

- 后台首页：平台状态、关键模块、待办和服务边界。
- 运营总览：健康状态、审计事件、调用趋势和异常入口。
- 用户与权限：用户、角色、API Key、应用接入和凭据引用。
- 网关与模型：API 路由、模型路由、Skill 绑定、LLM 调用测试和请求日志。
- 计费与配额：套餐、用量、预算告警和未来计费能力。
- 帮助文档：Guides、API Examples、Deployment、Troubleshooting，覆盖接入指南、调用示例、部署说明和排障路径。

根目录脚本 `pnpm dev:console`、`pnpm build:console`、`pnpm preview:console` 都必须通过 `--filter @anjing-ai-platform/console` 指向这个应用。

## Legacy Prototype

`frontend/admin-console` 是早期 Vue 3 原型，只用于保留历史设计探索：

- 不进入 `pnpm-workspace.yaml`。
- 不作为本地启动、生产构建或部署入口。
- 不新增正式业务能力。
- 可复用内容需要迁移到 `apps/console` 后再继续迭代。

这个约束由 `scripts/check-workspace.mjs` 检查，避免后续出现两个后台入口并行演进。

## Module Boundaries

前端模块按用户心智保持少而清晰：

| Console Entry | Primary Audience | Backend Owner |
| --- | --- | --- |
| `home` | 全部角色 | `ops-api` + aggregate snapshot |
| `operations` | 管理员、运维人员 | `ops-api` |
| `access` | 管理员、开发人员、使用用户 | `control-api` |
| `gateway` | 管理员、开发人员 | `gateway-api` |
| `billing` | 管理员、运维人员、使用用户 | `billing-service` |
| `docs` | 全部角色 | `console-web` + module APIs |

`llm`、`skill`、`credential`、`audit` 暂时不拆成独立导航入口。它们作为能力分别归入 `gateway`、`access` 和 `operations`，等真实业务使用边界稳定后再拆。
