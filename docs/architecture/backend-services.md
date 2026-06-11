# 后端服务规划

当前前端后台已经收敛为 1 个后台首页 + 5 个业务入口：

- 后台首页
- 运营总览
- 用户与权限
- 网关与模型
- 计费与配额
- 帮助文档

这 5 个入口不是把能力做少，而是把后台导航先做少。`llm`、`skill`、`credential`、`audit` 先作为能力并入对应入口：

| 后台入口 | 合并能力 | 说明 |
| --- | --- | --- |
| 运营总览 | observability / audit / ops | 健康状态、调用日志、审计事件、待办和风险 |
| 用户与权限 | iam / api key / credential | 用户、角色、API Key、credentialRef 和凭据策略 |
| 网关与模型 | api gateway / llm gateway / skill hub | API 路由、模型路由、Skill 调用、限流和请求日志 |
| 计费与配额 | quota / billing / usage | 套餐、配额、项目用量、预算告警，未来接真实账单 |
| 帮助文档 | docs / examples / quickstart | 接入路径、API 文档、示例和 FAQ |

## V1：1 个后端服务

V1 建议只做 1 个 Spring Boot 服务：`platform-api`。

原因：

- 当前产品边界还在快速变化，模块化单体更适合前端驱动迭代。
- 认证、网关配置、模型路由、用量、审计之间强关联，过早拆服务会增加事务和联调成本。
- public 开源项目需要容易启动、容易理解、容易部署。

`platform-api` 内部按模块拆包：

- `operations`: 运营总览、健康状态、调用日志、审计事件、待办
- `access`: 用户、角色、权限、API Key、credentialRef、凭据策略
- `gateway`: API 路由、模型路由、Skill 调用、限流、请求日志
- `billing`: 套餐、配额、用量、预算告警
- `docs`: Quickstart、API 文档、示例、FAQ 元数据

V1 的目标是先把后台所有页面接到同一个 API 边界上。数据库可以先用 H2 开发，生产再接 MySQL；Redis 可以等限流、会话或异步任务需要时再接。

## V1 可选：1 个 Worker

当开始接真实调用流量后，可以增加一个轻量 worker：`platform-worker`。

职责：

- 聚合调用日志
- 写入审计事件
- 计算用量和预算告警
- 执行凭据到期检查
- 导出日报、用量报表和账单草稿

如果想继续极简，`platform-worker` 可以先作为 `platform-api` 内部定时任务存在，不单独部署。

## V2：3 个服务

当出现以下信号时，再拆成 3 个服务：

- 运行期 API 流量明显高于后台管理流量
- 计量、预算和账单需要独立扩展
- 网关运行期需要更强的发布、回滚和隔离能力

V2 服务：

1. `platform-api`
   - 后台管理 API
   - 用户权限
   - 配置管理
   - 文档元数据

2. `gateway-runtime`
   - API 入口
   - 鉴权前置
   - 限流
   - 模型路由
   - Skill 调用代理
   - 流式响应

3. `metering-worker`
   - 调用日志
   - 审计事件
   - 用量统计
   - 预算告警
   - 账单聚合

## V3：按团队和边界继续拆

只有当模块边界稳定，并且团队需要独立交付时，再考虑继续拆：

- `iam-service`
- `billing-service`
- `model-gateway`
- `skill-runtime`
- `audit-service`

当前阶段不要这样拆。V1 以 `platform-api` 模块化单体为主，最多加一个 worker。
