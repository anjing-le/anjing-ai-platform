# anjing-ai-platform

Anjing AI Infra Platform 是面向 AI 应用、Agent、内部工具和业务系统的 public 开源基础设施平台。

当前阶段先从前端体验开始迭代：用一个统一的 `console` 跑通后台首页、模块入口、Mock 数据和后续后端服务边界。工程落地以 DVSkyFolding 脚手架口径为基础。

## 当前内容

- `apps/console`: React + TypeScript + Vite 正式后台控制台
- `frontend/admin-console`: Vue 3 + TypeScript + Vite 早期信息架构原型
- `cmd/control-api`: Go 用户、角色、API Key、凭据接口
- `cmd/gateway-api`: Go API 路由、模型路由、Skill、请求日志接口
- `cmd/billing-service`: Go 套餐、用量、预算告警接口
- `cmd/ops-api`: Go 运营总览、健康状态、审计、待办接口
- `cmd/platform-all`: 本地一个端口启动全部后端 API
- `cmd/console-web`: 生产镜像内前端静态文件服务
- 后台首页：平台状态、模块入口、今日待办、模块整合关系、后端服务建议
- 业务入口：运营总览、用户与权限、网关与模型、计费与配额、帮助文档
- Mock 数据：创建应用、API Key、网关路由、用量、审计、调用日志联动
- 后端规划：见 `docs/architecture/backend-services.md`
- 技术基线：见 `docs/architecture/dvskyfolding-baseline.md`

## 本地启动

本地 PostgreSQL：

```bash
pnpm db:up
pnpm db:migrate
pnpm db:seed
```

默认连接：

```text
postgres://anjing:anjing@localhost:54329/anjing_ai_platform?sslmode=disable
```

正式前端：

```bash
pnpm install
pnpm dev:console
```

默认访问：

```text
http://localhost:1818/
```

前端构建：

```bash
pnpm build:console
```

完整 Go 后端：

```bash
go run ./cmd/platform-all
```

默认访问：

```text
http://localhost:18080/healthz
http://localhost:18080/api/ops/dashboard
http://localhost:18080/api/control/users
http://localhost:18080/api/gateway/routes
http://localhost:18080/api/billing/plans
```

使用 PostgreSQL 用户仓储启动：

```bash
ANJING_DATABASE_URL='postgres://anjing:anjing@localhost:54329/anjing_ai_platform?sslmode=disable' \
go run ./cmd/platform-all
```

如果要让 `platform-all` 服务最新前端，先运行：

```bash
pnpm build:console
go run ./cmd/platform-all
```

单服务启动：

```bash
go run ./cmd/control-api      # :1820
go run ./cmd/gateway-api      # :1821
go run ./cmd/billing-service  # :1822
go run ./cmd/ops-api          # :1823
go run ./cmd/console-web      # :1818
```

## 方向

V1 先采用 DVSkyFolding 风格的 Go 服务边界，前端后台已经收敛为 5 个业务入口：

- `operations`: 运营总览、健康状态、告警、日志、审计
- `access`: 用户、角色、权限、API Key、credentialRef
- `gateway`: API 路由、模型路由、Skill 调用、限流、请求日志
- `billing`: 套餐、配额、用量、预算告警，未来接账单
- `docs`: Quickstart、API 文档、示例、FAQ

暂不把 `llm`、`skill`、`credential`、`audit` 做成独立后台入口。它们先作为能力被合并进 `gateway`、`access` 和 `operations`，等真实业务边界稳定后再拆。

## 技术栈基线

后续正式工程优先按 DVSkyFolding 口径重构：

- Frontend: React + TypeScript + Vite 统一大前端
- Backend: Go，优先标准库 `net/http` / `ServeMux`
- Database: PostgreSQL
- DB Access: `pgx/v5` + SQL migrations
- Logging: `log/slog` JSON
- Delivery: 单应用镜像，内含 console web 和多个 Go command；本地可 `all` 模式启动，生产可按 command 拆容器

当前 Vue 控制台只作为信息架构原型保留，正式控制台从 `apps/console` 继续迭代。
