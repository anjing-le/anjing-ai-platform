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

func scanBillingPlan(row pgx.CollectableRow) (store.BillingPlan, error) {
	var item store.BillingPlan
	if err := row.Scan(&item.ID, &item.Name, &item.Target, &item.RPS, &item.TokenPerDay, &item.Status); err != nil {
		return store.BillingPlan{}, err
	}
	return item, nil
}
