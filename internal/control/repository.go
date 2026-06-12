package control

import (
	"context"
	"fmt"
	"time"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type CreateUserInput struct {
	Email string
	Org   string
	Role  string
}

type UserRepository interface {
	ListUsers(ctx context.Context) ([]store.User, error)
	CreateUser(ctx context.Context, input CreateUserInput) (store.User, error)
}

type MemoryUserRepository struct {
	store *store.Store
}

func NewMemoryUserRepository(st *store.Store) MemoryUserRepository {
	return MemoryUserRepository{store: st}
}

func (repo MemoryUserRepository) ListUsers(context.Context) ([]store.User, error) {
	return repo.store.ListUsers(), nil
}

func (repo MemoryUserRepository) CreateUser(_ context.Context, input CreateUserInput) (store.User, error) {
	return repo.store.CreateUser(input.Email, input.Org, input.Role), nil
}

type PostgresUserRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresUserRepository(pool *pgxpool.Pool) PostgresUserRepository {
	return PostgresUserRepository{pool: pool}
}

func (repo PostgresUserRepository) ListUsers(ctx context.Context) ([]store.User, error) {
	rows, err := repo.pool.Query(ctx, `
		select id, email, org, role, mfa, status, created_at
		from users
		order by created_at desc
	`)
	if err != nil {
		return nil, fmt.Errorf("query users: %w", err)
	}
	defer rows.Close()

	users, err := pgx.CollectRows(rows, scanUser)
	if err != nil {
		return nil, fmt.Errorf("collect users: %w", err)
	}

	return users, nil
}

func (repo PostgresUserRepository) CreateUser(ctx context.Context, input CreateUserInput) (store.User, error) {
	user := store.User{
		ID:     fmt.Sprintf("usr_%d", time.Now().UnixNano()),
		Email:  input.Email,
		Org:    input.Org,
		Role:   input.Role,
		MFA:    "Pending",
		Status: "Invited",
	}

	var createdAt time.Time
	if err := repo.pool.QueryRow(ctx, `
		insert into users(id, email, org, role, mfa, status)
		values($1, $2, $3, $4, $5, $6)
		returning created_at
	`, user.ID, user.Email, user.Org, user.Role, user.MFA, user.Status).Scan(&createdAt); err != nil {
		return store.User{}, fmt.Errorf("insert user: %w", err)
	}

	user.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	return user, nil
}

func scanUser(row pgx.CollectableRow) (store.User, error) {
	var user store.User
	var createdAt time.Time
	if err := row.Scan(&user.ID, &user.Email, &user.Org, &user.Role, &user.MFA, &user.Status, &createdAt); err != nil {
		return store.User{}, err
	}
	user.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	return user, nil
}
