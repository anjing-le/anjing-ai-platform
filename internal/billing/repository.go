package billing

import (
	"context"
	"fmt"
	"time"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type CreatePlanInput struct {
	Name        string
	RPS         string
	TokenPerDay string
}

type PlanRepository interface {
	ListPlans(ctx context.Context) ([]store.BillingPlan, error)
	CreatePlan(ctx context.Context, input CreatePlanInput) (store.BillingPlan, error)
	ActivatePlan(ctx context.Context, id string) (store.BillingPlan, bool, error)
}

type UsageRepository interface {
	ListUsage(ctx context.Context) ([]store.UsageRecord, error)
}

type BudgetAlertRepository interface {
	ListBudgetAlerts(ctx context.Context) ([]store.BudgetAlert, error)
}

type Repositories struct {
	Plans        PlanRepository
	Usage        UsageRepository
	BudgetAlerts BudgetAlertRepository
}

func NewMemoryRepositories(st *store.Store) Repositories {
	return Repositories{
		Plans:        NewMemoryPlanRepository(st),
		Usage:        NewMemoryUsageRepository(st),
		BudgetAlerts: NewMemoryBudgetAlertRepository(st),
	}
}

type MemoryPlanRepository struct {
	store *store.Store
}

func NewMemoryPlanRepository(st *store.Store) MemoryPlanRepository {
	return MemoryPlanRepository{store: st}
}

func (repo MemoryPlanRepository) ListPlans(context.Context) ([]store.BillingPlan, error) {
	return repo.store.ListPlans(), nil
}

func (repo MemoryPlanRepository) CreatePlan(_ context.Context, input CreatePlanInput) (store.BillingPlan, error) {
	return repo.store.CreatePlan(input.Name, input.RPS, input.TokenPerDay), nil
}

func (repo MemoryPlanRepository) ActivatePlan(_ context.Context, id string) (store.BillingPlan, bool, error) {
	plan, ok := repo.store.ActivatePlan(id)
	return plan, ok, nil
}

type MemoryUsageRepository struct {
	store *store.Store
}

func NewMemoryUsageRepository(st *store.Store) MemoryUsageRepository {
	return MemoryUsageRepository{store: st}
}

func (repo MemoryUsageRepository) ListUsage(context.Context) ([]store.UsageRecord, error) {
	return repo.store.ListUsage(), nil
}

type MemoryBudgetAlertRepository struct {
	store *store.Store
}

func NewMemoryBudgetAlertRepository(st *store.Store) MemoryBudgetAlertRepository {
	return MemoryBudgetAlertRepository{store: st}
}

func (repo MemoryBudgetAlertRepository) ListBudgetAlerts(context.Context) ([]store.BudgetAlert, error) {
	return repo.store.ListBudgetAlerts(), nil
}

type PostgresPlanRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresPlanRepository(pool *pgxpool.Pool) PostgresPlanRepository {
	return PostgresPlanRepository{pool: pool}
}

func (repo PostgresPlanRepository) ListPlans(ctx context.Context) ([]store.BillingPlan, error) {
	rows, err := repo.pool.Query(ctx, `
		select id, name, target, rps, token_per_day, status
		from billing_plans
		order by name asc
	`)
	if err != nil {
		return nil, fmt.Errorf("query billing plans: %w", err)
	}
	defer rows.Close()

	items, err := pgx.CollectRows(rows, scanBillingPlan)
	if err != nil {
		return nil, fmt.Errorf("collect billing plans: %w", err)
	}

	return items, nil
}

func (repo PostgresPlanRepository) CreatePlan(ctx context.Context, input CreatePlanInput) (store.BillingPlan, error) {
	item := store.BillingPlan{
		ID:          fmt.Sprintf("plan_%d", time.Now().UnixNano()),
		Name:        input.Name,
		Target:      "new projects",
		RPS:         input.RPS,
		TokenPerDay: input.TokenPerDay,
		Status:      "Draft",
	}

	if _, err := repo.pool.Exec(ctx, `
		insert into billing_plans(id, name, target, rps, token_per_day, status)
		values($1, $2, $3, $4, $5, $6)
	`, item.ID, item.Name, item.Target, item.RPS, item.TokenPerDay, item.Status); err != nil {
		return store.BillingPlan{}, fmt.Errorf("insert billing plan: %w", err)
	}

	return item, nil
}

func (repo PostgresPlanRepository) ActivatePlan(ctx context.Context, id string) (store.BillingPlan, bool, error) {
	rows, err := repo.pool.Query(ctx, `
		update billing_plans
		set status = 'Active'
		where id = $1
		returning id, name, target, rps, token_per_day, status
	`, id)
	if err != nil {
		return store.BillingPlan{}, false, fmt.Errorf("activate billing plan: %w", err)
	}
	defer rows.Close()

	plan, err := pgx.CollectOneRow(rows, scanBillingPlan)
	if err != nil {
		if err == pgx.ErrNoRows {
			return store.BillingPlan{}, false, nil
		}
		return store.BillingPlan{}, false, fmt.Errorf("collect activated billing plan: %w", err)
	}

	return plan, true, nil
}

type PostgresUsageRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresUsageRepository(pool *pgxpool.Pool) PostgresUsageRepository {
	return PostgresUsageRepository{pool: pool}
}

func (repo PostgresUsageRepository) ListUsage(ctx context.Context) ([]store.UsageRecord, error) {
	rows, err := repo.pool.Query(ctx, `
		select id, project, tokens, skill_calls, cost, status, updated_at
		from usage_records
		order by updated_at desc
	`)
	if err != nil {
		return nil, fmt.Errorf("query usage records: %w", err)
	}
	defer rows.Close()

	items, err := pgx.CollectRows(rows, scanUsageRecord)
	if err != nil {
		return nil, fmt.Errorf("collect usage records: %w", err)
	}

	return items, nil
}

func scanUsageRecord(row pgx.CollectableRow) (store.UsageRecord, error) {
	var item store.UsageRecord
	var updatedAt time.Time
	if err := row.Scan(&item.ID, &item.Project, &item.Tokens, &item.SkillCalls, &item.Cost, &item.Status, &updatedAt); err != nil {
		return store.UsageRecord{}, err
	}
	item.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return item, nil
}

type PostgresBudgetAlertRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresBudgetAlertRepository(pool *pgxpool.Pool) PostgresBudgetAlertRepository {
	return PostgresBudgetAlertRepository{pool: pool}
}

func (repo PostgresBudgetAlertRepository) ListBudgetAlerts(ctx context.Context) ([]store.BudgetAlert, error) {
	rows, err := repo.pool.Query(ctx, `
		select id, project, budget, current, threshold, status
		from budget_alerts
		order by project asc
	`)
	if err != nil {
		return nil, fmt.Errorf("query budget alerts: %w", err)
	}
	defer rows.Close()

	items, err := pgx.CollectRows(rows, scanBudgetAlert)
	if err != nil {
		return nil, fmt.Errorf("collect budget alerts: %w", err)
	}

	return items, nil
}

func scanBudgetAlert(row pgx.CollectableRow) (store.BudgetAlert, error) {
	var item store.BudgetAlert
	if err := row.Scan(&item.ID, &item.Project, &item.Budget, &item.Current, &item.Threshold, &item.Status); err != nil {
		return store.BudgetAlert{}, err
	}
	return item, nil
}

func scanBillingPlan(row pgx.CollectableRow) (store.BillingPlan, error) {
	var item store.BillingPlan
	if err := row.Scan(&item.ID, &item.Name, &item.Target, &item.RPS, &item.TokenPerDay, &item.Status); err != nil {
		return store.BillingPlan{}, err
	}
	return item, nil
}
