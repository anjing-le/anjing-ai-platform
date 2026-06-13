# Scripts

这个目录放仓库级质量门禁脚本。它们都通过根目录 `package.json` 暴露为 `pnpm verify:*` 命令，并被统一入口 `pnpm verify` 串起来。

| Script | NPM command | Purpose |
| --- | --- | --- |
| `scripts/check-workspace.mjs` | `pnpm verify:workspace` | 检查 pnpm workspace、正式 console 包名和根脚本 filter 是否一致。 |
| `apps/console/src/**/*.test.ts` | `pnpm test:console` | 验证前端快照 hydration、模块表格和状态 tone 映射。 |
| `scripts/check-openapi-routes.sh` | `pnpm verify:openapi` | 比对 Go `mux.HandleFunc` 注册路径与 OpenAPI `paths`，防止接口和合约漂移。 |
| `scripts/check-openapi-metadata.mjs` | `pnpm verify:openapi-meta` | 检查 OpenAPI operationId、summary、角色、错误响应、POST requestBody 和相邻重复 YAML key。 |
| `scripts/check-service-boundaries.mjs` | `pnpm verify:boundaries` | 比对前端 `consoleServiceMap` 与 OpenAPI `x-anjing-service-boundaries`，并确认 API 分组存在于 OpenAPI `paths`。 |
| `scripts/check-console-api-client.mjs` | `pnpm verify:console-api` | 检查前端 API client 中的 `/api/*` 路径是否都已写入 OpenAPI。 |
| `scripts/check-platform-snapshot-contract.mjs` | `pnpm verify:snapshot` | 检查 Go、OpenAPI 和前端 TypeScript 的 `PlatformSnapshot` 字段一致。 |
| `scripts/check-command-runtime.mjs` | `pnpm verify:commands` | 检查 Go command 使用结构化日志启动，不使用 `panic` 作为运行时错误处理。 |
| `scripts/check-role-policy-seeds.mjs` | `pnpm verify:role-seeds` | 检查内存 seed 和 PostgreSQL role policies seed 的可见入口是否匹配前端导航角色规则。 |
| `scripts/check-doc-links.mjs` | `pnpm verify:docs` | 检查 README 和 `docs/` 中明显指向仓库内的路径是否真实存在。 |
| `scripts/check-compose.sh` | `pnpm verify:compose` | 校验本地 PostgreSQL 和单镜像预览 compose 文件可以通过 `docker compose config`。 |
| `scripts/check-dockerfile-paths.mjs` | `pnpm verify:dockerfile` | 检查 Dockerfile 本地 `COPY` 源路径是否真实存在。 |
| `scripts/check-db-files.mjs` | `pnpm verify:db-files` | 检查 PostgreSQL migration / seed 编号、seed 和 Go repository 表引用、用户、应用、网关、计费与运营联动、迁移目录配置。 |
| `scripts/check-gofmt.sh` | `pnpm verify:gofmt` | 检查 Go 源码是否已经通过 `gofmt` 格式化。 |
| `scripts/check-govet.sh` | `pnpm verify:govet` | 运行 `go vet ./...`，检查 Go 代码中的可疑实现问题。 |
| `go build ./cmd/...` | `pnpm verify:go-build` | 构建全部 Go command，确保本地和镜像交付入口可编译。 |

新增脚本时，优先遵守这几个约定：

- 脚本只检查一个清晰边界，失败信息要能直接指出需要修改的文件。
- 脚本应能在本地和 CI 中用同一命令运行。
- 新脚本接入 `pnpm verify` 后，同步更新 `docs/architecture/quality-gates.md`。
