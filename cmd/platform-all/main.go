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
	sessions := service.NewSessionManager()
	limiter, closeLimiter, err := gateway.NewRouteLimiter(gateway.LimiterRuntimeConfig{
		Backend:       cfg.RateLimitBackend,
		RedisAddr:     cfg.RedisAddr,
		RedisPassword: cfg.RedisPassword,
		RedisDB:       cfg.RedisDB,
	})
	if err != nil {
		service.Fatal(logger, "configure gateway rate limiter failed", err)
	}
	defer func() {
		if err := closeLimiter(); err != nil {
			logger.Error("close gateway rate limiter failed", "error", err)
		}
	}()
	gatewayOptions := gateway.Options{RateLimiter: limiter}
	controlRegister := func(mux *http.ServeMux, st *store.Store) {
		control.RegisterWithOptions(mux, st, control.Options{Sessions: sessions})
	}
	gatewayRegister := func(mux *http.ServeMux, st *store.Store) {
		gateway.RegisterWithOptions(mux, st, gatewayOptions)
	}
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
			control.RegisterWithRepositoriesAndOptions(mux, st, controlRepos, control.Options{Sessions: sessions})
		}
		gatewayRepos := gateway.NewMemoryRepositories(st)
		gatewayRepos.Routes = gateway.NewPostgresRouteRepository(pool)
		gatewayRepos.ModelRoutes = gateway.NewPostgresModelRouteRepository(pool)
		gatewayRepos.Skills = gateway.NewPostgresSkillRepository(pool)
		gatewayRepos.RequestLogs = gateway.NewPostgresRequestLogRepository(pool)
		gatewayRepos.Invocations = gateway.NewPostgresInvocationRecorder(pool)
		gatewayRepos.ProxyRequests = gateway.NewPostgresProxyRecorder(pool)
		gatewayRegister = func(mux *http.ServeMux, st *store.Store) {
			gateway.RegisterWithRepositoriesAndOptions(mux, st, gatewayRepos, gatewayOptions)
		}
		billingRepos := billing.NewMemoryRepositories(st)
		billingRepos.Plans = billing.NewPostgresPlanRepository(pool)
		billingRepos.Usage = billing.NewPostgresUsageRepository(pool)
		billingRepos.BudgetAlerts = billing.NewPostgresBudgetAlertRepository(pool)
		billingRepos.Invoices = billing.NewPostgresInvoiceRepository(pool)
		billingRegister = func(mux *http.ServeMux, st *store.Store) {
			billing.RegisterWithRepositories(mux, st, billingRepos)
		}
		opsRepos := ops.NewMemoryRepositories(st)
		opsRepos.Todos = ops.NewPostgresTodoRepository(pool)
		opsRepos.Health = ops.NewPostgresHealthRepository(pool)
		opsRepos.Audit = ops.NewPostgresAuditRepository(pool)
		opsRepos.Snapshot = platformsnapshot.NewRepository(platformsnapshot.Sources{
			Users:            controlRepos.Users,
			Applications:     controlRepos.Applications,
			Roles:            controlRepos.Roles,
			APIKeys:          controlRepos.APIKeys,
			Credentials:      controlRepos.Credentials,
			Routes:           gatewayRepos.Routes,
			ModelRoutes:      gatewayRepos.ModelRoutes,
			Skills:           gatewayRepos.Skills,
			RequestLogs:      gatewayRepos.RequestLogs,
			Plans:            billingRepos.Plans,
			Usage:            billingRepos.Usage,
			BudgetAlerts:     billingRepos.BudgetAlerts,
			BillingSummaries: billingRepos.Invoices,
			Todos:            opsRepos.Todos,
			Health:           opsRepos.Health,
			Audit:            opsRepos.Audit,
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
	authConfig := service.AccessConfigWithSessions(sessions)
	if err := service.ListenWithAccessConfig(logger, cfg.Addr, cfg.ServiceName, mux, authConfig); err != nil {
		service.Fatal(logger, "service stopped", err)
	}
}
