package gateway

import (
	"strconv"
	"strings"
	"sync"
	"time"
)

type gatewayRouteLimiter struct {
	mu      sync.Mutex
	now     func() time.Time
	buckets map[string]gatewayRateLimitBucket
}

type gatewayRateLimitBucket struct {
	windowStart time.Time
	count       int
}

type gatewayRateLimitDecision struct {
	Allowed    bool
	RetryAfter time.Duration
}

type gatewayRateLimitConfig struct {
	Limit  int
	Window time.Duration
}

func newGatewayRouteLimiter(now func() time.Time) *gatewayRouteLimiter {
	if now == nil {
		now = time.Now
	}
	return &gatewayRouteLimiter{
		now:     now,
		buckets: map[string]gatewayRateLimitBucket{},
	}
}

func (limiter *gatewayRouteLimiter) Allow(routePattern string, limitValue string) gatewayRateLimitDecision {
	config, ok := parseGatewayRateLimit(limitValue)
	if limiter == nil || strings.TrimSpace(routePattern) == "" || !ok {
		return gatewayRateLimitDecision{Allowed: true}
	}

	now := limiter.now()
	windowStart := now.Truncate(config.Window)
	key := strings.TrimSpace(routePattern) + "|" + strings.TrimSpace(limitValue)

	limiter.mu.Lock()
	defer limiter.mu.Unlock()

	bucket := limiter.buckets[key]
	if bucket.windowStart.IsZero() || !bucket.windowStart.Equal(windowStart) {
		bucket = gatewayRateLimitBucket{windowStart: windowStart}
	}
	if bucket.count >= config.Limit {
		retryAfter := bucket.windowStart.Add(config.Window).Sub(now)
		if retryAfter < time.Second {
			retryAfter = time.Second
		}
		limiter.buckets[key] = bucket
		return gatewayRateLimitDecision{Allowed: false, RetryAfter: retryAfter}
	}

	bucket.count++
	limiter.buckets[key] = bucket
	return gatewayRateLimitDecision{Allowed: true}
}

func parseGatewayRateLimit(value string) (gatewayRateLimitConfig, bool) {
	normalized := strings.ToLower(strings.TrimSpace(value))
	if normalized == "" || normalized == "none" || normalized == "unlimited" {
		return gatewayRateLimitConfig{}, false
	}

	parts := strings.Split(normalized, "/")
	if len(parts) != 2 {
		return gatewayRateLimitConfig{}, false
	}
	limit, err := strconv.Atoi(strings.TrimSpace(parts[0]))
	if err != nil || limit <= 0 {
		return gatewayRateLimitConfig{}, false
	}

	switch strings.TrimSpace(parts[1]) {
	case "s", "sec", "second", "seconds":
		return gatewayRateLimitConfig{Limit: limit, Window: time.Second}, true
	case "m", "min", "minute", "minutes":
		return gatewayRateLimitConfig{Limit: limit, Window: time.Minute}, true
	case "h", "hr", "hour", "hours":
		return gatewayRateLimitConfig{Limit: limit, Window: time.Hour}, true
	case "d", "day", "days":
		return gatewayRateLimitConfig{Limit: limit, Window: 24 * time.Hour}, true
	default:
		return gatewayRateLimitConfig{}, false
	}
}
