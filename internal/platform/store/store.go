package store

import (
	"fmt"
	"strings"
	"sync"
	"time"
)

type Store struct {
	mu sync.RWMutex

	users        []User
	applications []Application
	roles        []RolePolicy
	apiKeys      []APIKey
	credentials  []Credential

	routes      []GatewayRoute
	modelRoutes []ModelRoute
	skills      []SkillBinding
	requestLogs []RequestLog

	plans        []BillingPlan
	usageRecords []UsageRecord
	budgetAlerts []BudgetAlert

	todos  []OpsTodo
	health []ServiceHealth
	audit  []AuditEvent
}

type User struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	Org       string `json:"org"`
	Role      string `json:"role"`
	MFA       string `json:"mfa"`
	Status    string `json:"status"`
	CreatedAt string `json:"createdAt"`
}

type Application struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Owner        string `json:"owner"`
	Environment  string `json:"environment"`
	APIKey       string `json:"apiKey"`
	DefaultRoute string `json:"defaultRoute"`
	Plan         string `json:"plan"`
	Status       string `json:"status"`
	CreatedAt    string `json:"createdAt"`
}

type RolePolicy struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	VisibleEntries string `json:"visibleEntries"`
	ConfigScope    string `json:"configScope"`
	Restriction    string `json:"restriction"`
	Status         string `json:"status"`
}

type APIKey struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Project   string `json:"project"`
	Scope     string `json:"scope"`
	ExpiresAt string `json:"expiresAt"`
	Status    string `json:"status"`
}

type Credential struct {
	ID            string `json:"id"`
	Ref           string `json:"ref"`
	Purpose       string `json:"purpose"`
	Scope         string `json:"scope"`
	ExpiresAt     string `json:"expiresAt"`
	Status        string `json:"status"`
	MaskedPreview string `json:"maskedPreview"`
}

type GatewayRoute struct {
	ID        string `json:"id"`
	Route     string `json:"route"`
	Upstream  string `json:"upstream"`
	Auth      string `json:"auth"`
	Limit     string `json:"limit"`
	Status    string `json:"status"`
	UpdatedAt string `json:"updatedAt"`
}

type ModelRoute struct {
	ID        string `json:"id"`
	Alias     string `json:"alias"`
	Scenario  string `json:"scenario"`
	Primary   string `json:"primary"`
	Fallback  string `json:"fallback"`
	Status    string `json:"status"`
	UpdatedAt string `json:"updatedAt"`
}

type SkillBinding struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Protocol  string `json:"protocol"`
	Route     string `json:"route"`
	Timeout   string `json:"timeout"`
	Status    string `json:"status"`
	UpdatedAt string `json:"updatedAt"`
}

type RequestLog struct {
	ID        string `json:"id"`
	Request   string `json:"request"`
	Consumer  string `json:"consumer"`
	Latency   string `json:"latency"`
	Result    string `json:"result"`
	Status    string `json:"status"`
	CreatedAt string `json:"createdAt"`
}

type BillingPlan struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Target      string `json:"target"`
	RPS         string `json:"rps"`
	TokenPerDay string `json:"tokenPerDay"`
	Status      string `json:"status"`
}

type UsageRecord struct {
	ID         string `json:"id"`
	Project    string `json:"project"`
	Tokens     string `json:"tokens"`
	SkillCalls string `json:"skillCalls"`
	Cost       string `json:"cost"`
	Status     string `json:"status"`
	UpdatedAt  string `json:"updatedAt"`
}

type BudgetAlert struct {
	ID        string `json:"id"`
	Project   string `json:"project"`
	Budget    string `json:"budget"`
	Current   string `json:"current"`
	Threshold string `json:"threshold"`
	Status    string `json:"status"`
}

type OpsTodo struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Source    string `json:"source"`
	Owner     string `json:"owner"`
	Status    string `json:"status"`
	UpdatedAt string `json:"updatedAt"`
}

type ServiceHealth struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	SLO    string `json:"slo"`
	P95    string `json:"p95"`
	Status string `json:"status"`
}

