# 质量门禁

当前阶段的质量门禁目标不是追求复杂流程，而是保护 V1 最容易漂移的边界：前端控制台、Go 后端路由、OpenAPI 合约和服务归属元数据。

统一入口：

```bash
pnpm verify
```

## Gate 1：前端构建

命令：

```bash
pnpm build:console
```

保护内容：

- React + TypeScript 控制台可以完成类型检查和 Vite 生产构建。
- 后台首页、模块页面、角色视角、服务边界和 Mock / API 串联没有基础编译错误。

## Gate 2：OpenAPI 路由覆盖

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

## Gate 3：服务边界一致性

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

## Gate 4：文档本地引用

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

## Gate 5：Compose 配置

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

## Gate 6：Go 测试

命令：

```bash
go test ./...
```

保护内容：

- control、gateway、billing、ops 业务包的核心行为仍然通过测试。
- RBAC / demo token / API Key 的访问控制规则不会被无意破坏。
- route publish、model route、Skill binding、budget resolve、todo resolve 等闭环接口保持可用。

## CI 对齐

CI 模板位于：

```text
docs/ci/github-actions-ci.yml
```

模板中使用 `pnpm verify` 作为统一门禁入口，本地和 CI 使用同一套 gate。

当前没有直接提交 `.github/workflows/ci.yml`，因为自动化 token 需要 `workflow` scope。启用 GitHub Actions 时，把模板复制到 `.github/workflows/ci.yml` 即可。
