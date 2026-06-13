package main

import (
	"context"
	"log/slog"
	"os"
	"time"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/config"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/db"
)

func main() {
	cfg := config.Load("seed-db", "0")
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("open database failed", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	applied, err := db.RunSQLFiles(ctx, pool, cfg.SeedsDir)
	if err != nil {
		logger.Error("run seed files failed", "error", err)
		os.Exit(1)
	}

	logger.Info("seed files complete", "applied", applied, "count", len(applied))
}