type AuditEvent struct {
	ID        string `json:"id"`
	Time      string `json:"time"`
	Module    string `json:"module"`
	Action    string `json:"action"`
	Object    string `json:"object"`
	Status    string `json:"status"`
	RequestID string `json:"requestId"`
}

type OpsDashboard struct {
	Metrics []Metric        `json:"metrics"`
	Todos   []OpsTodo       `json:"todos"`
	Health  []ServiceHealth `json:"health"`
	Audit   []AuditEvent    `json:"audit"`
}

type Metric struct {
	Label string `json:"label"`
	Value string `json:"value"`
	Note  string `json:"note"`
}

func NewSeedStore() *Store {
	now := nowLabel()
	return &Store{
		users: []User{
			{ID: "usr_admin", Email: "lin.chen@anjing.ai", Org: "Platform", Role: "Administrator", MFA: "Enabled", Status: "Active", CreatedAt: now},
			{ID: "usr_dev", Email: "dev-api@anjing.ai", Org: "Engineering", Role: "Developer", MFA: "Enabled", Status: "Active", CreatedAt: now},
		},
		applications: []Application{
			{ID: "app_customer", Name: "customer-service-agent", Owner: "lin.chen@anjing.ai", Environment: "Production", APIKey: "ak_live_customer", DefaultRoute: "/api/v1/llm/**", Plan: "Business", Status: "Active", CreatedAt: now},
			{ID: "app_knowledge", Name: "knowledge-rag", Owner: "dev-api@anjing.ai", Environment: "Production", APIKey: "ak_live_knowledge", DefaultRoute: "/api/v1/skills/**", Plan: "Business", Status: "Active", CreatedAt: now},
			{ID: "app_aigc", Name: "aigc-lab", Owner: "dev-api@anjing.ai", Environment: "Sandbox", APIKey: "ak_live_aigc_lab", DefaultRoute: "/api/v1/llm/**", Plan: "Free", Status: "Warning", CreatedAt: now},
		},
		roles: []RolePolicy{
			{ID: "role_admin", Name: "Administrator", VisibleEntries: "all", ConfigScope: "all", Restriction: "none", Status: "Active"},
			{ID: "role_user", Name: "User", VisibleEntries: "overview,quota,docs", ConfigScope: "self-service", Restriction: "no runtime config", Status: "Active"},
			{ID: "role_developer", Name: "Developer", VisibleEntries: "overview,gateway,quota,docs", ConfigScope: "gateway routes,model aliases,skill adapters", Restriction: "no billing settlement", Status: "Active"},
			{ID: "role_operator", Name: "Operator", VisibleEntries: "overview,gateway,quota", ConfigScope: "runtime policy", Restriction: "no developer-owned route schema", Status: "Active"},
		},
		apiKeys: []APIKey{
			{ID: "key_customer", Name: "ak_live_customer", Project: "customer-service-agent", Scope: "llm:chat skill:invoke", ExpiresAt: "2026-09-01", Status: "Active"},
			{ID: "key_knowledge", Name: "ak_live_knowledge", Project: "knowledge-rag", Scope: "llm:embedding skill:read", ExpiresAt: "2026-08-15", Status: "Active"},
		},
		credentials: []Credential{
			{ID: "cred_openai", Ref: "cred.openai.default", Purpose: "LLM provider", Scope: "Gateway / Model", ExpiresAt: "2026-07-01", Status: "Active", MaskedPreview: "sk-****-4f2a"},
			{ID: "cred_claude", Ref: "cred.claude.backup", Purpose: "LLM fallback", Scope: "Gateway / Model", ExpiresAt: "2026-06-28", Status: "Expiring", MaskedPreview: "sk-****-91cb"},
		},
		routes: []GatewayRoute{
			{ID: "route_llm", Route: "/api/v1/llm/**", Upstream: "gateway-api", Auth: "API Key", Limit: "1200/min", Status: "Active", UpdatedAt: now},
			{ID: "route_skill", Route: "/api/v1/skills/**", Upstream: "gateway-api", Auth: "API Key", Limit: "800/min", Status: "Active", UpdatedAt: now},
		},
		modelRoutes: []ModelRoute{
			{ID: "model_chat_default", Alias: "chat-default", Scenario: "客服 Agent", Primary: "gpt-4.1-mini", Fallback: "claude-haiku", Status: "Active", UpdatedAt: now},
			{ID: "model_embedding_default", Alias: "embedding-default", Scenario: "RAG", Primary: "text-embedding-3", Fallback: "local-bge", Status: "Active", UpdatedAt: now},
		},
		skills: []SkillBinding{
			{ID: "skill_search", Name: "search-knowledge", Protocol: "MCP", Route: "/api/v1/skills/search", Timeout: "8s", Status: "Published", UpdatedAt: now},
			{ID: "skill_message", Name: "send-message", Protocol: "HTTP", Route: "/api/v1/skills/send-message", Timeout: "8s", Status: "Draft", UpdatedAt: now},
		},
		requestLogs: []RequestLog{
			{ID: "req_chat", Request: "POST /llm/chat", Consumer: "customer-service-agent", Latency: "76ms", Result: "200", Status: "Success", CreatedAt: now},
			{ID: "req_skill", Request: "POST /skills/search", Consumer: "knowledge-rag", Latency: "118ms", Result: "200", Status: "Success", CreatedAt: now},
		},
		plans: []BillingPlan{
			{ID: "plan_free", Name: "Free", Target: "trial users", RPS: "20", TokenPerDay: "50K", Status: "Active"},
			{ID: "plan_business", Name: "Business", Target: "production agents", RPS: "1200", TokenPerDay: "10M", Status: "Active"},
		},
		usageRecords: []UsageRecord{
			{ID: "usage_customer", Project: "customer-service-agent", Tokens: "2.4M", SkillCalls: "18.2K", Cost: "$241", Status: "Normal", UpdatedAt: now},
			{ID: "usage_aigc", Project: "aigc-lab", Tokens: "3.1M", SkillCalls: "4.8K", Cost: "$312", Status: "Warning", UpdatedAt: now},
		},
		budgetAlerts: []BudgetAlert{
			{ID: "budget_aigc", Project: "aigc-lab", Budget: "$360/day", Current: "$312", Threshold: "85%", Status: "Warning"},
			{ID: "budget_customer", Project: "customer-service-agent", Budget: "$400/day", Current: "$241", Threshold: "70%", Status: "Normal"},
		},
		todos: []OpsTodo{
			{ID: "todo_fallback", Title: "模型 fallback 率升高", Source: "网关与模型", Owner: "运维人员", Status: "Watching", UpdatedAt: now},
			{ID: "todo_budget", Title: "aigc-lab 预算接近阈值", Source: "计费与配额", Owner: "管理员", Status: "Warning", UpdatedAt: now},
			{ID: "todo_key", Title: "新项目 API Key 待审批", Source: "用户与权限", Owner: "管理员", Status: "Pending", UpdatedAt: now},
		},
		health: []ServiceHealth{
			{ID: "health_gateway", Name: "gateway-api", SLO: "99.97%", P95: "82ms", Status: "Normal"},
			{ID: "health_model", Name: "model routing", SLO: "99.21%", P95: "245ms", Status: "Degraded"},
			{ID: "health_billing", Name: "billing-service", SLO: "99.99%", P95: "1.4s lag", Status: "Normal"},
		},
		audit: []AuditEvent{
			{ID: "audit_role", Time: now, Module: "用户与权限", Action: "role granted", Object: "dev-api@anjing.ai", Status: "Success", RequestID: "req_seed_1"},
			{ID: "audit_skill", Time: now, Module: "网关与模型", Action: "skill published", Object: "search-knowledge v1.4.0", Status: "Success", RequestID: "req_seed_2"},
		},
	}
}

