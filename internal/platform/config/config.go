package config

import (
	"fmt"
	"os"
)

type Config struct {
	ServiceName string
	Addr        string
	StaticDir   string
}

func Load(serviceName, defaultPort string) Config {
	return Config{
		ServiceName: serviceName,
		Addr:        env("ANJING_ADDR", fmt.Sprintf(":%s", defaultPort)),
		StaticDir:   env("ANJING_CONSOLE_DIST", "frontend/admin-console/dist"),
	}
}

func env(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}
