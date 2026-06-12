package ops

import (
	"context"
	"fmt"
	"time"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type TodoRepository interface {
	ListTodos(ctx context.Context) ([]store.OpsTodo, error)
	ResolveTodo(ctx context.Context, id string) (store.OpsTodo, bool, error)
}

type HealthRepository interface {
	ListHealth(ctx context.Context) ([]store.ServiceHealth, error)
}

type AuditRepository interface {
	ListAudit(ctx context.Context) ([]store.AuditEvent, error)
}

type Repositories struct {
	Todos  TodoRepository
	Health HealthRepository
	Audit  AuditRepository
}

func NewMemoryRepositories(st *store.Store) Repositories {
	return Repositories{
		Todos:  NewMemoryTodoRepository(st),
		Health: NewMemoryHealthRepository(st),
		Audit:  NewMemoryAuditRepository(st),
	}
}

type MemoryTodoRepository struct {
	store *store.Store
}

func NewMemoryTodoRepository(st *store.Store) MemoryTodoRepository {
	return MemoryTodoRepository{store: st}
}

func (repo MemoryTodoRepository) ListTodos(context.Context) ([]store.OpsTodo, error) {
	return repo.store.ListTodos(), nil
}

func (repo MemoryTodoRepository) ResolveTodo(_ context.Context, id string) (store.OpsTodo, bool, error) {
	todo, ok := repo.store.ResolveTodo(id)
	return todo, ok, nil
}

type MemoryHealthRepository struct {
	store *store.Store
}

func NewMemoryHealthRepository(st *store.Store) MemoryHealthRepository {
	return MemoryHealthRepository{store: st}
}

func (repo MemoryHealthRepository) ListHealth(context.Context) ([]store.ServiceHealth, error) {
	return repo.store.ListHealth(), nil
}

type MemoryAuditRepository struct {
	store *store.Store
}

func NewMemoryAuditRepository(st *store.Store) MemoryAuditRepository {
	return MemoryAuditRepository{store: st}
}

func (repo MemoryAuditRepository) ListAudit(context.Context) ([]store.AuditEvent, error) {
	return repo.store.ListAudit(), nil
}

type PostgresTodoRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresTodoRepository(pool *pgxpool.Pool) PostgresTodoRepository {
	return PostgresTodoRepository{pool: pool}
}

func (repo PostgresTodoRepository) ListTodos(ctx context.Context) ([]store.OpsTodo, error) {
	rows, err := repo.pool.Query(ctx, `
		select id, title, source, owner, status, updated_at
		from ops_todos
		order by updated_at desc
	`)
	if err != nil {
		return nil, fmt.Errorf("query ops todos: %w", err)
	}
	defer rows.Close()

	items, err := pgx.CollectRows(rows, scanOpsTodo)
	if err != nil {
		return nil, fmt.Errorf("collect ops todos: %w", err)
	}

	return items, nil
}

func (repo PostgresTodoRepository) ResolveTodo(ctx context.Context, id string) (store.OpsTodo, bool, error) {
	rows, err := repo.pool.Query(ctx, `
		update ops_todos
		set status = 'Resolved', updated_at = now()
		where id = $1
		returning id, title, source, owner, status, updated_at
	`, id)
	if err != nil {
		return store.OpsTodo{}, false, fmt.Errorf("resolve ops todo: %w", err)
	}
	defer rows.Close()

	todo, err := pgx.CollectOneRow(rows, scanOpsTodo)
	if err == pgx.ErrNoRows {
		return store.OpsTodo{}, false, nil
	}
	if err != nil {
		return store.OpsTodo{}, false, fmt.Errorf("collect resolved todo: %w", err)
	}

	return todo, true, nil
}

func scanOpsTodo(row pgx.CollectableRow) (store.OpsTodo, error) {
	var item store.OpsTodo
	var updatedAt time.Time
	if err := row.Scan(&item.ID, &item.Title, &item.Source, &item.Owner, &item.Status, &updatedAt); err != nil {
		return store.OpsTodo{}, err
	}
	item.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return item, nil
}

type PostgresHealthRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresHealthRepository(pool *pgxpool.Pool) PostgresHealthRepository {
	return PostgresHealthRepository{pool: pool}
}

func (repo PostgresHealthRepository) ListHealth(ctx context.Context) ([]store.ServiceHealth, error) {
	rows, err := repo.pool.Query(ctx, `
		select id, name, slo, p95, status
		from service_health
		order by name asc
	`)
	if err != nil {
		return nil, fmt.Errorf("query service health: %w", err)
	}
	defer rows.Close()

	items, err := pgx.CollectRows(rows, scanServiceHealth)
	if err != nil {
		return nil, fmt.Errorf("collect service health: %w", err)
	}

	return items, nil
}

func scanServiceHealth(row pgx.CollectableRow) (store.ServiceHealth, error) {
	var item store.ServiceHealth
	if err := row.Scan(&item.ID, &item.Name, &item.SLO, &item.P95, &item.Status); err != nil {
		return store.ServiceHealth{}, err
	}
	return item, nil
}

type PostgresAuditRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresAuditRepository(pool *pgxpool.Pool) PostgresAuditRepository {
	return PostgresAuditRepository{pool: pool}
}

func (repo PostgresAuditRepository) ListAudit(ctx context.Context) ([]store.AuditEvent, error) {
	rows, err := repo.pool.Query(ctx, `
		select id, event_time, module, action, object, status, request_id
		from audit_events
		order by event_time desc
	`)
	if err != nil {
		return nil, fmt.Errorf("query audit events: %w", err)
	}
	defer rows.Close()

	items, err := pgx.CollectRows(rows, scanAuditEvent)
	if err != nil {
		return nil, fmt.Errorf("collect audit events: %w", err)
	}

	return items, nil
}

func scanAuditEvent(row pgx.CollectableRow) (store.AuditEvent, error) {
	var item store.AuditEvent
	var eventTime time.Time
	if err := row.Scan(&item.ID, &eventTime, &item.Module, &item.Action, &item.Object, &item.Status, &item.RequestID); err != nil {
		return store.AuditEvent{}, err
	}
	item.Time = eventTime.UTC().Format(time.RFC3339)
	return item, nil
}
