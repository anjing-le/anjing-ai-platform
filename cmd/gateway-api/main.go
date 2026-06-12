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
	st := store.NewSeedStore()
	gatewayRegister := gateway.Register

	if cfg.DatabaseURL != "" {
		pool, err := db.Open(context.Background(), cfg.DatabaseURL)
		if err != nil {
			panic(err)
		}
		defer pool.Close()
		routes := gateway.NewPostgresRouteRepository(pool)
		gatewayRegister = func(mux *http.ServeMux, st *store.Store) {
			gateway.RegisterWithRoutes(mux, st, routes)
		}
	}

	mux := service.NewMux(cfg.ServiceName, st, gatewayRegister)
	if err := service.Listen(cfg.Addr, cfg.ServiceName, mux); err != nil {
		panic(err)
	}
}
