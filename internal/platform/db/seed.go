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

func RunSQLFiles(ctx context.Context, pool *pgxpool.Pool, dir string) ([]string, error) {
	if dir == "" {
		return nil, fmt.Errorf("sql dir is required")
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("read sql dir: %w", err)
	}

	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}
		names = append(names, entry.Name())
	}
	sort.Strings(names)

	applied := make([]string, 0, len(names))
	for _, name := range names {
		if err := runSQLFile(ctx, pool, dir, name); err != nil {
			return applied, err
		}
		applied = append(applied, name)
	}

	return applied, nil
}

func runSQLFile(ctx context.Context, pool *pgxpool.Pool, dir, name string) error {
	content, err := os.ReadFile(filepath.Join(dir, name))
	if err != nil {
		return fmt.Errorf("read sql file %s: %w", name, err)
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin sql file %s: %w", name, err)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, string(content)); err != nil {
		return fmt.Errorf("apply sql file %s: %w", name, err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit sql file %s: %w", name, err)
	}

	return nil
}
