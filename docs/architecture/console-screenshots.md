# Console Screenshots

这组截图用于让 public repo 的访问者快速理解当前平台形态：先看到项目定位，再进入后台首页，然后浏览运营、权限、网关、计费和帮助文档五个核心入口。脚本同时保留关键移动端截图，确保窄屏下仍能看清导航、角色视角、模块入口和核心操作。

截图由根目录脚本生成：

```bash
pnpm screenshots:console
```

脚本会先构建 `apps/console`，再临时启动 `cmd/platform-all`，用 Go API 的 seed 数据生成后台截图。生成结束后会自动停止本地服务。

## Landing

![Landing](../assets/screenshots/landing.png)

## Console Home

![Console Home](../assets/screenshots/console-home.png)

## Operations

![Operations Overview](../assets/screenshots/operations-overview.png)

## Access

![Access Management](../assets/screenshots/access-management.png)

## Gateway

![Gateway and Model](../assets/screenshots/gateway-model.png)

## Billing

![Billing and Quota](../assets/screenshots/billing-quota.png)

## Docs

![Help Docs](../assets/screenshots/help-docs.png)

## Mobile Console Home

![Console Home Mobile](../assets/screenshots/console-home-mobile.png)

## Mobile Gateway

![Gateway and Model Mobile](../assets/screenshots/gateway-model-mobile.png)

## Mobile Docs

![Help Docs Mobile](../assets/screenshots/help-docs-mobile.png)
