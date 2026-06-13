package main

import (
	"github.com/anjing-le/anjing-ai-platform/internal/consoleweb"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/config"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/service"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
)

func main() {
	cfg := config.Load("console-web", "1818")
	logger := service.NewLogger()
	st := store.NewSeedStore()
	mux := service.NewMux(cfg.ServiceName, st)
	consoleweb.Register(mux, cfg.StaticDir)
	if err := service.ListenWithLogger(logger, cfg.Addr, cfg.ServiceName, mux); err != nil {
		service.Fatal(logger, "service stopped", err)
	}
}