func (s *Store) ListUsers() []User {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]User(nil), s.users...)
}

func (s *Store) CreateUser(email, org, role string) User {
	s.mu.Lock()
	defer s.mu.Unlock()
	user := User{ID: nextID("usr"), Email: email, Org: org, Role: role, MFA: "Pending", Status: "Invited", CreatedAt: nowLabel()}
	s.users = append([]User{user}, s.users...)
	s.addAuditLocked("用户与权限", "invite user", email, "Success")
	s.todos = append([]OpsTodo{{ID: nextID("todo"), Title: email + " 完成首次登录", Source: "用户与权限", Owner: role, Status: "Pending", UpdatedAt: nowLabel()}}, s.todos...)
	return user
}

func (s *Store) ListApplications() []Application {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]Application(nil), s.applications...)
}

func (s *Store) CreateApplication(name, owner, environment, defaultRoute, plan string) Application {
	s.mu.Lock()
	defer s.mu.Unlock()
	if environment == "" {
		environment = "Sandbox"
	}
	if defaultRoute == "" {
		defaultRoute = "/api/v1/llm/**"
	}
	if plan == "" {
		plan = "Free"
	}
	now := nowLabel()
	apiKey := "ak_live_" + slugKey(name)
	app := Application{
		ID:           nextID("app"),
		Name:         name,
		Owner:        owner,
		Environment:  environment,
		APIKey:       apiKey,
		DefaultRoute: defaultRoute,
		Plan:         plan,
		Status:       "Provisioning",
		CreatedAt:    now,
	}
	s.applications = append([]Application{app}, s.applications...)
	s.apiKeys = append([]APIKey{{
		ID:        nextID("key"),
		Name:      apiKey,
		Project:   name,
		Scope:     "llm:chat skill:invoke",
		ExpiresAt: "",
		Status:    "Provisioning",
	}}, s.apiKeys...)
	s.todos = append([]OpsTodo{{
		ID:        nextID("todo"),
		Title:     name + " 完成接入校验",
		Source:    "帮助文档",
		Owner:     owner,
		Status:    "Pending",
		UpdatedAt: now,
	}}, s.todos...)
	s.addAuditLocked("帮助文档", "create application", name, "Success")
	return app
}

