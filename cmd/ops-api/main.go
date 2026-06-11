package main

import (
	"github.com/anjing-le/anjing-ai-platform/internal/ops"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/config"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/service"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
)

func main() {
	cfg := config.Load("ops-api", "1823")
	st := store.NewSeedStore()
	mux := service.NewMux(cfg.ServiceName, st, ops.Register)
	if err := service.Listen(cfg.Addr, cfg.ServiceName, mux); err != nil {
		panic(err)
	}
}
