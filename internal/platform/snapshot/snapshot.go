package snapshot

import (
	"context"
	"fmt"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
)

type UserRepository interface {
	ListUsers(ctx context.Context) ([]store.User, error)
}

type ApplicationRepository interface {
	ListApplications(ctx context.Context) ([]store.Application, error)
}

type RoleRepository interface {
	ListRoles(ctx context.Context) ([]store.RolePolicy, error)
}

type APIKeyRepository interface {
	ListAPIKeys(ctx context.Context) ([]store.APIKey, error)
}

type CredentialRepository interface {
	ListCredentials(ctx context.Context) ([]store.Credential, error)
}

type RouteRepository interface {
	ListRoutes(ctx context.Context) ([]store.GatewayRoute, error)
}

type ModelRouteRepository interface {
	ListModelRoutes(ctx context.Context) ([]store.ModelRoute, error)
}

type SkillRepository interface {
	ListSkills(ctx context.Context) ([]store.SkillBinding, error)
}

type RequestLogRepository interface {
	ListRequestLogs(ctx context.Context) ([]store.RequestLog, error)
}

type PlanRepository interface {
	ListPlans(ctx context.Context) ([]store.BillingPlan, error)
}

type UsageRepository interface {
	ListUsage(ctx context.Context) ([]store.UsageRecord, error)
}

type BudgetAlertRepository interface {
	ListBudgetAlerts(ctx context.Context) ([]store.BudgetAlert, error)
}

type TodoRepository interface {
	ListTodos(ctx context.Context) ([]store.OpsTodo, error)
}

type HealthRepository interface {
	ListHealth(ctx context.Context) ([]store.ServiceHealth, error)
}

type AuditRepository interface {
	ListAudit(ctx context.Context) ([]store.AuditEvent, error)
}

type Sources struct {
	Users        UserRepository
	Applications ApplicationRepository
	Roles        RoleRepository
	APIKeys      APIKeyRepository
	Credentials  CredentialRepository
	Routes       RouteRepository
	ModelRoutes  ModelRouteRepository
	Skills       SkillRepository
	RequestLogs  RequestLogRepository
	Plans        PlanRepository
	Usage        UsageRepository
	BudgetAlerts BudgetAlertRepository
	Todos        TodoRepository
	Health       HealthRepository
	Audit        AuditRepository
}

type Repository struct {
	sources Sources
}

func NewRepository(sources Sources) Repository {
	return Repository{sources: sources}
}

func (repo Repository) LoadSnapshot(ctx context.Context) (store.PlatformSnapshot, error) {
	if missing := missingSource(repo.sources); missing != "" {
		return store.PlatformSnapshot{}, fmt.Errorf("snapshot source %s is required", missing)
	}

	var item store.PlatformSnapshot
	var err error

	item.Users, err = repo.sources.Users.ListUsers(ctx)
	if err != nil {
		return store.PlatformSnapshot{}, fmt.Errorf("list users: %w", err)
	}
	item.Applications, err = repo.sources.Applications.ListApplications(ctx)
	if err != nil {
		return store.PlatformSnapshot{}, fmt.Errorf("list applications: %w", err)
	}
	item.Roles, err = repo.sources.Roles.ListRoles(ctx)
	if err != nil {
		return store.PlatformSnapshot{}, fmt.Errorf("list roles: %w", err)
	}
	item.APIKeys, err = repo.sources.APIKeys.ListAPIKeys(ctx)
	if err != nil {
		return store.PlatformSnapshot{}, fmt.Errorf("list api keys: %w", err)
	}
	item.Credentials, err = repo.sources.Credentials.ListCredentials(ctx)
	if err != nil {
		return store.PlatformSnapshot{}, fmt.Errorf("list credentials: %w", err)
	}
	item.Routes, err = repo.sources.Routes.ListRoutes(ctx)
	if err != nil {
		return store.PlatformSnapshot{}, fmt.Errorf("list routes: %w", err)
	}
	item.ModelRoutes, err = repo.sources.ModelRoutes.ListModelRoutes(ctx)
	if err != nil {
		return store.PlatformSnapshot{}, fmt.Errorf("list model routes: %w", err)
	}
	item.Skills, err = repo.sources.Skills.ListSkills(ctx)
	if err != nil {
		return store.PlatformSnapshot{}, fmt.Errorf("list skills: %w", err)
	}
	item.RequestLogs, err = repo.sources.RequestLogs.ListRequestLogs(ctx)
	if err != nil {
		return store.PlatformSnapshot{}, fmt.Errorf("list request logs: %w", err)
	}
	item.Plans, err = repo.sources.Plans.ListPlans(ctx)
	if err != nil {
		return store.PlatformSnapshot{}, fmt.Errorf("list plans: %w", err)
	}
	item.Usage, err = repo.sources.Usage.ListUsage(ctx)
	if err != nil {
		return store.PlatformSnapshot{}, fmt.Errorf("list usage: %w", err)
	}
	item.BudgetAlerts, err = repo.sources.BudgetAlerts.ListBudgetAlerts(ctx)
	if err != nil {
		return store.PlatformSnapshot{}, fmt.Errorf("list budget alerts: %w", err)
	}

	todos, err := repo.sources.Todos.ListTodos(ctx)
	if err != nil {
		return store.PlatformSnapshot{}, fmt.Errorf("list todos: %w", err)
	}
	health, err := repo.sources.Health.ListHealth(ctx)
	if err != nil {
		return store.PlatformSnapshot{}, fmt.Errorf("list health: %w", err)
	}
	audit, err := repo.sources.Audit.ListAudit(ctx)
	if err != nil {
		return store.PlatformSnapshot{}, fmt.Errorf("list audit: %w", err)
	}

	item.Dashboard = dashboardFromOps(todos, health, audit)
	return item, nil
}

func missingSource(sources Sources) string {
	switch {
	case sources.Users == nil:
		return "users"
	case sources.Applications == nil:
		return "applications"
	case sources.Roles == nil:
		return "roles"
	case sources.APIKeys == nil:
		return "apiKeys"
	case sources.Credentials == nil:
		return "credentials"
	case sources.Routes == nil:
		return "routes"
	case sources.ModelRoutes == nil:
		return "modelRoutes"
	case sources.Skills == nil:
		return "skills"
	case sources.RequestLogs == nil:
		return "requestLogs"
	case sources.Plans == nil:
		return "plans"
	case sources.Usage == nil:
		return "usage"
	case sources.BudgetAlerts == nil:
		return "budgetAlerts"
	case sources.Todos == nil:
		return "todos"
	case sources.Health == nil:
		return "health"
	case sources.Audit == nil:
		return "audit"
	default:
		return ""
	}
}

func dashboardFromOps(todos []store.OpsTodo, health []store.ServiceHealth, audit []store.AuditEvent) store.OpsDashboard {
	pending := 0
	for _, todo := range todos {
		if todo.Status != "Resolved" {
			pending++
		}
	}

	return store.OpsDashboard{
		Metrics: []store.Metric{
			{Label: "今日调用", Value: "128.4K", Note: "API / Model / Skill"},
			{Label: "成功率", Value: "99.21%", Note: "近 24 小时"},
			{Label: "待处理", Value: fmt.Sprintf("%d", pending), Note: "告警 / 审批 / 预算"},
			{Label: "V1 服务", Value: "4 Go cmds", Note: "DVSkyFolding"},
		},
		Todos:  todos,
		Health: health,
		Audit:  audit,
	}
}
