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

func scanGatewayRoute(row pgx.CollectableRow) (store.GatewayRoute, error) {
	var item store.GatewayRoute
	var updatedAt time.Time
	if err := row.Scan(&item.ID, &item.Route, &item.Upstream, &item.Auth, &item.Limit, &item.Status, &updatedAt); err != nil {
		return store.GatewayRoute{}, err
	}
	item.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return item, nil
}
