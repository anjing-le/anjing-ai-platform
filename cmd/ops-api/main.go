package main

import (
	"context"
	"net/http"

	"github.com/anjing-le/anjing-ai-platform/internal/billing"
	"github.com/anjing-le/anjing-ai-platform/internal/control"
	"github.com/anjing-le/anjing-ai-platform/internal/gateway"
	"github.com/anjing-le/anjing-ai-platform/internal/ops"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/config"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/db"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/service"
	platformsnapshot "github.com/anjing-le/anjing-ai-platform/internal/platform/snapshot"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
)

func main() {
	cfg := config.Load("ops-api", "1823")
	logger := service.NewLogger()
	st := store.NewSeedStore()
	opsRegister := ops.Register

	if cfg.DatabaseURL != "" {
		pool, err := db.Open(context.Background(), cfg.DatabaseURL)
		if err != nil {
			service.Fatal(logger, "open database failed", err)
		}
		defer pool.Close()
		repos := ops.NewMemoryRepositories(st)
		repos.Todos = ops.NewPostgresTodoRepository(pool)
		repos.Health = ops.NewPostgresHealthRepository(pool)
		repos.Audit = ops.NewPostgresAuditRepository(pool)
		repos.Snapshot = platformsnapshot.NewRepository(platformsnapshot.Sources{
			Users:        control.NewPostgresUserRepository(pool),
			Applications: control.NewPostgresApplicationRepository(pool),
			Roles:        control.NewPostgresRoleRepository(pool),
			APIKeys:      control.NewPostgresAPIKeyRepository(pool),
			Credentials:  control.NewPostgresCredentialRepository(pool),
			Routes:       gateway.NewPostgresRouteRepository(pool),
			ModelRoutes:  gateway.NewPostgresModelRouteRepository(pool),
			Skills:       gateway.NewPostgresSkillRepository(pool),
			RequestLogs:  gateway.NewPostgresRequestLogRepository(pool),
			Plans:        billing.NewPostgresPlanRepository(pool),
			Usage:        billing.NewPostgresUsageRepository(pool),
			BudgetAlerts: billing.NewPostgresBudgetAlertRepository(pool),
			Todos:        repos.Todos,
			Health:       repos.Health,
			Audit:        repos.Audit,
		})
		opsRegister = func(mux *http.ServeMux, st *store.Store) {
			ops.RegisterWithRepositories(mux, st, repos)
		}
	}

	mux := service.NewMux(cfg.ServiceName, st, opsRegister)
	if err := service.ListenWithLogger(logger, cfg.Addr, cfg.ServiceName, mux); err != nil {
		service.Fatal(logger, "service stopped", err)
	}
}
