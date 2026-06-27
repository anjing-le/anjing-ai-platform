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
	logger := service.NewLogger()
	st := store.NewSeedStore()
	sessions := service.NewSessionManager()
	controlRegister := func(mux *http.ServeMux, st *store.Store) {
		control.RegisterWithOptions(mux, st, control.Options{Sessions: sessions})
	}

	if cfg.DatabaseURL != "" {
		pool, err := db.Open(context.Background(), cfg.DatabaseURL)
		if err != nil {
			service.Fatal(logger, "open database failed", err)
		}
		defer pool.Close()
		repos := control.NewMemoryRepositories(st)
		repos.Users = control.NewPostgresUserRepository(pool)
		repos.Applications = control.NewPostgresApplicationRepository(pool)
		repos.Roles = control.NewPostgresRoleRepository(pool)
		repos.APIKeys = control.NewPostgresAPIKeyRepository(pool)
		repos.Credentials = control.NewPostgresCredentialRepository(pool)
		controlRegister = func(mux *http.ServeMux, st *store.Store) {
			control.RegisterWithRepositoriesAndOptions(mux, st, repos, control.Options{Sessions: sessions})
		}
	}

	mux := service.NewMux(cfg.ServiceName, st, controlRegister)
	authConfig := service.AccessConfigWithSessions(sessions)
	if err := service.ListenWithAccessConfig(logger, cfg.Addr, cfg.ServiceName, mux, authConfig); err != nil {
		service.Fatal(logger, "service stopped", err)
	}
}
