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

type RecordUsageEventInput struct {
	EventID    string
	Project    string
	Tokens     string
	SkillCalls string
	Cost       string
	Status     string
}

type PlanRepository interface {
	ListPlans(ctx context.Context) ([]store.BillingPlan, error)
	CreatePlan(ctx context.Context, input CreatePlanInput) (store.BillingPlan, error)
	ActivatePlan(ctx context.Context, id string) (store.BillingPlan, bool, error)
}

type UsageRepository interface {
	ListUsage(ctx context.Context) ([]store.UsageRecord, error)
	RecordUsageEvent(ctx context.Context, input RecordUsageEventInput) (store.UsageRecord, bool, error)
}

type BudgetAlertRepository interface {
	ListBudgetAlerts(ctx context.Context) ([]store.BudgetAlert, error)
	ResolveBudgetAlert(ctx context.Context, id string) (store.BudgetAlert, bool, error)
}

type InvoiceRepository interface {
	ListInvoiceSummaries(ctx context.Context) ([]store.BillingInvoiceSummary, error)
}

type Repositories struct {
	Plans        PlanRepository
	Usage        UsageRepository
	BudgetAlerts BudgetAlertRepository
	Invoices     InvoiceRepository
}

func NewMemoryRepositories(st *store.Store) Repositories {
	return Repositories{
		Plans:        NewMemoryPlanRepository(st),
		Usage:        NewMemoryUsageRepository(st),
		BudgetAlerts: NewMemoryBudgetAlertRepository(st),
		Invoices:     NewMemoryInvoiceRepository(st),
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

func (repo MemoryUsageRepository) RecordUsageEvent(_ context.Context, input RecordUsageEventInput) (store.UsageRecord, bool, error) {
	input = normalizeUsageEventInput(input)
	item, created := repo.store.RecordUsageEvent(input.EventID, input.Project, input.Tokens, input.SkillCalls, input.Cost, input.Status)
	return item, created, nil
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

func (repo MemoryBudgetAlertRepository) ResolveBudgetAlert(_ context.Context, id string) (store.BudgetAlert, bool, error) {
	alert, ok := repo.store.ResolveBudgetAlert(id)
	return alert, ok, nil
}

type MemoryInvoiceRepository struct {
	store *store.Store
}

func NewMemoryInvoiceRepository(st *store.Store) MemoryInvoiceRepository {
	return MemoryInvoiceRepository{store: st}
}

func (repo MemoryInvoiceRepository) ListInvoiceSummaries(context.Context) ([]store.BillingInvoiceSummary, error) {
	return repo.store.ListBillingSummaries(), nil
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
		ID:          nextID("plan"),
		Name:        input.Name,
		Target:      "new projects",
		RPS:         input.RPS,
		TokenPerDay: input.TokenPerDay,
		Status:      "Draft",
	}

	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return store.BillingPlan{}, fmt.Errorf("begin create billing plan: %w", err)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `
		insert into billing_plans(id, name, target, rps, token_per_day, status)
		values($1, $2, $3, $4, $5, $6)
	`, item.ID, item.Name, item.Target, item.RPS, item.TokenPerDay, item.Status); err != nil {
		return store.BillingPlan{}, fmt.Errorf("insert billing plan: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		insert into budget_alerts(id, project, budget, current, threshold, status)
		values($1, $2, $3, $4, $5, $6)
	`, nextID("budget"), item.Name, "$300/day", "$0", "70%", "Ready"); err != nil {
		return store.BillingPlan{}, fmt.Errorf("insert billing plan budget alert: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		insert into audit_events(id, module, action, object, status, request_id)
		values($1, $2, $3, $4, $5, $6)
	`, nextID("audit"), "计费与配额", "create plan", item.Name, "Success", nextID("req")); err != nil {
		return store.BillingPlan{}, fmt.Errorf("insert billing plan create audit: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return store.BillingPlan{}, fmt.Errorf("commit create billing plan: %w", err)
	}

	return item, nil
}

func (repo PostgresPlanRepository) ActivatePlan(ctx context.Context, id string) (store.BillingPlan, bool, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return store.BillingPlan{}, false, fmt.Errorf("begin activate billing plan: %w", err)
	}
	defer tx.Rollback(ctx)

	rows, err := tx.Query(ctx, `
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
	rows.Close()

	if _, err := tx.Exec(ctx, `
		insert into audit_events(id, module, action, object, status, request_id)
		values($1, $2, $3, $4, $5, $6)
	`, nextID("audit"), "计费与配额", "activate plan", plan.Name, "Success", nextID("req")); err != nil {
		return store.BillingPlan{}, false, fmt.Errorf("insert billing plan activation audit: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return store.BillingPlan{}, false, fmt.Errorf("commit activate billing plan: %w", err)
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

func (repo PostgresUsageRepository) RecordUsageEvent(ctx context.Context, input RecordUsageEventInput) (store.UsageRecord, bool, error) {
	input = normalizeUsageEventInput(input)

	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return store.UsageRecord{}, false, fmt.Errorf("begin record usage event: %w", err)
	}
	defer tx.Rollback(ctx)

	rows, err := tx.Query(ctx, `
		insert into usage_records(id, project, tokens, skill_calls, cost, status)
		values($1, $2, $3, $4, $5, $6)
		on conflict (id) do nothing
		returning id, project, tokens, skill_calls, cost, status, updated_at
	`, input.EventID, input.Project, input.Tokens, input.SkillCalls, input.Cost, input.Status)
	if err != nil {
		return store.UsageRecord{}, false, fmt.Errorf("insert usage event: %w", err)
	}

	item, err := pgx.CollectOneRow(rows, scanUsageRecord)
	rows.Close()
	if err != nil {
		if err == pgx.ErrNoRows {
			existingRows, queryErr := tx.Query(ctx, `
				select id, project, tokens, skill_calls, cost, status, updated_at
				from usage_records
				where id = $1
			`, input.EventID)
			if queryErr != nil {
				return store.UsageRecord{}, false, fmt.Errorf("query existing usage event: %w", queryErr)
			}
			defer existingRows.Close()

			item, queryErr = pgx.CollectOneRow(existingRows, scanUsageRecord)
			if queryErr != nil {
				return store.UsageRecord{}, false, fmt.Errorf("collect existing usage event: %w", queryErr)
			}
			if commitErr := tx.Commit(ctx); commitErr != nil {
				return store.UsageRecord{}, false, fmt.Errorf("commit existing usage event lookup: %w", commitErr)
			}
			return item, false, nil
		}
		return store.UsageRecord{}, false, fmt.Errorf("collect inserted usage event: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		insert into audit_events(id, module, action, object, status, request_id)
		values($1, $2, $3, $4, $5, $6)
	`, nextID("audit"), "计费与配额", "record usage event", item.Project, "Success", nextID("req")); err != nil {
		return store.UsageRecord{}, false, fmt.Errorf("insert usage event audit: %w", err)
	}

	if err := repo.reconcileBudgetAlerts(ctx, tx, item.Project); err != nil {
		return store.UsageRecord{}, false, err
	}

	if err := tx.Commit(ctx); err != nil {
		return store.UsageRecord{}, false, fmt.Errorf("commit usage event: %w", err)
	}

	return item, true, nil
}

func (repo PostgresUsageRepository) reconcileBudgetAlerts(ctx context.Context, tx pgx.Tx, project string) error {
	usageRows, err := tx.Query(ctx, `
		select id, project, tokens, skill_calls, cost, status, updated_at
		from usage_records
		where project = $1
		order by updated_at desc
	`, project)
	if err != nil {
		return fmt.Errorf("query usage records for budget reconciliation: %w", err)
	}
	defer usageRows.Close()

	usage, err := pgx.CollectRows(usageRows, scanUsageRecord)
	if err != nil {
		return fmt.Errorf("collect usage records for budget reconciliation: %w", err)
	}

	alertRows, err := tx.Query(ctx, `
		select id, project, budget, current, threshold, status
		from budget_alerts
		where project = $1
	`, project)
	if err != nil {
		return fmt.Errorf("query budget alerts for reconciliation: %w", err)
	}
	defer alertRows.Close()

	alerts, err := pgx.CollectRows(alertRows, scanBudgetAlert)
	if err != nil {
		return fmt.Errorf("collect budget alerts for reconciliation: %w", err)
	}

	for _, alert := range alerts {
		reconciled := store.ReconcileBudgetAlertFromUsage(alert, usage)
		if _, err := tx.Exec(ctx, `
			update budget_alerts
			set current = $1, status = $2
			where id = $3
		`, reconciled.Current, reconciled.Status, reconciled.ID); err != nil {
			return fmt.Errorf("update budget alert after usage event: %w", err)
		}
	}

	return nil
}

func normalizeUsageEventInput(input RecordUsageEventInput) RecordUsageEventInput {
	if input.Tokens == "" {
		input.Tokens = "0"
	}
	if input.SkillCalls == "" {
		input.SkillCalls = "0"
	}
	if input.Cost == "" {
		input.Cost = "$0.0000"
	}
	if input.Status == "" {
		input.Status = "Normal"
	}
	return input
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

func (repo PostgresBudgetAlertRepository) ResolveBudgetAlert(ctx context.Context, id string) (store.BudgetAlert, bool, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return store.BudgetAlert{}, false, fmt.Errorf("begin resolve budget alert: %w", err)
	}
	defer tx.Rollback(ctx)

	rows, err := tx.Query(ctx, `
		update budget_alerts
		set status = 'Resolved'
		where id = $1
		returning id, project, budget, current, threshold, status
	`, id)
	if err != nil {
		return store.BudgetAlert{}, false, fmt.Errorf("resolve budget alert: %w", err)
	}
	defer rows.Close()

	alert, err := pgx.CollectOneRow(rows, scanBudgetAlert)
	if err != nil {
		if err == pgx.ErrNoRows {
			return store.BudgetAlert{}, false, nil
		}
		return store.BudgetAlert{}, false, fmt.Errorf("collect resolved budget alert: %w", err)
	}
	rows.Close()

	if _, err := tx.Exec(ctx, `
		insert into audit_events(id, module, action, object, status, request_id)
		values($1, $2, $3, $4, $5, $6)
	`, nextID("audit"), "计费与配额", "resolve budget alert", alert.Project, "Success", nextID("req")); err != nil {
		return store.BudgetAlert{}, false, fmt.Errorf("insert budget alert resolution audit: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return store.BudgetAlert{}, false, fmt.Errorf("commit resolve budget alert: %w", err)
	}

	return alert, true, nil
}

func scanBudgetAlert(row pgx.CollectableRow) (store.BudgetAlert, error) {
	var item store.BudgetAlert
	if err := row.Scan(&item.ID, &item.Project, &item.Budget, &item.Current, &item.Threshold, &item.Status); err != nil {
		return store.BudgetAlert{}, err
	}
	return item, nil
}

type PostgresInvoiceRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresInvoiceRepository(pool *pgxpool.Pool) PostgresInvoiceRepository {
	return PostgresInvoiceRepository{pool: pool}
}

func (repo PostgresInvoiceRepository) ListInvoiceSummaries(ctx context.Context) ([]store.BillingInvoiceSummary, error) {
	usage, err := (PostgresUsageRepository{pool: repo.pool}).ListUsage(ctx)
	if err != nil {
		return nil, fmt.Errorf("list invoice usage records: %w", err)
	}
	alerts, err := (PostgresBudgetAlertRepository{pool: repo.pool}).ListBudgetAlerts(ctx)
	if err != nil {
		return nil, fmt.Errorf("list invoice budget alerts: %w", err)
	}
	return store.BuildBillingInvoiceSummaries(usage, alerts), nil
}

func scanBillingPlan(row pgx.CollectableRow) (store.BillingPlan, error) {
	var item store.BillingPlan
	if err := row.Scan(&item.ID, &item.Name, &item.Target, &item.RPS, &item.TokenPerDay, &item.Status); err != nil {
		return store.BillingPlan{}, err
	}
	return item, nil
}

func nextID(prefix string) string {
	return fmt.Sprintf("%s_%d", prefix, time.Now().UnixNano())
}
