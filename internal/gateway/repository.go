package gateway

import (
	"context"
	"fmt"
	"time"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type CreateRouteInput struct {
	Route    string
	Upstream string
	Limit    string
}

type CreateModelRouteInput struct {
	Alias    string
	Scenario string
	Primary  string
	Fallback string
}

type CreateSkillBindingInput struct {
	Name     string
	Protocol string
	Route    string
	Timeout  string
}

type LLMInvocationInput struct {
	ID          string
	ModelAlias  string
	Provider    string
	Model       string
	TotalTokens int
	Status      string
}

type RouteRepository interface {
	ListRoutes(ctx context.Context) ([]store.GatewayRoute, error)
	CreateRoute(ctx context.Context, input CreateRouteInput) (store.GatewayRoute, error)
	PublishRoute(ctx context.Context, id string) (store.GatewayRoute, bool, error)
}

type ModelRouteRepository interface {
	ListModelRoutes(ctx context.Context) ([]store.ModelRoute, error)
	CreateModelRoute(ctx context.Context, input CreateModelRouteInput) (store.ModelRoute, error)
	PublishModelRoute(ctx context.Context, id string) (store.ModelRoute, bool, error)
}

type SkillRepository interface {
	ListSkills(ctx context.Context) ([]store.SkillBinding, error)
	CreateSkillBinding(ctx context.Context, input CreateSkillBindingInput) (store.SkillBinding, error)
	PublishSkillBinding(ctx context.Context, id string) (store.SkillBinding, bool, error)
}

type RequestLogRepository interface {
	ListRequestLogs(ctx context.Context) ([]store.RequestLog, error)
}

type InvocationRecorder interface {
	RecordLLMInvocation(ctx context.Context, input LLMInvocationInput) error
}

type Repositories struct {
	Routes      RouteRepository
	ModelRoutes ModelRouteRepository
	Skills      SkillRepository
	RequestLogs RequestLogRepository
	Invocations InvocationRecorder
}

func NewMemoryRepositories(st *store.Store) Repositories {
	return Repositories{
		Routes:      NewMemoryRouteRepository(st),
		ModelRoutes: NewMemoryModelRouteRepository(st),
		Skills:      NewMemorySkillRepository(st),
		RequestLogs: NewMemoryRequestLogRepository(st),
		Invocations: NewMemoryInvocationRecorder(st),
	}
}

type MemoryRouteRepository struct {
	store *store.Store
}

func NewMemoryRouteRepository(st *store.Store) MemoryRouteRepository {
	return MemoryRouteRepository{store: st}
}

func (repo MemoryRouteRepository) ListRoutes(context.Context) ([]store.GatewayRoute, error) {
	return repo.store.ListRoutes(), nil
}

func (repo MemoryRouteRepository) CreateRoute(_ context.Context, input CreateRouteInput) (store.GatewayRoute, error) {
	return repo.store.CreateRoute(input.Route, input.Upstream, input.Limit), nil
}

func (repo MemoryRouteRepository) PublishRoute(_ context.Context, id string) (store.GatewayRoute, bool, error) {
	route, ok := repo.store.PublishRoute(id)
	return route, ok, nil
}

type MemoryModelRouteRepository struct {
	store *store.Store
}

func NewMemoryModelRouteRepository(st *store.Store) MemoryModelRouteRepository {
	return MemoryModelRouteRepository{store: st}
}

func (repo MemoryModelRouteRepository) ListModelRoutes(context.Context) ([]store.ModelRoute, error) {
	return repo.store.ListModelRoutes(), nil
}

func (repo MemoryModelRouteRepository) CreateModelRoute(_ context.Context, input CreateModelRouteInput) (store.ModelRoute, error) {
	return repo.store.CreateModelRoute(input.Alias, input.Scenario, input.Primary, input.Fallback), nil
}

func (repo MemoryModelRouteRepository) PublishModelRoute(_ context.Context, id string) (store.ModelRoute, bool, error) {
	route, ok := repo.store.PublishModelRoute(id)
	return route, ok, nil
}

type MemorySkillRepository struct {
	store *store.Store
}

func NewMemorySkillRepository(st *store.Store) MemorySkillRepository {
	return MemorySkillRepository{store: st}
}

func (repo MemorySkillRepository) ListSkills(context.Context) ([]store.SkillBinding, error) {
	return repo.store.ListSkills(), nil
}

func (repo MemorySkillRepository) CreateSkillBinding(_ context.Context, input CreateSkillBindingInput) (store.SkillBinding, error) {
	return repo.store.CreateSkillBinding(input.Name, input.Protocol, input.Route, input.Timeout), nil
}

func (repo MemorySkillRepository) PublishSkillBinding(_ context.Context, id string) (store.SkillBinding, bool, error) {
	skill, ok := repo.store.PublishSkillBinding(id)
	return skill, ok, nil
}

type MemoryRequestLogRepository struct {
	store *store.Store
}

func NewMemoryRequestLogRepository(st *store.Store) MemoryRequestLogRepository {
	return MemoryRequestLogRepository{store: st}
}

func (repo MemoryRequestLogRepository) ListRequestLogs(context.Context) ([]store.RequestLog, error) {
	return repo.store.ListRequestLogs(), nil
}

type MemoryInvocationRecorder struct {
	store *store.Store
}

func NewMemoryInvocationRecorder(st *store.Store) MemoryInvocationRecorder {
	return MemoryInvocationRecorder{store: st}
}

func (repo MemoryInvocationRecorder) RecordLLMInvocation(_ context.Context, input LLMInvocationInput) error {
	repo.store.RecordLLMInvocation(store.LLMInvocationRecord{
		ID:          input.ID,
		ModelAlias:  input.ModelAlias,
		Provider:    input.Provider,
		Model:       input.Model,
		TotalTokens: input.TotalTokens,
		Status:      input.Status,
	})
	return nil
}

type PostgresRouteRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresRouteRepository(pool *pgxpool.Pool) PostgresRouteRepository {
	return PostgresRouteRepository{pool: pool}
}

func (repo PostgresRouteRepository) ListRoutes(ctx context.Context) ([]store.GatewayRoute, error) {
	rows, err := repo.pool.Query(ctx, `
		select id, route, upstream, auth, rate_limit, status, updated_at
		from gateway_routes
		order by updated_at desc
	`)
	if err != nil {
		return nil, fmt.Errorf("query gateway routes: %w", err)
	}
	defer rows.Close()

	items, err := pgx.CollectRows(rows, scanGatewayRoute)
	if err != nil {
		return nil, fmt.Errorf("collect gateway routes: %w", err)
	}

	return items, nil
}

func (repo PostgresRouteRepository) CreateRoute(ctx context.Context, input CreateRouteInput) (store.GatewayRoute, error) {
	item := store.GatewayRoute{
		ID:       nextID("route"),
		Route:    input.Route,
		Upstream: input.Upstream,
		Auth:     "API Key",
		Limit:    input.Limit,
		Status:   "Draft",
	}

	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return store.GatewayRoute{}, fmt.Errorf("begin create gateway route: %w", err)
	}
	defer tx.Rollback(ctx)

	var updatedAt time.Time
	if err := tx.QueryRow(ctx, `
		insert into gateway_routes(id, route, upstream, auth, rate_limit, status)
		values($1, $2, $3, $4, $5, $6)
		returning updated_at
	`, item.ID, item.Route, item.Upstream, item.Auth, item.Limit, item.Status).Scan(&updatedAt); err != nil {
		return store.GatewayRoute{}, fmt.Errorf("insert gateway route: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		insert into request_logs(id, request, consumer, latency, result, status)
		values($1, $2, $3, $4, $5, $6)
	`, nextID("req"), "POST "+item.Route, "demo-agent-workbench", "64ms", "201", "Mocked"); err != nil {
		return store.GatewayRoute{}, fmt.Errorf("insert gateway route request log: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		insert into audit_events(id, module, action, object, status, request_id)
		values($1, $2, $3, $4, $5, $6)
	`, nextID("audit"), "网关与模型", "create route", item.Route, "Success", nextID("req")); err != nil {
		return store.GatewayRoute{}, fmt.Errorf("insert gateway route create audit: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return store.GatewayRoute{}, fmt.Errorf("commit create gateway route: %w", err)
	}

	item.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return item, nil
}

func (repo PostgresRouteRepository) PublishRoute(ctx context.Context, id string) (store.GatewayRoute, bool, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return store.GatewayRoute{}, false, fmt.Errorf("begin publish gateway route: %w", err)
	}
	defer tx.Rollback(ctx)

	rows, err := tx.Query(ctx, `
		update gateway_routes
		set status = 'Active', updated_at = now()
		where id = $1
		returning id, route, upstream, auth, rate_limit, status, updated_at
	`, id)
	if err != nil {
		return store.GatewayRoute{}, false, fmt.Errorf("publish gateway route: %w", err)
	}
	defer rows.Close()

	route, err := pgx.CollectOneRow(rows, scanGatewayRoute)
	if err != nil {
		if err == pgx.ErrNoRows {
			return store.GatewayRoute{}, false, nil
		}
		return store.GatewayRoute{}, false, fmt.Errorf("collect published gateway route: %w", err)
	}
	rows.Close()

	if _, err := tx.Exec(ctx, `
		insert into request_logs(id, request, consumer, latency, result, status)
		values($1, $2, $3, $4, $5, $6)
	`, nextID("req"), "PUBLISH "+route.Route, route.Upstream, "28ms", "200", "Success"); err != nil {
		return store.GatewayRoute{}, false, fmt.Errorf("insert gateway route publish request log: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		insert into audit_events(id, module, action, object, status, request_id)
		values($1, $2, $3, $4, $5, $6)
	`, nextID("audit"), "网关与模型", "publish route", route.Route, "Success", nextID("req")); err != nil {
		return store.GatewayRoute{}, false, fmt.Errorf("insert gateway route publish audit: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return store.GatewayRoute{}, false, fmt.Errorf("commit publish gateway route: %w", err)
	}

	return route, true, nil
}

type PostgresModelRouteRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresModelRouteRepository(pool *pgxpool.Pool) PostgresModelRouteRepository {
	return PostgresModelRouteRepository{pool: pool}
}

func (repo PostgresModelRouteRepository) ListModelRoutes(ctx context.Context) ([]store.ModelRoute, error) {
	rows, err := repo.pool.Query(ctx, `
		select id, alias, scenario, primary_model, fallback_model, status, updated_at
		from model_routes
		order by updated_at desc
	`)
	if err != nil {
		return nil, fmt.Errorf("query model routes: %w", err)
	}
	defer rows.Close()

	items, err := pgx.CollectRows(rows, scanModelRoute)
	if err != nil {
		return nil, fmt.Errorf("collect model routes: %w", err)
	}

	return items, nil
}

func (repo PostgresModelRouteRepository) CreateModelRoute(ctx context.Context, input CreateModelRouteInput) (store.ModelRoute, error) {
	item := store.ModelRoute{
		ID:       nextID("model"),
		Alias:    input.Alias,
		Scenario: input.Scenario,
		Primary:  input.Primary,
		Fallback: input.Fallback,
		Status:   "Draft",
	}

	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return store.ModelRoute{}, fmt.Errorf("begin create model route: %w", err)
	}
	defer tx.Rollback(ctx)

	var updatedAt time.Time
	if err := tx.QueryRow(ctx, `
		insert into model_routes(id, alias, scenario, primary_model, fallback_model, status)
		values($1, $2, $3, $4, $5, $6)
		returning updated_at
	`, item.ID, item.Alias, item.Scenario, item.Primary, item.Fallback, item.Status).Scan(&updatedAt); err != nil {
		return store.ModelRoute{}, fmt.Errorf("insert model route: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		insert into audit_events(id, module, action, object, status, request_id)
		values($1, $2, $3, $4, $5, $6)
	`, nextID("audit"), "网关与模型", "create model route", item.Alias, "Success", nextID("req")); err != nil {
		return store.ModelRoute{}, fmt.Errorf("insert model route create audit: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return store.ModelRoute{}, fmt.Errorf("commit create model route: %w", err)
	}

	item.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return item, nil
}

func (repo PostgresModelRouteRepository) PublishModelRoute(ctx context.Context, id string) (store.ModelRoute, bool, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return store.ModelRoute{}, false, fmt.Errorf("begin publish model route: %w", err)
	}
	defer tx.Rollback(ctx)

	rows, err := tx.Query(ctx, `
		update model_routes
		set status = 'Active', updated_at = now()
		where id = $1
		returning id, alias, scenario, primary_model, fallback_model, status, updated_at
	`, id)
	if err != nil {
		return store.ModelRoute{}, false, fmt.Errorf("publish model route: %w", err)
	}
	defer rows.Close()

	route, err := pgx.CollectOneRow(rows, scanModelRoute)
	if err != nil {
		if err == pgx.ErrNoRows {
			return store.ModelRoute{}, false, nil
		}
		return store.ModelRoute{}, false, fmt.Errorf("collect published model route: %w", err)
	}
	rows.Close()

	if _, err := tx.Exec(ctx, `
		insert into request_logs(id, request, consumer, latency, result, status)
		values($1, $2, $3, $4, $5, $6)
	`, nextID("req"), "PUBLISH model:"+route.Alias, route.Scenario, "34ms", "200", "Success"); err != nil {
		return store.ModelRoute{}, false, fmt.Errorf("insert model route publish request log: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		insert into audit_events(id, module, action, object, status, request_id)
		values($1, $2, $3, $4, $5, $6)
	`, nextID("audit"), "网关与模型", "publish model route", route.Alias, "Success", nextID("req")); err != nil {
		return store.ModelRoute{}, false, fmt.Errorf("insert model route publish audit: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return store.ModelRoute{}, false, fmt.Errorf("commit publish model route: %w", err)
	}

	return route, true, nil
}

func scanModelRoute(row pgx.CollectableRow) (store.ModelRoute, error) {
	var item store.ModelRoute
	var updatedAt time.Time
	if err := row.Scan(&item.ID, &item.Alias, &item.Scenario, &item.Primary, &item.Fallback, &item.Status, &updatedAt); err != nil {
		return store.ModelRoute{}, err
	}
	item.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return item, nil
}

type PostgresSkillRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresSkillRepository(pool *pgxpool.Pool) PostgresSkillRepository {
	return PostgresSkillRepository{pool: pool}
}

func (repo PostgresSkillRepository) ListSkills(ctx context.Context) ([]store.SkillBinding, error) {
	rows, err := repo.pool.Query(ctx, `
		select id, name, protocol, route, timeout, status, updated_at
		from skill_bindings
		order by updated_at desc
	`)
	if err != nil {
		return nil, fmt.Errorf("query skill bindings: %w", err)
	}
	defer rows.Close()

	items, err := pgx.CollectRows(rows, scanSkillBinding)
	if err != nil {
		return nil, fmt.Errorf("collect skill bindings: %w", err)
	}

	return items, nil
}

func (repo PostgresSkillRepository) CreateSkillBinding(ctx context.Context, input CreateSkillBindingInput) (store.SkillBinding, error) {
	item := store.SkillBinding{
		ID:       nextID("skill"),
		Name:     input.Name,
		Protocol: input.Protocol,
		Route:    input.Route,
		Timeout:  input.Timeout,
		Status:   "Draft",
	}

	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return store.SkillBinding{}, fmt.Errorf("begin create skill binding: %w", err)
	}
	defer tx.Rollback(ctx)

	var updatedAt time.Time
	if err := tx.QueryRow(ctx, `
		insert into skill_bindings(id, name, protocol, route, timeout, status)
		values($1, $2, $3, $4, $5, $6)
		returning updated_at
	`, item.ID, item.Name, item.Protocol, item.Route, item.Timeout, item.Status).Scan(&updatedAt); err != nil {
		return store.SkillBinding{}, fmt.Errorf("insert skill binding: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		insert into audit_events(id, module, action, object, status, request_id)
		values($1, $2, $3, $4, $5, $6)
	`, nextID("audit"), "网关与模型", "create skill binding", item.Name, "Success", nextID("req")); err != nil {
		return store.SkillBinding{}, fmt.Errorf("insert skill binding create audit: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return store.SkillBinding{}, fmt.Errorf("commit create skill binding: %w", err)
	}

	item.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return item, nil
}

func (repo PostgresSkillRepository) PublishSkillBinding(ctx context.Context, id string) (store.SkillBinding, bool, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return store.SkillBinding{}, false, fmt.Errorf("begin publish skill binding: %w", err)
	}
	defer tx.Rollback(ctx)

	rows, err := tx.Query(ctx, `
		update skill_bindings
		set status = 'Published', updated_at = now()
		where id = $1
		returning id, name, protocol, route, timeout, status, updated_at
	`, id)
	if err != nil {
		return store.SkillBinding{}, false, fmt.Errorf("publish skill binding: %w", err)
	}
	defer rows.Close()

	skill, err := pgx.CollectOneRow(rows, scanSkillBinding)
	if err != nil {
		if err == pgx.ErrNoRows {
			return store.SkillBinding{}, false, nil
		}
		return store.SkillBinding{}, false, fmt.Errorf("collect published skill binding: %w", err)
	}
	rows.Close()

	if _, err := tx.Exec(ctx, `
		insert into request_logs(id, request, consumer, latency, result, status)
		values($1, $2, $3, $4, $5, $6)
	`, nextID("req"), "PUBLISH skill:"+skill.Name, skill.Protocol, "41ms", "200", "Success"); err != nil {
		return store.SkillBinding{}, false, fmt.Errorf("insert skill binding publish request log: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		insert into audit_events(id, module, action, object, status, request_id)
		values($1, $2, $3, $4, $5, $6)
	`, nextID("audit"), "网关与模型", "publish skill binding", skill.Name, "Success", nextID("req")); err != nil {
		return store.SkillBinding{}, false, fmt.Errorf("insert skill binding publish audit: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return store.SkillBinding{}, false, fmt.Errorf("commit publish skill binding: %w", err)
	}

	return skill, true, nil
}

func scanSkillBinding(row pgx.CollectableRow) (store.SkillBinding, error) {
	var item store.SkillBinding
	var updatedAt time.Time
	if err := row.Scan(&item.ID, &item.Name, &item.Protocol, &item.Route, &item.Timeout, &item.Status, &updatedAt); err != nil {
		return store.SkillBinding{}, err
	}
	item.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return item, nil
}

type PostgresRequestLogRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresRequestLogRepository(pool *pgxpool.Pool) PostgresRequestLogRepository {
	return PostgresRequestLogRepository{pool: pool}
}

func (repo PostgresRequestLogRepository) ListRequestLogs(ctx context.Context) ([]store.RequestLog, error) {
	rows, err := repo.pool.Query(ctx, `
		select id, request, consumer, latency, result, status, created_at
		from request_logs
		order by created_at desc
	`)
	if err != nil {
		return nil, fmt.Errorf("query request logs: %w", err)
	}
	defer rows.Close()

	items, err := pgx.CollectRows(rows, scanRequestLog)
	if err != nil {
		return nil, fmt.Errorf("collect request logs: %w", err)
	}

	return items, nil
}

type PostgresInvocationRecorder struct {
	pool *pgxpool.Pool
}

func NewPostgresInvocationRecorder(pool *pgxpool.Pool) PostgresInvocationRecorder {
	return PostgresInvocationRecorder{pool: pool}
}

func (repo PostgresInvocationRecorder) RecordLLMInvocation(ctx context.Context, input LLMInvocationInput) error {
	status := input.Status
	if status == "" {
		status = "Success"
	}

	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin llm invocation record: %w", err)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `
		insert into request_logs(id, request, consumer, latency, result, status)
		values($1, $2, $3, $4, $5, $6)
	`, "req_"+input.ID, "POST /llm/invoke "+input.Model, input.ModelAlias, "72ms", "200", status); err != nil {
		return fmt.Errorf("insert llm request log: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		insert into usage_records(id, project, tokens, skill_calls, cost, status)
		values($1, $2, $3, $4, $5, $6)
	`, "usage_"+input.ID, input.ModelAlias, fmt.Sprintf("%d", input.TotalTokens), "0", estimateMockCost(input.TotalTokens), "Normal"); err != nil {
		return fmt.Errorf("insert llm usage record: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		insert into audit_events(id, module, action, object, status, request_id)
		values($1, $2, $3, $4, $5, $6)
	`, "audit_"+input.ID, "网关与模型", "invoke llm", input.ModelAlias, status, "req_"+input.ID); err != nil {
		return fmt.Errorf("insert llm audit event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit llm invocation record: %w", err)
	}

	return nil
}

func scanRequestLog(row pgx.CollectableRow) (store.RequestLog, error) {
	var item store.RequestLog
	var createdAt time.Time
	if err := row.Scan(&item.ID, &item.Request, &item.Consumer, &item.Latency, &item.Result, &item.Status, &createdAt); err != nil {
		return store.RequestLog{}, err
	}
	item.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	return item, nil
}

func estimateMockCost(tokens int) string {
	if tokens <= 0 {
		return "$0.0000"
	}
	return fmt.Sprintf("$%.4f", float64(tokens)*0.000002)
}

func nextID(prefix string) string {
	return fmt.Sprintf("%s_%d", prefix, time.Now().UnixNano())
}

func scanGatewayRoute(row pgx.CollectableRow) (store.GatewayRoute, error) {
	var item store.GatewayRoute
	var updatedAt time.Time
	if err := row.Scan(&item.ID, &item.Route, &item.Upstream, &item.Auth, &item.Limit, &item.Status, &updatedAt); err != nil {
		return store.GatewayRoute{}, err
	}
	item.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return item, nil
}
