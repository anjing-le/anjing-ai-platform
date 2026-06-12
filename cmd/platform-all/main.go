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

	if cfg.DatabaseURL != "" {
		pool, err := db.Open(context.Background(), cfg.DatabaseURL)
		if err != nil {
			panic(err)
		}
		defer pool.Close()
		users := control.NewPostgresUserRepository(pool)
		controlRegister = func(mux *http.ServeMux, st *store.Store) {
			control.RegisterWithUsers(mux, st, users)
		}
	}

	mux := service.NewMux(cfg.ServiceName, st,
		controlRegister,
		gateway.Register,
		billing.Register,
		ops.Register,
	)
	consoleweb.Register(mux, cfg.StaticDir)
	if err := service.Listen(cfg.Addr, cfg.ServiceName, mux); err != nil {
		panic(err)
	}
}
