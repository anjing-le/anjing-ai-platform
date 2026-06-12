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

type APIKeyRepository interface {
	ListAPIKeys(ctx context.Context) ([]store.APIKey, error)
}

type CredentialRepository interface {
	ListCredentials(ctx context.Context) ([]store.Credential, error)
}

type Repositories struct {
	Users       UserRepository
	APIKeys     APIKeyRepository
	Credentials CredentialRepository
}

func NewMemoryRepositories(st *store.Store) Repositories {
	return Repositories{
		Users:       NewMemoryUserRepository(st),
		APIKeys:     NewMemoryAPIKeyRepository(st),
		Credentials: NewMemoryCredentialRepository(st),
	}
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

type MemoryAPIKeyRepository struct {
	store *store.Store
}

func NewMemoryAPIKeyRepository(st *store.Store) MemoryAPIKeyRepository {
	return MemoryAPIKeyRepository{store: st}
}

func (repo MemoryAPIKeyRepository) ListAPIKeys(context.Context) ([]store.APIKey, error) {
	return repo.store.ListAPIKeys(), nil
}

type MemoryCredentialRepository struct {
	store *store.Store
}

func NewMemoryCredentialRepository(st *store.Store) MemoryCredentialRepository {
	return MemoryCredentialRepository{store: st}
}

func (repo MemoryCredentialRepository) ListCredentials(context.Context) ([]store.Credential, error) {
	return repo.store.ListCredentials(), nil
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

type PostgresAPIKeyRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresAPIKeyRepository(pool *pgxpool.Pool) PostgresAPIKeyRepository {
	return PostgresAPIKeyRepository{pool: pool}
}

func (repo PostgresAPIKeyRepository) ListAPIKeys(ctx context.Context) ([]store.APIKey, error) {
	rows, err := repo.pool.Query(ctx, `
		select id, name, project, scope, coalesce(expires_at::text, ''), status
		from api_keys
		order by created_at desc
	`)
	if err != nil {
		return nil, fmt.Errorf("query api keys: %w", err)
	}
	defer rows.Close()

	items, err := pgx.CollectRows(rows, scanAPIKey)
	if err != nil {
		return nil, fmt.Errorf("collect api keys: %w", err)
	}

	return items, nil
}

func scanAPIKey(row pgx.CollectableRow) (store.APIKey, error) {
	var item store.APIKey
	if err := row.Scan(&item.ID, &item.Name, &item.Project, &item.Scope, &item.ExpiresAt, &item.Status); err != nil {
		return store.APIKey{}, err
	}
	return item, nil
}

type PostgresCredentialRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresCredentialRepository(pool *pgxpool.Pool) PostgresCredentialRepository {
	return PostgresCredentialRepository{pool: pool}
}

func (repo PostgresCredentialRepository) ListCredentials(ctx context.Context) ([]store.Credential, error) {
	rows, err := repo.pool.Query(ctx, `
		select id, ref, purpose, scope, coalesce(expires_at::text, ''), status, masked_preview
		from credentials
		order by ref asc
	`)
	if err != nil {
		return nil, fmt.Errorf("query credentials: %w", err)
	}
	defer rows.Close()

	items, err := pgx.CollectRows(rows, scanCredential)
	if err != nil {
		return nil, fmt.Errorf("collect credentials: %w", err)
	}

	return items, nil
}

func scanCredential(row pgx.CollectableRow) (store.Credential, error) {
	var item store.Credential
	if err := row.Scan(&item.ID, &item.Ref, &item.Purpose, &item.Scope, &item.ExpiresAt, &item.Status, &item.MaskedPreview); err != nil {
		return store.Credential{}, err
	}
	return item, nil
}
