package gateway

import (
	"fmt"
	"strings"
)

type LimiterRuntimeConfig struct {
	Backend       string
	RedisAddr     string
	RedisPassword string
	RedisDB       int
}

func NewRouteLimiter(config LimiterRuntimeConfig) (RouteLimiter, func() error, error) {
	backend := strings.ToLower(strings.TrimSpace(config.Backend))
	if backend == "" || backend == "memory" {
		return NewMemoryRouteLimiter(), func() error { return nil }, nil
	}
	if backend != "redis" {
		return nil, nil, fmt.Errorf("unsupported gateway rate limit backend %q", config.Backend)
	}

	limiter, err := NewRedisRouteLimiter(RedisRouteLimiterConfig{
		Addr:     config.RedisAddr,
		Password: config.RedisPassword,
		DB:       config.RedisDB,
	})
	if err != nil {
		return nil, nil, err
	}

	return limiter, limiter.Close, nil
}
