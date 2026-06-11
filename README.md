# anjing-ai-platform

Anjing AI Infra Platform 是面向 AI 应用、Agent、内部工具和业务系统的 public 开源基础设施平台。

当前阶段先从前端体验开始迭代：用一个统一的 `admin-console` 跑通后台首页、模块入口、Mock 工作流和后续后端服务边界。

## 当前内容

- `frontend/admin-console`: Vue 3 + TypeScript + Vite 后台控制台
- 后台首页：平台状态、模块说明、推荐操作路径
- 业务入口：运营总览、用户与权限、网关与模型、计费与配额、帮助文档
- Mock 工作流：创建应用、API Key、网关消费者、用量、审计、调用日志联动
- 后端规划：见 `docs/architecture/backend-services.md`

## 本地启动

```bash
cd frontend/admin-console
pnpm install
pnpm dev
```

默认访问：

```text
http://localhost:13007/
```

## 方向

V1 先采用模块化单体，前端业务入口已经收敛为：

- `operations`: 运营总览、健康状态、告警、日志、审计
- `access`: 用户、组织、角色、权限、API Key、credentialRef
- `gateway`: API 路由、模型路由、供应商、Skill 调用、限流
- `billing`: 套餐、配额、用量、账单、预算告警
- `docs`: Quickstart、API 文档、SDK、示例、FAQ
