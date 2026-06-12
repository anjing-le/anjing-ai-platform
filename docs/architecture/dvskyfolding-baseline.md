# DVSkyFolding 技术基线

后续 `anjing-ai-platform` 的重构和实现以 DVSkyFolding 脚手架口径为基础。当前本地可参考的同类实现是 `/Users/lvxianghe/project/anjing/product/anjing-token-hub`，它已经沉淀了 Go 后端、统一大前端、PostgreSQL 数据底座和单镜像交付的工程取向。

## 基线结论

- 前端：React + TypeScript + Vite，统一大前端入口。
- 后端：Go，不再使用 Java / Spring Boot 作为新平台默认后端。
- HTTP：优先 Go 标准库 `net/http` / `ServeMux`，不急着引入 Web 框架。
- 数据库：PostgreSQL 为主库，开发和 S1 不再使用 H2 / MySQL 作为默认口径。
- DB 访问：`pgx/v5` + SQL，先不引入 ORM。
- 日志：`log/slog` JSON 结构化日志。
- 配置：env 优先，不引入配置中心。
- 交付：一个应用镜像，内含 console web 和多个 Go command；本地可 `all` 模式启动，生产可按 command 拆容器。

## 为什么改成 Go

平台核心不是普通后台 CRUD，而是 API 网关、模型路由、流式响应、上游超时取消、请求日志、审计、用量计量和预算告警。Go 更适合这类运行面：

- 并发模型简单，适合长连接、SSE、流式转发和请求取消。
- 单二进制交付简单，镜像更小，运维成本低。
- 标准库的 HTTP、context、transport 足够支撑 V1。
- 内存和 CPU 成本低，适合 public 开源项目先轻量启动。

## 对当前仓库的影响

当前 `frontend/admin-console` 作为 Vue 原型保留，用来追溯早期信息架构。正式工程已开始按 DVSkyFolding 落在：

```text
apps/console        React + TypeScript + Vite
cmd/control-api     Go：用户、组织、角色、权限、API Key、凭据引用
cmd/gateway-api     Go：API 路由、模型路由、Skill 调用、限流、请求日志
cmd/billing-service Go：套餐、配额、用量、预算告警、账单聚合
cmd/ops-api         Go：运营总览、健康状态、审计、待办、指标聚合
cmd/console-web     Go：生产镜像内的前端静态文件服务
internal/platform   Go：配置、DB、JSON 响应、鉴权、日志、错误结构
infra/postgres      SQL schema / migrations
```

## V1 服务边界

V1 不做复杂微服务，但也不把所有运行面塞进一个巨大进程概念里。按 DVSkyFolding 口径，先定义 4 个 Go command：

- `control-api`: 用户与权限、API Key、credentialRef。
- `gateway-api`: 网关与模型、Skill 调用、请求日志。
- `billing-service`: 计费与配额、用量、预算。
- `ops-api`: 运营总览、健康状态、审计、待办。

本地和预览可以用一个 `all` 模式同时启动这些 command；生产或联调需要时，再按 command 拆容器。这样既保留清晰服务边界，又不增加早期交付复杂度。

## 暂不引入

- 暂不引入 Spring Boot。
- 暂不引入 H2 / MySQL 作为默认数据库。
- 暂不引入 ORM、代码生成和复杂依赖注入。
- 暂不引入 Redis、ClickHouse、MQ、Kubernetes，除非真实压力证明需要。
