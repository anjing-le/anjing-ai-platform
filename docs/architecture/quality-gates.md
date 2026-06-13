# 质量门禁

当前阶段的质量门禁目标不是追求复杂流程，而是保护 V1 最容易漂移的边界：workspace 入口、前端控制台、Go 后端路由、OpenAPI 合约和服务归属元数据。

统一入口：

```bash
pnpm verify
```

## Gate 1：Workspace 配置

命令：

```bash
pnpm verify:workspace
```

脚本：

```text
scripts/check-workspace.mjs
```

保护内容：

- 根 `package.json` 必须保持 private，并声明 `pnpm@` package manager。
- `pnpm-workspace.yaml` 必须包含 apps workspace pattern，且该 pattern 能解析到真实 package。
- 正式后台包必须是 `apps/console` 下的 `@anjing-ai-platform/console`。
- 根目录 `dev:console`、`build:console`、`preview:console` 必须指向正式 console 包，避免早期 Vue 原型和正式后台入口漂移。

## Gate 2：前端构建

命令：

```bash
pnpm build:console
```

保护内容：

- React + TypeScript 控制台可以完成类型检查和 Vite 生产构建。
- 后台首页、模块页面、角色视角、服务边界和 Mock / API 串联没有基础编译错误。

## Gate 3：前端数据映射测试

命令：

```bash
pnpm test:console
```

测试：

```text
apps/console/src/lib/hydrate.test.ts
```

保护内容：

- 后端 `PlatformSnapshot` 能正确映射到后台首页指标。
- 运营待办的来源能映射到 `iam`、`quota` 等控制台入口。
- 模块页表格、指标和状态 tone 能随 Live API 数据稳定刷新。

## Gate 4：OpenAPI 路由覆盖

命令：

```bash
pnpm verify:openapi
```

脚本：

```text
scripts/check-openapi-routes.sh
```

保护内容：

- Go `mux.HandleFunc` 注册的 `/healthz`、`/api/*` 路径必须出现在 `contracts/openapi/platform-api.yaml`。
- OpenAPI `paths` 里声明的 `/healthz`、`/api/*` 路径必须在 Go 里真实注册。
- 新增后端接口时，不能只改 Go 代码而忘记更新合约。

## Gate 5：OpenAPI 元数据完整性

命令：

```bash
pnpm verify:openapi-meta
```

脚本：

```text
scripts/check-openapi-metadata.mjs
```

保护内容：

- 每个 OpenAPI operation 必须声明唯一 `operationId`、`summary` 和 `responses`。
- OpenAPI 文件不允许出现同一缩进下相邻重复 key，例如重复的 `responses:` 或 `$ref:`。
- 业务 `/api/*` 接口必须声明 `x-anjing-roles`、`401` 和 `403` 响应。
- 业务 POST 接口必须声明 `requestBody`，避免前端和后端对请求体形状各自猜测。

## Gate 6：服务边界一致性

命令：

```bash
pnpm verify:boundaries
```

脚本：

```text
scripts/check-service-boundaries.mjs
```

保护内容：

- 前端 `consoleServiceMap` 和 OpenAPI `x-anjing-service-boundaries` 必须保持一致。
- 后台入口 key、展示名称、后端归属和 API 分组不能在前端、合约之间漂移。
- 边界中列出的 API 分组必须存在于 OpenAPI `paths`，`/` 和 `/api/*` 作为帮助文档入口的虚拟分组保留。
- 当前受保护的入口包括 `operations`、`access`、`gateway`、`billing` 和 `docs`。

## Gate 7：前端 API Client 覆盖

命令：

```bash
pnpm verify:console-api
```

脚本：

```text
scripts/check-console-api-client.mjs
```

保护内容：

- 前端 `apps/console/src/lib/api.ts` 中直接调用的 `/api/*` 路径必须存在于 OpenAPI `paths`。
- 后台按钮、列表刷新和 Live API 接入不能绕过合约。
- 新增前端 API 调用时，必须同步补充 `contracts/openapi/platform-api.yaml`。

## Gate 8：前端运行文案

命令：

```bash
pnpm verify:console-copy
```

脚本：

```text
scripts/check-console-runtime-copy.mjs
```

