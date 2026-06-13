# 后端服务规划

后端正式实现改为 Go，并以 DVSkyFolding 脚手架口径为基础。当前不再按 Spring Boot / Java 规划。

当前前端后台已经收敛为 1 个后台首页 + 5 个业务入口：

- 后台首页
- 运营总览
- 用户与权限
- 网关与模型
- 计费与配额
- 帮助文档

这 5 个入口不是把能力做少，而是把后台导航先做少。`llm`、`skill`、`credential`、`audit` 先作为能力并入对应入口：

| 后台入口 | 合并能力 | 后端归属 |
| --- | --- | --- |
| 运营总览 | observability / audit / ops | `ops-api` |
| 用户与权限 | iam / api key / credential | `control-api` |
| 网关与模型 | api gateway / llm gateway / skill hub | `gateway-api` |
| 计费与配额 | quota / billing / usage | `billing-service` |
| 帮助文档 | docs / examples / quickstart | `console-web` 静态元数据 + 对应业务 API |

## V1：Go command 边界 + 简单部署

V1 建议按 DVSkyFolding 的方式定义 4 个 Go command：

```text
cmd/control-api
cmd/gateway-api
cmd/billing-service
cmd/ops-api
```

同时保留一个 `cmd/console-web` 用于生产镜像内服务前端静态文件。

开发和预览阶段可以用一个 `all` 模式启动全部 command；生产或联调需要时，同一个镜像按 command 拆成多个容器。这样不是一开始做复杂微服务，而是先把代码边界、运行入口和未来拆分方向定清楚。

## 技术栈

| 层 | 选择 |
| --- | --- |
| 语言 | Go |
| HTTP | 标准库 `net/http` / `ServeMux` |
| 数据库 | PostgreSQL |
| DB 访问 | `pgx/v5` + SQL |
| 迁移 | SQL migrations |
| 日志 | `log/slog` JSON |
| 配置 | env |
| 前端生产服务 | `cmd/console-web` |

V1 不再使用 H2 / MySQL 作为默认开发口径。开发数据库也优先 PostgreSQL，和生产事实一致。

## 共享能力

共享包建议放在：

```text
internal/platform/
  config/
  db/
  httpjson/
  access/
  log/
```

职责：

- 统一配置加载
- PostgreSQL 连接池
- JSON 响应和错误结构
- Bearer token / API Key / RBAC 鉴权
- 结构化日志
- request id / trace id

## V1 访问控制

默认开发模式为 `ANJING_AUTH_MODE=permissive`，便于控制台和接口快速联调。设置 `ANJING_AUTH_MODE=enforced` 后，所有 `/api/**` 业务接口都会进入访问控制；`/healthz` 和各服务 `/api/*/healthz` 仍保持公开。

角色边界先按后台信息架构落地：

| 角色 | 允许范围 |
| --- | --- |
| `Administrator` | 全部接口 |
| `User` | 运营首页只读、计费与用量只读、LLM 调用 |
| `Developer` | 运营只读、网关与模型配置、API Key / credentialRef 只读、计费只读、LLM 调用 |
| `Operator` | 运营处理、服务健康、审计、计费只读、请求日志；不看网关配置 |

Demo bearer token：

```text
dev-admin-token
dev-user-token
dev-developer-token
dev-operator-token
```

Demo API Key：

```text
ak_live_customer
ak_live_knowledge
```

业务包建议：

```text
internal/control/
internal/gateway/
internal/billing/
internal/ops/
```

业务域之间不互相 import。需要联动时先通过数据库事实、事件记录或 HTTP API 解耦。

## 服务职责

### `control-api`

- 用户
- 组织
- 角色权限
- Session / OAuth
- API Key
- credentialRef
- 凭据脱敏和轮换策略

### `gateway-api`

- API 路由
- 模型路由
- 供应商渠道
- Skill 调用适配
- 限流
- 请求日志
- 流式响应
- fallback / timeout / retry

### `billing-service`

- 套餐
- 配额
- 用量事件
- 预算告警
- 账单聚合
- 幂等结算

### `ops-api`

- 运营总览
- 服务健康
- 审计事件
- 失败追踪
- 指标聚合
- 待办事项

### `console-web`

- 前端静态文件服务
- 健康检查
- 同镜像预览入口

## V2：按真实压力增强

只有出现真实压力或明确瓶颈后，再引入：

- Redis：高频 API Key / rate limit / session cache
- ClickHouse：高吞吐请求日志和分析
- MQ：异步计量、审计、通知
- Prometheus：运行指标
- Kubernetes：多副本编排

## 不做什么

- 不再按 Java / Spring Boot 做新后端。
- 不把所有能力设计成一个巨大 `platform-api` 概念。
- 不为了“像微服务”而提前增加 Redis、MQ、ClickHouse、Kubernetes。
- 不把 PostgreSQL 塞进应用镜像，数据库始终独立部署。

当前阶段的核心判断：代码边界按 Go command 拆清楚，部署复杂度先保持低。

## 当前已实现的 V1 API

当前 Go 后端已支持内存 seed 数据和 PostgreSQL 仓储。V1 API 合约放在 `contracts/openapi/platform-api.yaml`，覆盖当前控制台正在调用的 control、gateway、billing 和 ops 接口。

完整后端本地启动：

```bash
go run ./cmd/platform-all
```

单服务本地启动：

```bash
go run ./cmd/control-api      # :1820
go run ./cmd/gateway-api      # :1821
go run ./cmd/billing-service  # :1822
go run ./cmd/ops-api          # :1823
go run ./cmd/console-web      # :1818
```

### `control-api`

- `GET /api/control/healthz`
- `GET /api/control/users`
- `POST /api/control/users`
- `POST /api/control/users/activate`
- `GET /api/control/applications`
- `POST /api/control/applications`
- `POST /api/control/applications/activate`
- `POST /api/control/applications/rotate-key`
- `GET /api/control/roles`
- `GET /api/control/api-keys`
- `POST /api/control/api-keys/revoke`
- `GET /api/control/credentials`
- `POST /api/control/credentials/rotate`

### `gateway-api`

- `GET /api/gateway/healthz`
- `GET /api/gateway/routes`
- `POST /api/gateway/routes`
- `POST /api/gateway/routes/publish`
- `GET /api/gateway/model-routes`
- `POST /api/gateway/model-routes`
- `POST /api/gateway/model-routes/publish`
- `GET /api/gateway/skills`
- `POST /api/gateway/skills`
- `GET /api/gateway/request-logs`
- `POST /api/gateway/llm/invoke`

### `billing-service`

- `GET /api/billing/healthz`
- `GET /api/billing/plans`
- `POST /api/billing/plans`
- `POST /api/billing/plans/activate`
- `GET /api/billing/usage`
- `GET /api/billing/budget-alerts`
- `POST /api/billing/budget-alerts/resolve`

### `ops-api`

- `GET /api/ops/healthz`
- `GET /api/ops/dashboard`
- `GET /api/ops/todos`
- `POST /api/ops/todos/resolve`
- `GET /api/ops/service-health`
- `GET /api/ops/audit-events`
