package gateway

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/retention"
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
	Name          string
	Protocol      string
	Route         string
	Timeout       string
	SchemaVersion string
}

type LLMInvocationInput struct {
	ID          string
	ModelAlias  string
	Provider    string
	Model       string
	TotalTokens int
	Result      string
	Status      string
}

type SkillInvocationInput struct {
	ID         string
	Name       string
	Protocol   string
	Route      string
	SkillCalls int
	Result     string
	Status     string
}

type ProxyRequestLogInput struct {
	Request  string
	Consumer string
	Latency  string
	Result   string
	Status   string
}

type RequestLogQuery struct {
	Q        string
	Consumer string
	Status   string
	Limit    int
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
	QueryRequestLogs(ctx context.Context, query RequestLogQuery) ([]store.RequestLog, error)
	PurgeRequestLogsBefore(ctx context.Context, cutoff time.Time, olderThanDays int) (retention.PurgeResult, error)
}

type InvocationRecorder interface {
	RecordLLMInvocation(ctx context.Context, input LLMInvocationInput) error
	RecordSkillInvocation(ctx context.Context, input SkillInvocationInput) error
}

type ProxyRecorder interface {
	RecordProxyRequest(ctx context.Context, input ProxyRequestLogInput) error
}

type Repositories struct {
	Routes        RouteRepository
	ModelRoutes   ModelRouteRepository
	Skills        SkillRepository
	RequestLogs   RequestLogRepository
	Invocations   InvocationRecorder
	ProxyRequests ProxyRecorder
}

func NewMemoryRepositories(st *store.Store) Repositories {
	return Repositories{
		Routes:        NewMemoryRouteRepository(st),
		ModelRoutes:   NewMemoryModelRouteRepository(st),
		Skills:        NewMemorySkillRepository(st),
		RequestLogs:   NewMemoryRequestLogRepository(st),
		Invocations:   NewMemoryInvocationRecorder(st),
		ProxyRequests: NewMemoryProxyRecorder(st),
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
	return repo.store.CreateSkillBinding(input.Name, input.Protocol, input.Route, input.Timeout, input.SchemaVersion), nil
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

func (repo MemoryRequestLogRepository) QueryRequestLogs(_ context.Context, query RequestLogQuery) ([]store.RequestLog, error) {
	return filterRequestLogs(repo.store.ListRequestLogs(), query), nil
}

func (repo MemoryRequestLogRepository) PurgeRequestLogsBefore(_ context.Context, cutoff time.Time, olderThanDays int) (retention.PurgeResult, error) {
	deleted, retained := repo.store.PurgeRequestLogsBefore(cutoff)
	return retention.Result(deleted, retained, olderThanDays), nil
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
		Result:      input.Result,
		Status:      input.Status,
	})
	return nil
}

func (repo MemoryInvocationRecorder) RecordSkillInvocation(_ context.Context, input SkillInvocationInput) error {
	repo.store.RecordSkillInvocation(store.SkillInvocationRecord{
		ID:         input.ID,
		Name:       input.Name,
		Protocol:   input.Protocol,
		Route:      input.Route,
		SkillCalls: input.SkillCalls,
		Result:     input.Result,
		Status:     input.Status,
	})
	return nil
}

type MemoryProxyRecorder struct {
	store *store.Store
}

func NewMemoryProxyRecorder(st *store.Store) MemoryProxyRecorder {
	return MemoryProxyRecorder{store: st}
}

