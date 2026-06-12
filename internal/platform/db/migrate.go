package db

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

func RunMigrations(ctx context.Context, pool *pgxpool.Pool, migrationsDir string) ([]string, error) {
	if migrationsDir == "" {
		return nil, fmt.Errorf("migrations dir is required")
	}

	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		return nil, fmt.Errorf("read migrations dir: %w", err)
	}

	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}
		names = append(names, entry.Name())
	}
	sort.Strings(names)

	if _, err := pool.Exec(ctx, `
		create table if not exists schema_migrations (
			version text primary key,
			applied_at timestamptz not null default now()
		)
	`); err != nil {
		return nil, fmt.Errorf("ensure schema_migrations: %w", err)
	}

	applied := make([]string, 0, len(names))
	for _, name := range names {
		changed, err := applyMigration(ctx, pool, migrationsDir, name)
		if err != nil {
			return applied, err
		}
		if changed {
			applied = append(applied, name)
		}
	}

	return applied, nil
}

func applyMigration(ctx context.Context, pool *pgxpool.Pool, migrationsDir, name string) (bool, error) {
	var exists bool
	if err := pool.QueryRow(ctx, "select exists(select 1 from schema_migrations where version = $1)", name).Scan(&exists); err != nil {
		return false, fmt.Errorf("check migration %s: %w", name, err)
	}
	if exists {
		return false, nil
	}

	content, err := os.ReadFile(filepath.Join(migrationsDir, name))
	if err != nil {
		return false, fmt.Errorf("read migration %s: %w", name, err)
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return false, fmt.Errorf("begin migration %s: %w", name, err)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, string(content)); err != nil {
		return false, fmt.Errorf("apply migration %s: %w", name, err)
	}

	if _, err := tx.Exec(ctx, "insert into schema_migrations(version) values($1)", name); err != nil {
		return false, fmt.Errorf("record migration %s: %w", name, err)
	}

	if err := tx.Commit(ctx); err != nil {
		return false, fmt.Errorf("commit migration %s: %w", name, err)
	}

	return true, nil
}