func (s *Store) ActivateApplication(id string) (Application, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for index := range s.applications {
		if s.applications[index].ID != id {
			continue
		}

		s.applications[index].Status = "Active"
		s.addAuditLocked("帮助文档", "activate application", s.applications[index].Name, "Success")
		for keyIndex := range s.apiKeys {
			if s.apiKeys[keyIndex].Project == s.applications[index].Name ||
				s.apiKeys[keyIndex].Name == s.applications[index].APIKey {
				s.apiKeys[keyIndex].Status = "Active"
			}
		}
		s.requestLogs = append([]RequestLog{{
			ID:        nextID("req"),
			Request:   "POST " + s.applications[index].DefaultRoute,
			Consumer:  s.applications[index].Name,
			Latency:   "64ms",
			Result:    "200",
			Status:    "Success",
			CreatedAt: nowLabel(),
		}}, s.requestLogs...)
		return s.applications[index], true
	}
	return Application{}, false
}

func (s *Store) ListRoles() []RolePolicy {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]RolePolicy(nil), s.roles...)
}

func (s *Store) ListAPIKeys() []APIKey {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]APIKey(nil), s.apiKeys...)
}

func (s *Store) ListCredentials() []Credential {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]Credential(nil), s.credentials...)
}

func (s *Store) ListRoutes() []GatewayRoute {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]GatewayRoute(nil), s.routes...)
}

func (s *Store) CreateRoute(route, upstream, limit string) GatewayRoute {
	s.mu.Lock()
	defer s.mu.Unlock()
	item := GatewayRoute{ID: nextID("route"), Route: route, Upstream: upstream, Auth: "API Key", Limit: limit, Status: "Draft", UpdatedAt: nowLabel()}
	s.routes = append([]GatewayRoute{item}, s.routes...)
	s.requestLogs = append([]RequestLog{{
		ID: nextID("req"), Request: "POST " + route, Consumer: "demo-agent-workbench", Latency: "64ms", Result: "201", Status: "Mocked", CreatedAt: nowLabel(),
	}}, s.requestLogs...)
	s.addAuditLocked("网关与模型", "create route", route, "Success")
	return item
}

