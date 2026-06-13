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

type CreateApplicationInput struct {
	Name         string
	Owner        string
	Environment  string
	DefaultRoute string
	Plan         string
}

type UserRepository interface {
	ListUsers(ctx context.Context) ([]store.User, error)
	CreateUser(ctx context.Context, input CreateUserInput) (store.User, error)
	ActivateUser(ctx context.Context, id string) (store.User, bool, error)
}

type ApplicationRepository interface {
	ListApplications(ctx context.Context) ([]store.Application, error)
	CreateApplication(ctx context.Context, input CreateApplicationInput) (store.Application, error)
	ActivateApplication(ctx context.Context, id string) (store.Application, bool, error)
	RotateApplicationKey(ctx context.Context, id string) (store.Application, bool, error)
}

type RoleRepository interface {
	ListRoles(ctx context.Context) ([]store.RolePolicy, error)
}

type APIKeyRepository interface {
	ListAPIKeys(ctx context.Context) ([]store.APIKey, error)
	RevokeAPIKey(ctx context.Context, id string) (store.APIKey, bool, error)
}

type CredentialRepository interface {
	ListCredentials(ctx context.Context) ([]store.Credential, error)
	RotateCredential(ctx context.Context, id string) (store.Credential, bool, error)
}

type Repositories struct {
	Users        UserRepository
	Applications ApplicationRepository
	Roles        RoleRepository
	APIKeys      APIKeyRepository
	Credentials  CredentialRepository
}

