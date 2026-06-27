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
	gatewayRegister := func(mux *http.ServeMux, st *store.Store) {
		gateway.RegisterWithOptions(mux, st, gatewayOptions)
	}

	if cfg.DatabaseURL != "" {
		pool, err := db.Open(context.Background(), cfg.DatabaseURL)
		if err != nil {
			service.Fatal(logger, "open database failed", err)
		}
		defer pool.Close()
		repos := gateway.NewMemoryRepositories(st)
		repos.Routes = gateway.NewPostgresRouteRepository(pool)
		repos.ModelRoutes = gateway.NewPostgresModelRouteRepository(pool)
		skillRepo := gateway.NewPostgresSkillRepository(pool)
		repos.Skills = skillRepo
		repos.SkillSchemas = skillRepo
		repos.RequestLogs = gateway.NewPostgresRequestLogRepository(pool)
		repos.Invocations = gateway.NewPostgresInvocationRecorder(pool)
		repos.ProxyRequests = gateway.NewPostgresProxyRecorder(pool)
		gatewayRegister = func(mux *http.ServeMux, st *store.Store) {
			gateway.RegisterWithRepositoriesAndOptions(mux, st, repos, gatewayOptions)
		}
	}

	mux := service.NewMux(cfg.ServiceName, st, gatewayRegister)
	authConfig := service.AccessConfigWithSessions(sessions)
	if err := service.ListenWithAccessConfig(logger, cfg.Addr, cfg.ServiceName, mux, authConfig); err != nil {
		service.Fatal(logger, "service stopped", err)
	}
}
