package main

import (
	"context"
	"net/http"

	"github.com/anjing-le/anjing-ai-platform/internal/ops"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/config"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/db"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/service"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
)

func main() {
	cfg := config.Load("ops-api", "1823")
	st := store.NewSeedStore()
	opsRegister := ops.Register

	if cfg.DatabaseURL != "" {
		pool, err := db.Open(context.Background(), cfg.DatabaseURL)
		if err != nil {
			panic(err)
		}
		defer pool.Close()
		todos := ops.NewPostgresTodoRepository(pool)
		opsRegister = func(mux *http.ServeMux, st *store.Store) {
			ops.RegisterWithTodos(mux, st, todos)
		}
	}

	mux := service.NewMux(cfg.ServiceName, st, opsRegister)
	if err := service.Listen(cfg.Addr, cfg.ServiceName, mux); err != nil {
		panic(err)
	}
}
