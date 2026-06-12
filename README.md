# anjing-ai-platform

Anjing AI Infra Platform 是面向 AI 应用、Agent、内部工具和业务系统的 public 开源基础设施平台。

当前阶段先从前端体验开始迭代：用一个统一的 `console` 跑通后台首页、模块入口、Mock 数据和后续后端服务边界。工程落地以 DVSkyFolding 脚手架口径为基础。

## 当前内容

- `apps/console`: React + TypeScript + Vite 正式后台控制台
- `frontend/admin-console`: Vue 3 + TypeScript + Vite 早期信息架构原型
- `cmd/control-api`: Go 应用接入、用户、角色、API Key、凭据接口
- `cmd/gateway-api`: Go API 路由、模型路由、Skill、请求日志接口
- `cmd/billing-service`: Go 套餐、用量、预算告警接口
- `cmd/ops-api`: Go 运营总览、健康状态、审计、待办接口
- `cmd/platform-all`: 本地一个端口启动全部后端 API
- `cmd/console-web`: 生产镜像内前端静态文件服务
- 后台首页：平台状态、模块入口、今日待办、模块整合关系、后端服务建议
- 业务入口：运营总览、用户与权限、网关与模型、计费与配额、帮助文档
- 网关闭环：新增路由、发布路由、LLM 调用测试、请求日志联动
- 接入闭环：创建应用、默认 API Key、API Key 轮换、网关路由、用量、审计、调用日志联动
- OpenAPI 合约：见 `contracts/openapi/platform-api.yaml`
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
http://localhost:18080/api/control/applications
http://localhost:18080/api/gateway/routes
http://localhost:18080/api/billing/plans
```

使用 PostgreSQL 用户仓储启动：

```bash
ANJING_DATABASE_URL='postgres://anjing:anjing@localhost:54329/anjing_ai_platform?sslmode=disable' \
go run ./cmd/platform-all
```

强制开启后端鉴权：

```bash
ANJING_AUTH_MODE=enforced go run ./cmd/platform-all
```

开发默认是 `permissive`，方便前端先跑通。强制模式下，控制台会按当前角色自动带 demo bearer token：

```text
Administrator -> dev-admin-token
User          -> dev-user-token
Developer     -> dev-developer-token
Operator      -> dev-operator-token
```

服务端也支持 `X-API-Key`：

```text
ak_live_customer
ak_live_knowledge
```

如果要让 `platform-all` 服务最新前端，先运行：

```bash
pnpm build:console
go run ./cmd/platform-all
```

单镜像本地预览：

```bash
pnpm image:up
```

默认访问：

```text
http://localhost:18080/
```

CI 模板：

```text
docs/ci/github-actions-ci.yml
```

如果要启用 GitHub Actions，把模板复制到 `.github/workflows/ci.yml`。当前自动化 token 需要 `workflow` scope 才能直接推送 workflow 文件。

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