func NewMemoryRepositories(st *store.Store) Repositories {
	return Repositories{
		Users:        NewMemoryUserRepository(st),
		Applications: NewMemoryApplicationRepository(st),
		Roles:        NewMemoryRoleRepository(st),
		APIKeys:      NewMemoryAPIKeyRepository(st),
		Credentials:  NewMemoryCredentialRepository(st),
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

func (repo MemoryUserRepository) ActivateUser(_ context.Context, id string) (store.User, bool, error) {
	user, ok := repo.store.ActivateUser(id)
	return user, ok, nil
}

type MemoryApplicationRepository struct {
	store *store.Store
}

func NewMemoryApplicationRepository(st *store.Store) MemoryApplicationRepository {
	return MemoryApplicationRepository{store: st}
}

func (repo MemoryApplicationRepository) ListApplications(context.Context) ([]store.Application, error) {
	return repo.store.ListApplications(), nil
}

func (repo MemoryApplicationRepository) CreateApplication(_ context.Context, input CreateApplicationInput) (store.Application, error) {
	return repo.store.CreateApplication(input.Name, input.Owner, input.Environment, input.DefaultRoute, input.Plan), nil
}

func (repo MemoryApplicationRepository) ActivateApplication(_ context.Context, id string) (store.Application, bool, error) {
	item, ok := repo.store.ActivateApplication(id)
	return item, ok, nil
}

func (repo MemoryApplicationRepository) RotateApplicationKey(_ context.Context, id string) (store.Application, bool, error) {
	item, ok := repo.store.RotateApplicationKey(id)
	return item, ok, nil
}

type MemoryRoleRepository struct {
	store *store.Store
}

func NewMemoryRoleRepository(st *store.Store) MemoryRoleRepository {
	return MemoryRoleRepository{store: st}
}

func (repo MemoryRoleRepository) ListRoles(context.Context) ([]store.RolePolicy, error) {
	return repo.store.ListRoles(), nil
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

func (repo MemoryAPIKeyRepository) RevokeAPIKey(_ context.Context, id string) (store.APIKey, bool, error) {
	key, ok := repo.store.RevokeAPIKey(id)
	return key, ok, nil
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

func (repo MemoryCredentialRepository) RotateCredential(_ context.Context, id string) (store.Credential, bool, error) {
	credential, ok := repo.store.RotateCredential(id)
	return credential, ok, nil
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

	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return store.User{}, fmt.Errorf("begin create user: %w", err)
	}
	defer tx.Rollback(ctx)

	var createdAt time.Time
	if err := tx.QueryRow(ctx, `
		insert into users(id, email, org, role, mfa, status)
		values($1, $2, $3, $4, $5, $6)
		returning created_at
	`, user.ID, user.Email, user.Org, user.Role, user.MFA, user.Status).Scan(&createdAt); err != nil {
		return store.User{}, fmt.Errorf("insert user: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		insert into ops_todos(id, title, source, owner, status)
		values($1, $2, $3, $4, $5)
	`, nextID("todo"), user.Email+" 完成首次登录", "用户与权限", user.Role, "Pending"); err != nil {
		return store.User{}, fmt.Errorf("insert user onboarding todo: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		insert into audit_events(id, module, action, object, status, request_id)
		values($1, $2, $3, $4, $5, $6)
	`, nextID("audit"), "用户与权限", "invite user", user.Email, "Success", nextID("req")); err != nil {
		return store.User{}, fmt.Errorf("insert user invite audit: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return store.User{}, fmt.Errorf("commit create user: %w", err)
	}

	user.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	return user, nil
}

func (repo PostgresUserRepository) ActivateUser(ctx context.Context, id string) (store.User, bool, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return store.User{}, false, fmt.Errorf("begin activate user: %w", err)
	}
	defer tx.Rollback(ctx)

	rows, err := tx.Query(ctx, `
		update users
		set mfa = 'Enabled', status = 'Active'
		where id = $1
		returning id, email, org, role, mfa, status, created_at
	`, id)
	if err != nil {
		return store.User{}, false, fmt.Errorf("activate user: %w", err)
	}
	defer rows.Close()

	user, err := pgx.CollectOneRow(rows, scanUser)
	if err != nil {
		if err == pgx.ErrNoRows {
			return store.User{}, false, nil
		}
		return store.User{}, false, fmt.Errorf("collect activated user: %w", err)
	}
	rows.Close()

	if _, err := tx.Exec(ctx, `
		update ops_todos
		set status = 'Resolved', updated_at = now()
		where title = $1
	`, user.Email+" 完成首次登录"); err != nil {
		return store.User{}, false, fmt.Errorf("resolve user onboarding todo: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		insert into audit_events(id, module, action, object, status, request_id)
		values($1, $2, $3, $4, $5, $6)
	`, nextID("audit"), "用户与权限", "activate user", user.Email, "Success", nextID("req")); err != nil {
		return store.User{}, false, fmt.Errorf("insert user activation audit: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return store.User{}, false, fmt.Errorf("commit activate user: %w", err)
	}

	return user, true, nil
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

type PostgresApplicationRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresApplicationRepository(pool *pgxpool.Pool) PostgresApplicationRepository {
	return PostgresApplicationRepository{pool: pool}
}

func (repo PostgresApplicationRepository) ListApplications(ctx context.Context) ([]store.Application, error) {
	rows, err := repo.pool.Query(ctx, `
		select id, name, owner, environment, api_key, default_route, plan, status, created_at
		from applications
		order by created_at desc
	`)
	if err != nil {
		return nil, fmt.Errorf("query applications: %w", err)
	}
	defer rows.Close()

	items, err := pgx.CollectRows(rows, scanApplication)
	if err != nil {
		return nil, fmt.Errorf("collect applications: %w", err)
	}

	return items, nil
}

func (repo PostgresApplicationRepository) CreateApplication(ctx context.Context, input CreateApplicationInput) (store.Application, error) {
	if input.Environment == "" {
		input.Environment = "Sandbox"
	}
	if input.DefaultRoute == "" {
		input.DefaultRoute = "/api/v1/llm/**"
	}
	if input.Plan == "" {
		input.Plan = "Free"
	}

	app := store.Application{
		ID:           fmt.Sprintf("app_%d", time.Now().UnixNano()),
		Name:         input.Name,
		Owner:        input.Owner,
		Environment:  input.Environment,
		APIKey:       fmt.Sprintf("ak_live_%d", time.Now().UnixNano()),
		DefaultRoute: input.DefaultRoute,
		Plan:         input.Plan,
		Status:       "Provisioning",
	}

	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return store.Application{}, fmt.Errorf("begin create application: %w", err)
	}
	defer tx.Rollback(ctx)

	var createdAt time.Time
	if err := tx.QueryRow(ctx, `
		insert into applications(id, name, owner, environment, api_key, default_route, plan, status)
		values($1, $2, $3, $4, $5, $6, $7, $8)
		returning created_at
	`, app.ID, app.Name, app.Owner, app.Environment, app.APIKey, app.DefaultRoute, app.Plan, app.Status).Scan(&createdAt); err != nil {
		return store.Application{}, fmt.Errorf("insert application: %w", err)
	}

	_, err = tx.Exec(ctx, `
		insert into api_keys(id, name, project, scope, status)
		values($1, $2, $3, $4, $5)
		on conflict (id) do nothing
	`, fmt.Sprintf("key_%d", time.Now().UnixNano()), app.APIKey, app.Name, "llm:chat skill:invoke", app.Status)
	if err != nil {
		return store.Application{}, fmt.Errorf("insert application api key: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return store.Application{}, fmt.Errorf("commit create application: %w", err)
	}

	app.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	return app, nil
}

func (repo PostgresApplicationRepository) ActivateApplication(ctx context.Context, id string) (store.Application, bool, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return store.Application{}, false, fmt.Errorf("begin activate application: %w", err)
	}
	defer tx.Rollback(ctx)

	rows, err := tx.Query(ctx, `
		update applications
		set status = 'Active'
		where id = $1
		returning id, name, owner, environment, api_key, default_route, plan, status, created_at
	`, id)
	if err != nil {
		return store.Application{}, false, fmt.Errorf("activate application: %w", err)
	}
	defer rows.Close()

	app, err := pgx.CollectOneRow(rows, scanApplication)
	if err != nil {
		if err == pgx.ErrNoRows {
			return store.Application{}, false, nil
		}
		return store.Application{}, false, fmt.Errorf("collect activated application: %w", err)
	}

	_, err = tx.Exec(ctx, `
		update api_keys
		set status = 'Active'
		where project = $1 or name = $2
	`, app.Name, app.APIKey)
	if err != nil {
		return store.Application{}, false, fmt.Errorf("activate application api key: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return store.Application{}, false, fmt.Errorf("commit activate application: %w", err)
	}

	return app, true, nil
}

func (repo PostgresApplicationRepository) RotateApplicationKey(ctx context.Context, id string) (store.Application, bool, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return store.Application{}, false, fmt.Errorf("begin rotate application key: %w", err)
	}
	defer tx.Rollback(ctx)

	rows, err := tx.Query(ctx, `
		select id, name, owner, environment, api_key, default_route, plan, status, created_at
		from applications
		where id = $1
	`, id)
	if err != nil {
		return store.Application{}, false, fmt.Errorf("query application for key rotation: %w", err)
	}
	defer rows.Close()

	app, err := pgx.CollectOneRow(rows, scanApplication)
	if err != nil {
		if err == pgx.ErrNoRows {
			return store.Application{}, false, nil
		}
		return store.Application{}, false, fmt.Errorf("collect application for key rotation: %w", err)
	}
	rows.Close()

	oldKey := app.APIKey
	app.APIKey = fmt.Sprintf("%s_rot_%d", oldKey, time.Now().Unix())

	rows, err = tx.Query(ctx, `
		update applications
		set api_key = $2
		where id = $1
		returning id, name, owner, environment, api_key, default_route, plan, status, created_at
	`, id, app.APIKey)
	if err != nil {
		return store.Application{}, false, fmt.Errorf("update application api key: %w", err)
	}
	defer rows.Close()

	app, err = pgx.CollectOneRow(rows, scanApplication)
	if err != nil {
		return store.Application{}, false, fmt.Errorf("collect rotated application: %w", err)
	}

	_, err = tx.Exec(ctx, `
		update api_keys
		set status = 'Rotated'
		where project = $1 or name = $2
	`, app.Name, oldKey)
	if err != nil {
		return store.Application{}, false, fmt.Errorf("mark old application api keys rotated: %w", err)
	}

	_, err = tx.Exec(ctx, `
		insert into api_keys(id, name, project, scope, status)
		values($1, $2, $3, $4, $5)
	`, fmt.Sprintf("key_%d", time.Now().UnixNano()), app.APIKey, app.Name, "llm:chat skill:invoke", "Active")
	if err != nil {
		return store.Application{}, false, fmt.Errorf("insert rotated application api key: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return store.Application{}, false, fmt.Errorf("commit rotate application key: %w", err)
	}

	return app, true, nil
}

func scanApplication(row pgx.CollectableRow) (store.Application, error) {
	var item store.Application
	var createdAt time.Time
	if err := row.Scan(
		&item.ID,
		&item.Name,
		&item.Owner,
		&item.Environment,
		&item.APIKey,
		&item.DefaultRoute,
		&item.Plan,
		&item.Status,
		&createdAt,
	); err != nil {
		return store.Application{}, err
	}
	item.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	return item, nil
}

type PostgresRoleRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresRoleRepository(pool *pgxpool.Pool) PostgresRoleRepository {
	return PostgresRoleRepository{pool: pool}
}

func (repo PostgresRoleRepository) ListRoles(ctx context.Context) ([]store.RolePolicy, error) {
	rows, err := repo.pool.Query(ctx, `
		select id, name, visible_entries, config_scope, restriction, status
		from role_policies
		order by name asc
	`)
	if err != nil {
		return nil, fmt.Errorf("query role policies: %w", err)
	}
	defer rows.Close()

	items, err := pgx.CollectRows(rows, scanRolePolicy)
	if err != nil {
		return nil, fmt.Errorf("collect role policies: %w", err)
	}

	return items, nil
}

func scanRolePolicy(row pgx.CollectableRow) (store.RolePolicy, error) {
	var item store.RolePolicy
	if err := row.Scan(&item.ID, &item.Name, &item.VisibleEntries, &item.ConfigScope, &item.Restriction, &item.Status); err != nil {
		return store.RolePolicy{}, err
	}
	return item, nil
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

func (repo PostgresAPIKeyRepository) RevokeAPIKey(ctx context.Context, id string) (store.APIKey, bool, error) {
	rows, err := repo.pool.Query(ctx, `
		update api_keys
		set status = 'Revoked'
		where id = $1
		returning id, name, project, scope, coalesce(expires_at::text, ''), status
	`, id)
	if err != nil {
		return store.APIKey{}, false, fmt.Errorf("revoke api key: %w", err)
	}
	defer rows.Close()

	key, err := pgx.CollectOneRow(rows, scanAPIKey)
	if err != nil {
		if err == pgx.ErrNoRows {
			return store.APIKey{}, false, nil
		}
		return store.APIKey{}, false, fmt.Errorf("collect revoked api key: %w", err)
	}

	return key, true, nil
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

func (repo PostgresCredentialRepository) RotateCredential(ctx context.Context, id string) (store.Credential, bool, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return store.Credential{}, false, fmt.Errorf("begin rotate credential: %w", err)
	}
	defer tx.Rollback(ctx)

	rows, err := tx.Query(ctx, `
		select id, ref, purpose, scope, coalesce(expires_at::text, ''), status, masked_preview
		from credentials
		where id = $1
	`, id)
	if err != nil {
		return store.Credential{}, false, fmt.Errorf("query credential for rotation: %w", err)
	}
	defer rows.Close()

	old, err := pgx.CollectOneRow(rows, scanCredential)
	if err != nil {
		if err == pgx.ErrNoRows {
			return store.Credential{}, false, nil
		}
		return store.Credential{}, false, fmt.Errorf("collect credential for rotation: %w", err)
	}
	rows.Close()

	_, err = tx.Exec(ctx, `
		update credentials
		set status = 'Rotated'
		where id = $1
	`, id)
	if err != nil {
		return store.Credential{}, false, fmt.Errorf("mark credential rotated: %w", err)
	}

	credential := store.Credential{
		ID:            fmt.Sprintf("cred_%d", time.Now().UnixNano()),
		Ref:           fmt.Sprintf("%s.rot.%d", old.Ref, time.Now().Unix()),
		Purpose:       old.Purpose,
		Scope:         old.Scope,
		ExpiresAt:     old.ExpiresAt,
		Status:        "Active",
		MaskedPreview: "sk-****-rot",
	}

	if _, err := tx.Exec(ctx, `
		insert into credentials(id, ref, purpose, scope, expires_at, status, masked_preview)
		values($1, $2, $3, $4, nullif($5, '')::date, $6, $7)
	`, credential.ID, credential.Ref, credential.Purpose, credential.Scope, credential.ExpiresAt, credential.Status, credential.MaskedPreview); err != nil {
		return store.Credential{}, false, fmt.Errorf("insert rotated credential: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return store.Credential{}, false, fmt.Errorf("commit rotate credential: %w", err)
	}

	return credential, true, nil
}

func scanCredential(row pgx.CollectableRow) (store.Credential, error) {
	var item store.Credential
	if err := row.Scan(&item.ID, &item.Ref, &item.Purpose, &item.Scope, &item.ExpiresAt, &item.Status, &item.MaskedPreview); err != nil {
		return store.Credential{}, err
	}
	return item, nil
}

func nextID(prefix string) string {
	return fmt.Sprintf("%s_%d", prefix, time.Now().UnixNano())
}
