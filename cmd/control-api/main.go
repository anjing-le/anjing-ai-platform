package main

import (
	"context"
	"net/http"

	"github.com/anjing-le/anjing-ai-platform/internal/control"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/config"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/db"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/service"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
)

func main() {
	cfg := config.Load("control-api", "1820")
	st := store.NewSeedStore()
	controlRegister := control.Register

	if cfg.DatabaseURL != "" {
		pool, err := db.Open(context.Background(), cfg.DatabaseURL)
		if err != nil {
			panic(err)
		}
		defer pool.Close()
		repos := control.NewMemoryRepositories(st)
		repos.Users = control.NewPostgresUserRepository(pool)
		repos.Applications = control.NewPostgresApplicationRepository(pool)
		repos.Roles = control.NewPostgresRoleRepository(pool)
		repos.APIKeys = control.NewPostgresAPIKeyRepository(pool)
		repos.Credentials = control.NewPostgresCredentialRepository(pool)
		controlRegister = func(mux *http.ServeMux, st *store.Store) {
			control.RegisterWithRepositories(mux, st, repos)
		}
	}

	mux := service.NewMux(cfg.ServiceName, st, controlRegister)
	if err := service.Listen(cfg.Addr, cfg.ServiceName, mux); err != nil {
		panic(err)
	}
}
