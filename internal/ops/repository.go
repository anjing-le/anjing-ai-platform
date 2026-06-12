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