保护内容：

- 后台首页的主运行命令必须展示 `pnpm dev:api`。
- 顶部工具区必须保留手动刷新平台数据的动作。
- 单服务规划中的健康检查地址必须展示真实的 `http://localhost:182x/healthz`。
- 不能把不存在的 `/api/*/healthz` 当成服务健康地址展示。

## Gate 9：平台快照合约

命令：

```bash
pnpm verify:snapshot
```

脚本：

```text
scripts/check-platform-snapshot-contract.mjs
```

保护内容：

- Go `internal/platform/store/store.go` 的 `PlatformSnapshot`、OpenAPI `PlatformSnapshot` schema 和前端 `apps/console/src/lib/api.ts` 的 `PlatformSnapshot` 字段必须一致。
- OpenAPI `PlatformSnapshot.required` 和 `properties` 必须一致。
- 后台首页聚合快照不能在 Go、合约和前端类型之间漂移。

## Gate 10：Command 运行时约束

命令：

```bash
pnpm verify:commands
```

脚本：

```text
scripts/check-command-runtime.mjs
```

保护内容：

- HTTP 服务 command 必须通过 `service.ListenWithLogger` 启动，确保启动和请求日志使用同一套 `slog` JSON logger。
- Go command 不允许用 `panic` 处理运行时启动错误。
- `migrate-db` 和 `seed-db` 保持一次性 command，使用结构化日志和显式退出码。

## Gate 11：角色 Seed 可见性

命令：

```bash
pnpm verify:role-seeds
```

脚本：

```text
scripts/check-role-policy-seeds.mjs
```

保护内容：

- 内存 seed `internal/platform/store/store.go` 的 `RolePolicy.VisibleEntries` 必须匹配前端 `navItems`。
- PostgreSQL seed `infra/postgres/seeds/006_demo_role_policies.sql` 的 `visible_entries` 必须匹配前端 `navItems`。
- 运维、开发、使用用户的后台入口展示不能在 Mock / 内存 / PostgreSQL 三种模式下漂移。

## Gate 12：文档本地引用

命令：

```bash
pnpm verify:docs
```

脚本：

```text
scripts/check-doc-links.mjs
```

保护内容：

- README 和 `docs/` 中明显指向仓库内的路径必须真实存在。
- 当前检查 `apps/`、`cmd/`、`contracts/`、`docs/`、`frontend/`、`infra/`、`internal/`、`scripts/` 和常见根文件。
- `/api/*`、URL、绝对本机路径和未启用的 `.github` workflow 路径不会作为本地文件检查。

## Gate 13：Compose 配置

命令：

```bash
pnpm verify:compose
```

脚本：

```text
scripts/check-compose.sh
```

保护内容：

- `infra/local/docker-compose.yml` 必须能通过 `docker compose config`。
- `infra/local/docker-compose.image.yml` 必须能通过 `docker compose config`。
- 本地 PostgreSQL 和单镜像预览的编排配置不能因为字段错误或路径错误而失效。

## Gate 14：Dockerfile 路径

命令：

```bash
pnpm verify:dockerfile
```

脚本：

```text
scripts/check-dockerfile-paths.mjs
```

保护内容：

- Dockerfile 中本地 `COPY` 源路径必须真实存在。
- 多阶段构建里的 `COPY --from=...` 不作为本地路径检查。
- 镜像必须构建并复制 `migrate-db`、`seed-db`，同时复制 PostgreSQL migrations 和 seeds 目录。
- 重构目录时，镜像构建入口不会静默引用不存在的路径。

## Gate 15：数据库文件一致性

命令：

```bash
pnpm verify:db-files
```

脚本：

```text
scripts/check-db-files.mjs
```

保护内容：

