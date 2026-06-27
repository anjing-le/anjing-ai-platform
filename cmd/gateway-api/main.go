package main

import (
	"context"
	"net/http"

	"github.com/anjing-le/anjing-ai-platform/internal/gateway"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/config"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/db"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/service"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
)

func main() {
	cfg := config.Load("gateway-api", "1821")
	logger := service.NewLogger()
	st := store.NewSeedStore()
	sessions := service.NewSessionManager()
	gatewayRegister := gateway.Register

	if cfg.DatabaseURL != "" {
		pool, err := db.Open(context.Background(), cfg.DatabaseURL)
		if err != nil {
			service.Fatal(logger, "open database failed", err)
		}
		defer pool.Close()
		repos := gateway.NewMemoryRepositories(st)
		repos.Routes = gateway.NewPostgresRouteRepository(pool)
		repos.ModelRoutes = gateway.NewPostgresModelRouteRepository(pool)
		repos.Skills = gateway.NewPostgresSkillRepository(pool)
		repos.RequestLogs = gateway.NewPostgresRequestLogRepository(pool)
		repos.Invocations = gateway.NewPostgresInvocationRecorder(pool)
		repos.ProxyRequests = gateway.NewPostgresProxyRecorder(pool)
		gatewayRegister = func(mux *http.ServeMux, st *store.Store) {
			gateway.RegisterWithRepositories(mux, st, repos)
		}
	}

	mux := service.NewMux(cfg.ServiceName, st, gatewayRegister)
	authConfig := service.AccessConfigWithSessions(sessions)
	if err := service.ListenWithAccessConfig(logger, cfg.Addr, cfg.ServiceName, mux, authConfig); err != nil {
		service.Fatal(logger, "service stopped", err)
	}
}
