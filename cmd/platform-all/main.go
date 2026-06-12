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
	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
)

func main() {
	cfg := config.Load("platform-all", "18080")
	st := store.NewSeedStore()
	controlRegister := control.Register
	gatewayRegister := gateway.Register
	billingRegister := billing.Register
	opsRegister := ops.Register

	if cfg.DatabaseURL != "" {
		pool, err := db.Open(context.Background(), cfg.DatabaseURL)
		if err != nil {
			panic(err)
		}
		defer pool.Close()
		controlRepos := control.NewMemoryRepositories(st)
		controlRepos.Users = control.NewPostgresUserRepository(pool)
		controlRepos.Roles = control.NewPostgresRoleRepository(pool)
		controlRepos.APIKeys = control.NewPostgresAPIKeyRepository(pool)
		controlRepos.Credentials = control.NewPostgresCredentialRepository(pool)
		controlRegister = func(mux *http.ServeMux, st *store.Store) {
			control.RegisterWithRepositories(mux, st, controlRepos)
		}
		routes := gateway.NewPostgresRouteRepository(pool)
		gatewayRegister = func(mux *http.ServeMux, st *store.Store) {
			gateway.RegisterWithRoutes(mux, st, routes)
		}
		plans := billing.NewPostgresPlanRepository(pool)
		billingRegister = func(mux *http.ServeMux, st *store.Store) {
			billing.RegisterWithPlans(mux, st, plans)
		}
		todos := ops.NewPostgresTodoRepository(pool)
		opsRegister = func(mux *http.ServeMux, st *store.Store) {
			ops.RegisterWithTodos(mux, st, todos)
		}
	}

	mux := service.NewMux(cfg.ServiceName, st,
		controlRegister,
		gatewayRegister,
		billingRegister,
		opsRegister,
	)
	consoleweb.Register(mux, cfg.StaticDir)
	if err := service.Listen(cfg.Addr, cfg.ServiceName, mux); err != nil {
		panic(err)
	}
}
