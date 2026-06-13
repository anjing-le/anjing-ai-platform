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
- 运营闭环：待办查看、事项处理、总览指标刷新、服务健康和审计事件联动
- 业务入口：运营总览、用户与权限、网关与模型、计费与配额、帮助文档
- 权限闭环：邀请用户、激活用户、角色边界、API Key 撤销、credentialRef 轮换
- 网关闭环：新增路由、发布路由、模型路由创建与发布、Skill 绑定创建与发布、LLM 调用测试、请求日志与用量联动
- 计费闭环：新增套餐、启用套餐、用量记录、预算告警处理联动
- 接入闭环：创建应用、默认 API Key、API Key 轮换、网关路由、用量、审计、调用日志联动
- 后台数据加载：优先使用 `GET /api/ops/platform-snapshot` 聚合快照，快照由各模块 repository 组装，失败时回退到细分 API
- OpenAPI 合约：见 `contracts/openapi/platform-api.yaml`
- 后端规划：见 `docs/architecture/backend-services.md`
- 技术基线：见 `docs/architecture/dvskyfolding-baseline.md`
- 质量门禁：见 `docs/architecture/quality-gates.md`
- 质量脚本：见 `scripts/README.md`

## 本地启动

本地 PostgreSQL：

```bash
pnpm db:prepare
```

默认连接：

```text
postgres://anjing:anjing@localhost:54329/anjing_ai_platform?sslmode=disable
```

正式前端：

```bash
pnpm install
pnpm dev:api
pnpm dev:console
```

默认访问：

```text
http://localhost:1818/
```

`pnpm dev:console` 会通过 Vite proxy 把 `/api` 转发到 `http://localhost:18080`。如果前端构建产物和 Go API 分开部署，可以参考 `apps/console/.env.example` 设置 `VITE_API_BASE_URL`。

前端构建：

```bash
pnpm build:console
```

本地校验：

```bash
pnpm verify
```

`pnpm verify` 会依次执行 workspace 配置检查、前端构建、前端数据映射测试、OpenAPI 路由覆盖检查、OpenAPI 元数据完整性检查、服务边界一致性检查、前端 API client 覆盖检查、Go command 运行时约束检查、角色 seed 可见性检查、文档本地引用检查、Compose 配置检查、Dockerfile 路径检查、数据库文件一致性检查、Go 格式检查、Go vet、Go command 构建和 Go 测试。Workspace 检查会确认 `apps/console` 是正式后台入口，根脚本和 pnpm workspace 没有漂移。前端测试会验证后端快照到首页指标、待办和模块表格的 hydration 映射。OpenAPI 检查会比对 Go `mux.HandleFunc` 注册的 `/healthz`、`/api/*` 路径与 `contracts/openapi/platform-api.yaml`，并确认 operation 元数据、角色声明和错误响应完整，避免新增后端接口时遗漏合约。服务边界检查会比对前端 `consoleServiceMap` 和 OpenAPI `x-anjing-service-boundaries`，避免后台入口、后端归属和 API 分组漂移。前端 API client 检查会确认后台真实调用的 `/api/*` 路径都已进入 OpenAPI。Command 检查会确认服务以结构化日志启动且不使用 `panic` 处理运行时启动错误。角色 seed 检查会确认内存 seed 和 PostgreSQL role policies seed 的可见入口匹配前端导航角色规则。文档引用检查会确认 README 和 `docs/` 中指向仓库内的路径真实存在。Compose 检查会验证本地 PostgreSQL 和单镜像预览的编排配置。Dockerfile 检查会确认本地 `COPY` 源路径真实存在。数据库文件检查会确认 migration / seed 编号、表引用和迁移目录配置一致。Go 检查会覆盖 `gofmt`、`go vet ./...`、`go build ./cmd/...`、`go test ./...`，并校验 OpenAPI `x-anjing-roles` 和后端 RBAC 规则一致。

完整 Go 后端：

```bash
pnpm dev:api
```

默认访问：

```text
http://localhost:18080/healthz
http://localhost:18080/api/ops/platform-snapshot
http://localhost:18080/api/ops/dashboard
http://localhost:18080/api/control/users
http://localhost:18080/api/control/applications
http://localhost:18080/api/gateway/routes
http://localhost:18080/api/billing/plans
```

使用 PostgreSQL 用户仓储启动：

```bash
pnpm dev:api:db
```

真实 PostgreSQL 链路 smoke：

```bash
pnpm smoke:api:db
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

`image:up` 会先运行 `/app/migrate-db` 和 `/app/seed-db`，再启动 `platform-all`。

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
pnpm dev:control      # :1820
pnpm dev:gateway      # :1821
pnpm dev:billing      # :1822
pnpm dev:ops          # :1823
pnpm dev:console-web  # :1818
```

## 方向

V1 先采用 DVSkyFolding 风格的 Go 服务边界，前端后台已经收敛为 5 个业务入口：

| 后台入口 | 后端归属 | API 分组 |
| --- | --- | --- |
| `operations` | `ops-api` | `/api/ops/platform-snapshot`, `/api/ops/dashboard`, `/api/ops/todos`, `/api/ops/audit-events` |
| `access` | `control-api` | `/api/control/users`, `/api/control/applications`, `/api/control/api-keys` |
| `gateway` | `gateway-api` | `/api/gateway/routes`, `/api/gateway/model-routes`, `/api/gateway/llm/invoke` |
| `billing` | `billing-service` | `/api/billing/plans`, `/api/billing/usage`, `/api/billing/budget-alerts` |
| `docs` | `console-web` + 对应业务 API | `/`, `/api/*` |

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