func (repo MemoryProxyRecorder) RecordProxyRequest(_ context.Context, input ProxyRequestLogInput) error {
	repo.store.RecordGatewayProxy(store.GatewayProxyRecord{
		Request:  input.Request,
		Consumer: input.Consumer,
		Latency:  input.Latency,
		Result:   input.Result,
		Status:   input.Status,
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
		select id, name, protocol, route, timeout, schema_version, status, updated_at
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
		ID:            nextID("skill"),
		Name:          input.Name,
		Protocol:      input.Protocol,
		Route:         input.Route,
		Timeout:       input.Timeout,
		SchemaVersion: input.SchemaVersion,
		Status:        "Draft",
	}
	if item.SchemaVersion == "" {
		item.SchemaVersion = "0.1"
	}

	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return store.SkillBinding{}, fmt.Errorf("begin create skill binding: %w", err)
	}
	defer tx.Rollback(ctx)

	var updatedAt time.Time
	if err := tx.QueryRow(ctx, `
		insert into skill_bindings(id, name, protocol, route, timeout, schema_version, status)
		values($1, $2, $3, $4, $5, $6, $7)
		returning updated_at
	`, item.ID, item.Name, item.Protocol, item.Route, item.Timeout, item.SchemaVersion, item.Status).Scan(&updatedAt); err != nil {
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
		returning id, name, protocol, route, timeout, schema_version, status, updated_at
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
	if err := row.Scan(&item.ID, &item.Name, &item.Protocol, &item.Route, &item.Timeout, &item.SchemaVersion, &item.Status, &updatedAt); err != nil {
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
	return repo.QueryRequestLogs(ctx, RequestLogQuery{})
}

func (repo PostgresRequestLogRepository) QueryRequestLogs(ctx context.Context, query RequestLogQuery) ([]store.RequestLog, error) {
	sql := `
		select id, request, consumer, latency, result, status, created_at
		from request_logs
	`
	args := make([]any, 0, 4)
	clauses := make([]string, 0, 3)
	addArg := func(value any) string {
		args = append(args, value)
		return fmt.Sprintf("$%d", len(args))
	}
	if query.Q != "" {
		placeholder := addArg("%" + query.Q + "%")
		clauses = append(clauses, "(request ilike "+placeholder+" or consumer ilike "+placeholder+" or result ilike "+placeholder+")")
	}
	if query.Consumer != "" {
		clauses = append(clauses, "lower(consumer) = lower("+addArg(query.Consumer)+")")
	}
	if query.Status != "" {
		clauses = append(clauses, "lower(status) = lower("+addArg(query.Status)+")")
	}
	if len(clauses) > 0 {
		sql += " where " + strings.Join(clauses, " and ")
	}
	sql += " order by created_at desc"
	if query.Limit > 0 {
		sql += " limit " + addArg(query.Limit)
	}

	rows, err := repo.pool.Query(ctx, sql, args...)
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

func (repo PostgresRequestLogRepository) PurgeRequestLogsBefore(ctx context.Context, cutoff time.Time, olderThanDays int) (retention.PurgeResult, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return retention.PurgeResult{}, fmt.Errorf("begin purge request logs: %w", err)
	}
	defer tx.Rollback(ctx)

	rows, err := tx.Query(ctx, `
		delete from request_logs
		where created_at < $1
		returning id
	`, cutoff)
	if err != nil {
		return retention.PurgeResult{}, fmt.Errorf("purge request logs: %w", err)
	}
	deleted := 0
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return retention.PurgeResult{}, fmt.Errorf("scan purged request log: %w", err)
		}
		deleted++
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return retention.PurgeResult{}, fmt.Errorf("collect purged request logs: %w", err)
	}
	rows.Close()

	retained := 0
	if err := tx.QueryRow(ctx, `select count(*) from request_logs`).Scan(&retained); err != nil {
		return retention.PurgeResult{}, fmt.Errorf("count retained request logs: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return retention.PurgeResult{}, fmt.Errorf("commit purge request logs: %w", err)
	}

	return retention.Result(deleted, retained, olderThanDays), nil
}

func filterRequestLogs(items []store.RequestLog, query RequestLogQuery) []store.RequestLog {
	filtered := make([]store.RequestLog, 0, len(items))
	for _, item := range items {
		if query.Consumer != "" && !strings.EqualFold(item.Consumer, query.Consumer) {
			continue
		}
		if query.Status != "" && !strings.EqualFold(item.Status, query.Status) {
			continue
		}
		if query.Q != "" && !requestLogMatches(item, query.Q) {
			continue
		}
		filtered = append(filtered, item)
		if query.Limit > 0 && len(filtered) >= query.Limit {
			break
		}
	}
	return filtered
}

func requestLogMatches(item store.RequestLog, query string) bool {
	needle := strings.ToLower(query)
	return strings.Contains(strings.ToLower(item.Request), needle) ||
		strings.Contains(strings.ToLower(item.Consumer), needle) ||
		strings.Contains(strings.ToLower(item.Result), needle)
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
	result := input.Result
	if result == "" {
		result = "200"
		if status == "Failed" {
			result = "502"
		}
	}

	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin llm invocation record: %w", err)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `
		insert into request_logs(id, request, consumer, latency, result, status)
		values($1, $2, $3, $4, $5, $6)
	`, "req_"+input.ID, "POST /llm/invoke "+input.Model, input.ModelAlias, "72ms", result, status); err != nil {
		return fmt.Errorf("insert llm request log: %w", err)
	}

	if status != "Failed" && input.TotalTokens > 0 {
		if _, err := tx.Exec(ctx, `
			insert into usage_records(id, project, tokens, skill_calls, cost, status)
			values($1, $2, $3, $4, $5, $6)
		`, "usage_"+input.ID, input.ModelAlias, fmt.Sprintf("%d", input.TotalTokens), "0", estimateMockCost(input.TotalTokens), "Normal"); err != nil {
			return fmt.Errorf("insert llm usage record: %w", err)
		}
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

func (repo PostgresInvocationRecorder) RecordSkillInvocation(ctx context.Context, input SkillInvocationInput) error {
	status := input.Status
	if status == "" {
		status = "Success"
	}
	result := input.Result
	if result == "" {
		result = "200"
		if status == "Failed" {
			result = "502"
		}
	}

	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin skill invocation record: %w", err)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `
		insert into request_logs(id, request, consumer, latency, result, status)
		values($1, $2, $3, $4, $5, $6)
	`, "req_"+input.ID, "POST /skills/invoke "+input.Route, input.Name, "64ms", result, status); err != nil {
		return fmt.Errorf("insert skill request log: %w", err)
	}

	if status != "Failed" && input.SkillCalls > 0 {
		if _, err := tx.Exec(ctx, `
			insert into usage_records(id, project, tokens, skill_calls, cost, status)
			values($1, $2, $3, $4, $5, $6)
		`, "usage_"+input.ID, input.Name, "0", fmt.Sprintf("%d", input.SkillCalls), "$0.0000", "Normal"); err != nil {
			return fmt.Errorf("insert skill usage record: %w", err)
		}
	}

	if _, err := tx.Exec(ctx, `
		insert into audit_events(id, module, action, object, status, request_id)
		values($1, $2, $3, $4, $5, $6)
	`, "audit_"+input.ID, "网关与模型", "invoke skill", input.Name, status, "req_"+input.ID); err != nil {
		return fmt.Errorf("insert skill audit event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit skill invocation record: %w", err)
	}

	return nil
}

type PostgresProxyRecorder struct {
	pool *pgxpool.Pool
}

func NewPostgresProxyRecorder(pool *pgxpool.Pool) PostgresProxyRecorder {
	return PostgresProxyRecorder{pool: pool}
}

func (repo PostgresProxyRecorder) RecordProxyRequest(ctx context.Context, input ProxyRequestLogInput) error {
	status := input.Status
	if status == "" {
		status = "Success"
	}
	requestID := nextID("req")

	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin proxy request record: %w", err)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `
		insert into request_logs(id, request, consumer, latency, result, status)
		values($1, $2, $3, $4, $5, $6)
	`, requestID, input.Request, input.Consumer, input.Latency, input.Result, status); err != nil {
		return fmt.Errorf("insert proxy request log: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		insert into audit_events(id, module, action, object, status, request_id)
		values($1, $2, $3, $4, $5, $6)
	`, nextID("audit"), "网关与模型", "proxy upstream", input.Request, status, requestID); err != nil {
		return fmt.Errorf("insert proxy audit event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit proxy request record: %w", err)
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
