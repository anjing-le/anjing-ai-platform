# 后端服务规划

当前前端已经收敛为 1 个后台首页 + 5 个业务入口：

- 后台首页
- 运营总览
- 用户与权限
- 网关与模型
- 计费与配额
- 帮助文档

## V1 建议：1 个后端服务

V1 仍建议只做 1 个 Spring Boot 服务：`platform-api`。

原因：

- 当前产品边界还在快速变化，先保持模块化单体更适合迭代。
- 认证、网关配置、模型路由、用量、审计之间存在强关联，过早拆服务会增加事务和联调成本。
- public 开源项目更需要容易启动、容易理解、容易部署。

`platform-api` 内部按模块拆包：

- `operations`: 运营总览、健康状态、告警、审计视图
- `access`: 用户、组织、角色、权限、API Key、credentialRef
- `gateway`: API 路由、模型路由、供应商、Skill 调用、限流
- `billing`: 套餐、配额、用量、账单、预算告警
- `docs`: Quickstart、API 文档、SDK 文档、FAQ 元数据
- `audit`: 操作日志、调用日志、Trace、异步事件

## V1 可选：1 个异步 Worker

如果 mock 流程开始接真实调用，建议增加一个轻量 worker：`platform-worker`。

职责：

- 聚合调用日志
- 写入审计事件
- 计算用量和预算告警
- 执行凭据轮换检查
- 导出日报和账单

如果想继续极简，`platform-worker` 可以先作为 `platform-api` 内部定时任务存在，不单独部署。

## V2 拆分建议：3 个服务

当调用量、权限复杂度和计费精度上来之后，再拆成 3 个服务：

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

## V3 再拆分

只有当模块边界稳定且团队需要独立交付时，再考虑继续拆：

- `iam-service`
- `billing-service`
- `model-gateway`
- `skill-runtime`
- `audit-service`

当前阶段不要这样拆。V1 以 `platform-api` 模块化单体为主，最多加一个 worker。
