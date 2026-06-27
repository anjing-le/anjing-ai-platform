# Roadmap

这个路线图按当前仓库的真实状态维护。V1 的目标不是把平台过早做成复杂微服务，而是把统一后台、Go API、OpenAPI 合约、数据底座和质量门禁稳定下来。

## 当前阶段：V1 骨架闭环

完成度：100%

- [x] 统一 public repo 方向为 Anjing AI Infra Platform。
- [x] 正式后台收敛到 `apps/console`。
- [x] 后台首页展示平台状态、模块入口、待办、角色矩阵和服务边界。
- [x] 后台入口精简为运营总览、用户与权限、网关与模型、计费与配额、帮助文档。
- [x] 管理员、使用用户、开发人员、运维人员四类视角完成导航和操作约束。
- [x] 用户、应用、API Key、credentialRef、路由、模型、Skill、用量、预算告警、审计和待办完成前端闭环。
- [x] Go 后端落地 `control-api`、`gateway-api`、`billing-service`、`ops-api`、`platform-all` 和 `console-web`。
- [x] OpenAPI 覆盖当前前端调用和后端注册路由。
- [x] PostgreSQL migration / seed 和内存 seed 保持一致。
- [x] 本地 smoke API、Go build/test、前端构建、前端测试和边界检查接入 `pnpm verify`。
- [x] Dockerfile 和本地 Compose 预览链路完成基础校验。
- [x] README、后端服务规划、前端结构、技术基线和质量门禁文档完成收口。

## V1.1：企业后台体验增强

- [x] 增加页面级 loading、error retry 和后台数据刷新策略的可视化细节。
- [x] 为关键操作补充二次确认和更明确的失败恢复路径。
- [x] 增加更完整的表格筛选、排序、分页和导出能力。
- [x] 增加控制台截图和模块截图，方便 public repo 快速理解项目形态。
- [x] 把帮助文档从内嵌内容升级为 Guides、API Examples、Deployment 和 Troubleshooting 文档中心。
- [x] 完善移动端和窄屏后台体验，但仍以桌面管理后台为主要使用场景。

## V1.2：后端真实能力增强

- [x] 把 demo token 演进为真实登录、会话和 OAuth 接入的最小闭环。
- [x] 本地 passwordless login、签名 session token、session 查询和 logout 闭环。
- [x] OAuth provider/callback state + session 最小闭环。
- [x] 外部 IdP token exchange + userinfo 最小闭环。
- [ ] 密码/MFA 和生产级用户信息同步。
- [x] 为 API Key 和 credentialRef 接入脱敏展示、轮换、吊销和审计链路。
- [x] 为网关增加真实上游代理、超时、重试和 fallback 最小闭环。
- [x] 为网关增加已发布 route 运行时限流。
- [x] 为网关增加流式响应最小闭环。
- [x] 为网关增加 Redis 分布式限流最小闭环和本机 fallback。
- [ ] 为网关增加更完整的上游治理。
- [x] 为 LLM 调用增加 provider adapter、模型路由策略和 token 用量计量最小闭环。
- [x] 为 LLM 调用增加 SSE 流式输出最小闭环。
- [ ] 为 LLM 调用接入真实 provider SDK、provider-native stream 和精确 token 计量。
- [x] 为 Skill 增加 adapter、发布绑定、调用测试和 Skill call 用量计量最小闭环。
- [x] 为 Skill 调用增加按 `schemaVersion` 的输入校验。
- [x] 为 Skill 增加真实 HTTP adapter 最小闭环。
- [ ] 为 Skill 增加 schema registry、版本管理、MCP 真实适配和治理策略。
- [x] 为计费增加幂等用量事件。
- [x] 为计费增加账单聚合。
- [x] 为计费增加预算阈值。
- [x] 为审计和请求日志增加基础查询条件。
- [x] 为审计和请求日志增加导出能力。
- [x] 为审计和请求日志增加保留策略。

## V2：按压力拆分服务

- [ ] 保持统一后台不变，按运行压力把 command 拆成独立容器。
- [ ] 网关链路独立扩容，优先服务模型调用、Skill 调用和请求日志。
- [ ] 计量、审计和通知从同步写入演进到异步事件。
- [ ] 扩展 Redis 到高频 API Key 校验、session cache 和更完整的限流观测。
- [ ] 引入 ClickHouse 或同类分析库承接高吞吐请求日志。
- [ ] 接入 Prometheus 指标和告警规则。

## V3：平台化生态

- [ ] 增加多租户组织、项目空间和环境隔离。
- [ ] 增加插件化 provider、Skill marketplace 和应用模板。
- [ ] 增加客服、知识库、AIGC 等 examples 的完整端到端示例。
- [ ] 增加 cloud / self-hosted 双形态部署文档。
- [ ] 增加稳定版本发布、升级迁移和兼容性策略。

## 当前不做

- [ ] 不把 `llm`、`skill`、`credential`、`audit` 过早拆成独立后台入口。
- [ ] 不提前引入 Kubernetes、MQ、ClickHouse 或复杂配置中心。
- [ ] 不维护多个分散 public infra repo 的重复后台。
- [ ] 不迁移 private 项目代码到 public repo。
