package config

import (
	"fmt"
	"os"
)

type Config struct {
	ServiceName   string
	Addr          string
	StaticDir     string
	DatabaseURL   string
	MigrationsDir string
}

func Load(serviceName, defaultPort string) Config {
	return Config{
		ServiceName:   serviceName,
		Addr:          env("ANJING_ADDR", fmt.Sprintf(":%s", defaultPort)),
		StaticDir:     env("ANJING_CONSOLE_DIST", "apps/console/dist"),
		DatabaseURL:   env("ANJING_DATABASE_URL", ""),
		MigrationsDir: env("ANJING_MIGRATIONS_DIR", "infra/postgres/migrations"),
	}
}

func env(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}
