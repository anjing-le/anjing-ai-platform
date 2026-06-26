# Legacy Admin Console Prototype

这个目录是早期 Vue 3 信息架构原型，用来保留最初的首页、模块入口和角色视角探索。

正式后台控制台已经收敛到：

```text
apps/console
```

后续产品迭代、接口联调、生产构建和质量门禁都以 `apps/console` 为准。这个目录暂不进入 pnpm workspace，也不作为运行入口；如果里面有可复用的交互或文案，需要先迁移到 `apps/console`，再删除对应原型代码。