func (s *Store) ListModelRoutes() []ModelRoute {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]ModelRoute(nil), s.modelRoutes...)
}

func (s *Store) ListSkills() []SkillBinding {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]SkillBinding(nil), s.skills...)
}

func (s *Store) ListRequestLogs() []RequestLog {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]RequestLog(nil), s.requestLogs...)
}

func (s *Store) ListPlans() []BillingPlan {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]BillingPlan(nil), s.plans...)
}

func (s *Store) CreatePlan(name, rps, tokenPerDay string) BillingPlan {
	s.mu.Lock()
	defer s.mu.Unlock()
	plan := BillingPlan{ID: nextID("plan"), Name: name, Target: "new projects", RPS: rps, TokenPerDay: tokenPerDay, Status: "Draft"}
	s.plans = append([]BillingPlan{plan}, s.plans...)
	s.budgetAlerts = append([]BudgetAlert{{ID: nextID("budget"), Project: name, Budget: "$300/day", Current: "$0", Threshold: "70%", Status: "Ready"}}, s.budgetAlerts...)
	s.addAuditLocked("计费与配额", "create plan", name, "Success")
	return plan
}

func (s *Store) ListUsage() []UsageRecord {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]UsageRecord(nil), s.usageRecords...)
}

func (s *Store) ListBudgetAlerts() []BudgetAlert {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]BudgetAlert(nil), s.budgetAlerts...)
}

func (s *Store) Dashboard() OpsDashboard {
	s.mu.RLock()
	defer s.mu.RUnlock()
	pending := 0
	for _, todo := range s.todos {
		if todo.Status != "Resolved" {
			pending++
		}
	}
	return OpsDashboard{
		Metrics: []Metric{
			{Label: "今日调用", Value: "128.4K", Note: "API / Model / Skill"},
			{Label: "成功率", Value: "99.21%", Note: "近 24 小时"},
			{Label: "待处理", Value: fmt.Sprintf("%d", pending), Note: "告警 / 审批 / 预算"},
			{Label: "V1 服务", Value: "4 Go cmds", Note: "DVSkyFolding"},
		},
		Todos:  append([]OpsTodo(nil), s.todos...),
		Health: append([]ServiceHealth(nil), s.health...),
		Audit:  append([]AuditEvent(nil), s.audit...),
	}
}

func (s *Store) ListTodos() []OpsTodo {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]OpsTodo(nil), s.todos...)
}

func (s *Store) ResolveTodo(id string) (OpsTodo, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for index := range s.todos {
		if s.todos[index].ID == id {
			s.todos[index].Status = "Resolved"
			s.todos[index].UpdatedAt = nowLabel()
			s.addAuditLocked("运营总览", "resolve todo", s.todos[index].Title, "Success")
			return s.todos[index], true
		}
	}
	return OpsTodo{}, false
}

func (s *Store) ListHealth() []ServiceHealth {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]ServiceHealth(nil), s.health...)
}

func (s *Store) ListAudit() []AuditEvent {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]AuditEvent(nil), s.audit...)
}

func (s *Store) addAuditLocked(module, action, object, status string) {
	s.audit = append([]AuditEvent{{
		ID:        nextID("audit"),
		Time:      nowLabel(),
		Module:    module,
		Action:    action,
		Object:    object,
		Status:    status,
		RequestID: nextID("req"),
	}}, s.audit...)
}

func nowLabel() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func nextID(prefix string) string {
	return fmt.Sprintf("%s_%d", prefix, time.Now().UnixNano())
}

func slugKey(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	var builder strings.Builder
	lastUnderscore := false
	for _, char := range value {
		isWord := char >= 'a' && char <= 'z' || char >= '0' && char <= '9'
		if isWord {
			builder.WriteRune(char)
			lastUnderscore = false
			continue
		}
		if !lastUnderscore {
			builder.WriteByte('_')
			lastUnderscore = true
		}
	}
	slug := strings.Trim(builder.String(), "_")
	if slug == "" {
		return "app"
	}
	return slug
}
