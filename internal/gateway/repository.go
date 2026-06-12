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

type RouteRepository interface {
	ListRoutes(ctx context.Context) ([]store.GatewayRoute, error)
	CreateRoute(ctx context.Context, input CreateRouteInput) (store.GatewayRoute, error)
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

type Repositories struct {
	Routes      RouteRepository
	ModelRoutes ModelRouteRepository
	Skills      SkillRepository
	RequestLogs RequestLogRepository
}

func NewMemoryRepositories(st *store.Store) Repositories {
	return Repositories{
		Routes:      NewMemoryRouteRepository(st),
		ModelRoutes: NewMemoryModelRouteRepository(st),
		Skills:      NewMemorySkillRepository(st),
		RequestLogs: NewMemoryRequestLogRepository(st),
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

type MemoryModelRouteRepository struct {
	store *store.Store
}

func NewMemoryModelRouteRepository(st *store.Store) MemoryModelRouteRepository {
	return MemoryModelRouteRepository{store: st}
}

func (repo MemoryModelRouteRepository) ListModelRoutes(context.Context) ([]store.ModelRoute, error) {
	return repo.store.ListModelRoutes(), nil
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

type MemoryRequestLogRepository struct {
	store *store.Store
}

func NewMemoryRequestLogRepository(st *store.Store) MemoryRequestLogRepository {
	return MemoryRequestLogRepository{store: st}
}

func (repo MemoryRequestLogRepository) ListRequestLogs(context.Context) ([]store.RequestLog, error) {
	return repo.store.ListRequestLogs(), nil
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
		ID:       fmt.Sprintf("route_%d", time.Now().UnixNano()),
		Route:    input.Route,
		Upstream: input.Upstream,
		Auth:     "API Key",
		Limit:    input.Limit,
		Status:   "Draft",
	}

	var updatedAt time.Time
	if err := repo.pool.QueryRow(ctx, `
		insert into gateway_routes(id, route, upstream, auth, rate_limit, status)
		values($1, $2, $3, $4, $5, $6)
		returning updated_at
	`, item.ID, item.Route, item.Upstream, item.Auth, item.Limit, item.Status).Scan(&updatedAt); err != nil {
		return store.GatewayRoute{}, fmt.Errorf("insert gateway route: %w", err)
	}

	item.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return item, nil
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

func scanRequestLog(row pgx.CollectableRow) (store.RequestLog, error) {
	var item store.RequestLog
	var createdAt time.Time
	if err := row.Scan(&item.ID, &item.Request, &item.Consumer, &item.Latency, &item.Result, &item.Status, &createdAt); err != nil {
		return store.RequestLog{}, err
	}
	item.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	return item, nil
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
