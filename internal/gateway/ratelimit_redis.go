package gateway

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	defaultRedisRateLimitKeyPrefix = "anjing:gateway:rate-limit"
	defaultRedisRateLimitTimeout   = 500 * time.Millisecond
)

var redisRateLimitScript = redis.NewScript(`
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
return current
`)

type RedisRouteLimiterConfig struct {
	Addr      string
	Password  string
	DB        int
	KeyPrefix string
	Timeout   time.Duration
	Fallback  RouteLimiter
}

type RedisRouteLimiter struct {
	client    *redis.Client
	keyPrefix string
	timeout   time.Duration
	fallback  RouteLimiter
	now       func() time.Time
}

func NewRedisRouteLimiter(config RedisRouteLimiterConfig) (*RedisRouteLimiter, error) {
	addr := strings.TrimSpace(config.Addr)
	if addr == "" {
		return nil, fmt.Errorf("redis addr is required")
	}

	keyPrefix := strings.TrimSpace(config.KeyPrefix)
	if keyPrefix == "" {
		keyPrefix = defaultRedisRateLimitKeyPrefix
	}

	timeout := config.Timeout
	if timeout <= 0 {
		timeout = defaultRedisRateLimitTimeout
	}

	fallback := config.Fallback
	if fallback == nil {
		fallback = NewMemoryRouteLimiter()
	}

	client := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: config.Password,
		DB:       config.DB,
	})

	return &RedisRouteLimiter{
		client:    client,
		keyPrefix: keyPrefix,
		timeout:   timeout,
		fallback:  fallback,
		now:       time.Now,
	}, nil
}

func (limiter *RedisRouteLimiter) Allow(ctx context.Context, routePattern string, limitValue string) RateLimitDecision {
	config, ok := parseGatewayRateLimit(limitValue)
	if limiter == nil || limiter.client == nil || strings.TrimSpace(routePattern) == "" || !ok {
		return RateLimitDecision{Allowed: true}
	}

	now := limiter.now()
	windowStart := now.Truncate(config.Window)
	retryAfter := windowStart.Add(config.Window).Sub(now)
	if retryAfter < time.Second {
		retryAfter = time.Second
	}

	if ctx == nil {
		ctx = context.Background()
	}
	redisCtx, cancel := context.WithTimeout(ctx, limiter.timeout)
	defer cancel()

	key := redisRateLimitKey(limiter.keyPrefix, routePattern, limitValue, windowStart)
	count, err := redisRateLimitScript.Run(redisCtx, limiter.client, []string{key}, redisRateLimitWindowMillis(config.Window)).Int64()
	if err != nil {
		return limiter.fallback.Allow(ctx, routePattern, limitValue)
	}
	if count > int64(config.Limit) {
		return RateLimitDecision{Allowed: false, RetryAfter: retryAfter}
	}

	return RateLimitDecision{Allowed: true}
}

func (limiter *RedisRouteLimiter) Close() error {
	if limiter == nil || limiter.client == nil {
		return nil
	}
	return limiter.client.Close()
}

func redisRateLimitKey(prefix string, routePattern string, limitValue string, windowStart time.Time) string {
	hash := sha256.Sum256([]byte(strings.TrimSpace(routePattern) + "|" + strings.TrimSpace(limitValue)))
	encoded := hex.EncodeToString(hash[:8])
	return fmt.Sprintf("%s:%s:%d", strings.TrimRight(prefix, ":"), encoded, windowStart.UnixNano())
}

func redisRateLimitWindowMillis(window time.Duration) int64 {
	millis := window.Milliseconds()
	if millis < 1 {
		return 1
	}
	return millis
}
