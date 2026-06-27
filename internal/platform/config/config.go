package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	ServiceName      string
	Addr             string
	StaticDir        string
	DatabaseURL      string
	MigrationsDir    string
	SeedsDir         string
	RateLimitBackend string
	RedisAddr        string
	RedisPassword    string
	RedisDB          int
}

func Load(serviceName, defaultPort string) Config {
	return Config{
		ServiceName:      serviceName,
		Addr:             env("ANJING_ADDR", fmt.Sprintf(":%s", defaultPort)),
		StaticDir:        env("ANJING_CONSOLE_DIST", "apps/console/dist"),
		DatabaseURL:      env("ANJING_DATABASE_URL", ""),
		MigrationsDir:    env("ANJING_MIGRATIONS_DIR", "infra/postgres/migrations"),
		SeedsDir:         env("ANJING_SEEDS_DIR", "infra/postgres/seeds"),
		RateLimitBackend: env("ANJING_RATE_LIMIT_BACKEND", "memory"),
		RedisAddr:        env("ANJING_REDIS_ADDR", "localhost:6379"),
		RedisPassword:    env("ANJING_REDIS_PASSWORD", ""),
		RedisDB:          envInt("ANJING_REDIS_DB", 0),
	}
}

func env(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func envInt(key string, fallback int) int {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}
