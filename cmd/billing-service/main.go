package main

import (
	"github.com/anjing-le/anjing-ai-platform/internal/billing"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/config"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/service"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
)

func main() {
	cfg := config.Load("billing-service", "1822")
	st := store.NewSeedStore()
	mux := service.NewMux(cfg.ServiceName, st, billing.Register)
	if err := service.Listen(cfg.Addr, cfg.ServiceName, mux); err != nil {
		panic(err)
	}
}
