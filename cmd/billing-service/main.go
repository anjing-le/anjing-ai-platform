package main

import (
	"context"
	"net/http"

	"github.com/anjing-le/anjing-ai-platform/internal/billing"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/config"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/db"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/service"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
)

func main() {
	cfg := config.Load("billing-service", "1822")
	st := store.NewSeedStore()
	billingRegister := billing.Register

	if cfg.DatabaseURL != "" {
		pool, err := db.Open(context.Background(), cfg.DatabaseURL)
		if err != nil {
			panic(err)
		}
		defer pool.Close()
		plans := billing.NewPostgresPlanRepository(pool)
		billingRegister = func(mux *http.ServeMux, st *store.Store) {
			billing.RegisterWithPlans(mux, st, plans)
		}
	}

	mux := service.NewMux(cfg.ServiceName, st, billingRegister)
	if err := service.Listen(cfg.Addr, cfg.ServiceName, mux); err != nil {
		panic(err)
	}
}
