package main

import (
	"context"
	"net/http"

	"github.com/anjing-le/anjing-ai-platform/internal/billing"
	"github.com/anjing-le/anjing-ai-platform/internal/consoleweb"
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
	cfg := config.Load("platform-all", "18080")
	logger := service.NewLogger()
	st := store.NewSeedStore()
	controlRegister := control.Register
	gatewayRegister := gateway.Register
	billingRegister := billing.Register
	opsRegister := ops.Register

	if cfg.DatabaseURL != "" {
		pool, err := db.Open(context.Background(), cfg.DatabaseURL)
		if err != nil {
			service.Fatal(logger, "open database failed", err)
		}
		defer pool.Close()
		controlRepos := control.NewMemoryRepositories(st)
		controlRepos.Users = control.NewPostgresUserRepository(pool)
		controlRepos.Applications = control.NewPostgresApplicationRepository(pool)
		controlRepos.Roles = control.NewPostgresRoleRepository(pool)
		controlRepos.APIKeys = control.NewPostgresAPIKeyRepository(pool)
		controlRepos.Credentials = control.NewPostgresCredentialRepository(pool)
		controlRegister = func(mux *http.ServeMux, st *store.Store) {
			control.RegisterWithRepositories(mux, st, controlRepos)
		}
		gatewayRepos := gateway.NewMemoryRepositories(st)
		gatewayRepos.Routes = gateway.NewPostgresRouteRepository(pool)
		gatewayRepos.ModelRoutes = gateway.NewPostgresModelRouteRepository(pool)
		gatewayRepos.Skills = gateway.NewPostgresSkillRepository(pool)
		gatewayRepos.RequestLogs = gateway.NewPostgresRequestLogRepository(pool)
		gatewayRepos.Invocations = gateway.NewPostgresInvocationRecorder(pool)
		gatewayRegister = func(mux *http.ServeMux, st *store.Store) {
			gateway.RegisterWithRepositories(mux, st, gatewayRepos)
		}
		billingRepos := billing.NewMemoryRepositories(st)
		billingRepos.Plans = billing.NewPostgresPlanRepository(pool)
		billingRepos.Usage = billing.NewPostgresUsageRepository(pool)
		billingRepos.BudgetAlerts = billing.NewPostgresBudgetAlertRepository(pool)
		billingRegister = func(mux *http.ServeMux, st *store.Store) {
			billing.RegisterWithRepositories(mux, st, billingRepos)
		}
		opsRepos := ops.NewMemoryRepositories(st)
		opsRepos.Todos = ops.NewPostgresTodoRepository(pool)
		opsRepos.Health = ops.NewPostgresHealthRepository(pool)
		opsRepos.Audit = ops.NewPostgresAuditRepository(pool)
		opsRepos.Snapshot = platformsnapshot.NewRepository(platformsnapshot.Sources{
			Users:        controlRepos.Users,
			Applications: controlRepos.Applications,
			Roles:        controlRepos.Roles,
			APIKeys:      controlRepos.APIKeys,
			Credentials:  controlRepos.Credentials,
			Routes:       gatewayRepos.Routes,
			ModelRoutes:  gatewayRepos.ModelRoutes,
			Skills:       gatewayRepos.Skills,
			RequestLogs:  gatewayRepos.RequestLogs,
			Plans:        billingRepos.Plans,
			Usage:        billingRepos.Usage,
			BudgetAlerts: billingRepos.BudgetAlerts,
			Todos:        opsRepos.Todos,
			Health:       opsRepos.Health,
			Audit:        opsRepos.Audit,
		})
		opsRegister = func(mux *http.ServeMux, st *store.Store) {
			ops.RegisterWithRepositories(mux, st, opsRepos)
		}
	}

	mux := service.NewMux(cfg.ServiceName, st,
		controlRegister,
		gatewayRegister,
		billingRegister,
		opsRegister,
	)
	consoleweb.Register(mux, cfg.StaticDir)
	if err := service.ListenWithLogger(logger, cfg.Addr, cfg.ServiceName, mux); err != nil {
		service.Fatal(logger, "service stopped", err)
	}
}