- `infra/postgres/migrations` 和 `infra/postgres/seeds` 下的 SQL 文件必须使用连续三位编号和 snake_case 文件名。
- seed 文件 `INSERT INTO` 的表必须由 migration 文件创建。
- Go repository SQL 中 `from`、`insert into`、`update` 引用的表必须由 migration 文件创建。
- Postgres 用户邀请和激活必须同步 `ops_todos` 和 `audit_events`，保持真实数据库模式的运营闭环。
- Postgres 应用创建、激活和 Key 轮换必须同步 API Key、运营待办、请求日志与审计事件，保证后台总览能看到完整接入链路。
- Postgres 网关路由、模型路由和 Skill 绑定的创建/发布必须同步请求日志与审计事件，保证运营总览可以追踪配置变更。
- Postgres 计费套餐创建、启用和预算告警处理必须同步预算告警与审计事件，保证配额运营动作可追溯。
- Postgres 运营待办解决必须写入审计事件，保证后台首页的待办状态和审计流一致。
- Go 默认 migrations / seeds 目录、单镜像 compose 目录和 `db:seed` 脚本必须指向同一套 PostgreSQL 文件。

## Gate 16：本地开发入口

命令：

```bash
pnpm verify:local-dev
```

脚本：

```text
scripts/check-local-dev-scripts.mjs
```

保护内容：

- `db:prepare` 必须串起 `db:up`、`db:migrate`、`db:seed`，保证本地 PostgreSQL 可以一条命令准备好。
- `dev:api` 必须启动 `cmd/platform-all`，作为默认内存模式 API。
- `dev:api:db` 必须带默认 PostgreSQL 连接串启动 `cmd/platform-all`，作为真实数据库模式 API。
- `dev:control`、`dev:gateway`、`dev:billing`、`dev:ops`、`dev:console-web` 必须分别启动对应的单服务 command。
- `smoke:api:db` 必须预检 Docker daemon，准备 PostgreSQL，再用真实数据库模式复用 platform API smoke。
- `apps/console` 必须保留 Vite `/api` 代理、`VITE_API_BASE_URL` client 配置和 `.env.example`，保证控制台可以稳定连接本地或独立部署的 Go API。

## Gate 17：Platform API Smoke

命令：

```bash
pnpm verify:smoke-api
```

脚本：

```text
scripts/smoke-platform-api.mjs
```

保护内容：

- 自动选择空闲端口启动 `cmd/platform-all`。
- `/healthz` 必须返回成功状态。
- `/api/ops/platform-snapshot` 必须返回可供控制台首页使用的聚合快照。
- 当设置 `ANJING_SMOKE_DATABASE_URL` 时，必须验证 PostgreSQL seed 中的核心用户和应用已经进入聚合快照。

## Gate 18：Go 格式

命令：

```bash
pnpm verify:gofmt
```

脚本：

```text
scripts/check-gofmt.sh
```

保护内容：

- 所有 Go 源码必须通过 `gofmt` 格式化。
- 检查会跳过 `.git` 和 `node_modules`。
- 失败时输出需要格式化的文件列表。

## Gate 19：Go Vet

命令：

```bash
pnpm verify:govet
```

脚本：

```text
scripts/check-govet.sh
```

保护内容：

- 运行标准库 `go vet ./...`。
- 提前发现格式检查和单元测试不一定覆盖的可疑实现问题。

## Gate 20：Go Command 构建

命令：

```bash
pnpm verify:go-build
```

保护内容：

- `cmd/platform-all`、`cmd/migrate-db`、`cmd/seed-db` 和各单服务 command 必须可以完成 `go build`。
- Dockerfile 中构建的交付入口必须先在本地门禁中被编译验证。
- 新增 command 时，不能只通过包测试而遗漏真实可执行入口构建。

## Gate 21：Go 测试

命令：

```bash
go test ./...
```

保护内容：

- control、gateway、billing、ops 业务包的核心行为仍然通过测试。
- RBAC / demo token / API Key 的访问控制规则不会被无意破坏。
- OpenAPI `x-anjing-roles` 必须和后端 `Allowed(role, method, path)` 访问控制规则一致。
- route publish、model route、Skill binding、budget resolve、todo resolve 等闭环接口保持可用。

## CI 对齐

CI 模板位于：

```text
docs/ci/github-actions-ci.yml
```

模板中使用 `pnpm verify` 作为统一门禁入口，本地和 CI 使用同一套 gate。

当前没有直接提交 `.github/workflows/ci.yml`，因为自动化 token 需要 `workflow` scope。启用 GitHub Actions 时，把模板复制到 `.github/workflows/ci.yml` 即可。
