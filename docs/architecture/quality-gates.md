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
- 后台入口、后端归属和 API 分组不能在前端、合约之间漂移。
- 当前受保护的入口包括 `operations`、`access`、`gateway`、`billing` 和 `docs`。

## Gate 4：Go 测试

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

模板中使用 `pnpm verify` 作为统一门禁入口，并额外校验本地 compose 文件：

```bash
docker compose -f infra/local/docker-compose.yml config
docker compose -f infra/local/docker-compose.image.yml config
```

当前没有直接提交 `.github/workflows/ci.yml`，因为自动化 token 需要 `workflow` scope。启用 GitHub Actions 时，把模板复制到 `.github/workflows/ci.yml` 即可。
