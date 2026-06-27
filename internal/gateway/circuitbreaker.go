package gateway

import (
	"strings"
	"sync"
	"time"
)

const (
	defaultRouteCircuitBreakerFailureThreshold = 3
	defaultRouteCircuitBreakerCooldown         = 30 * time.Second
)

type RouteCircuitBreaker interface {
	Allow(routeKey string) CircuitBreakerDecision
	Record(routeKey string, failed bool)
}

type CircuitBreakerDecision struct {
	Allowed    bool
	RetryAfter time.Duration
}

type RouteCircuitBreakerConfig struct {
	FailureThreshold int
	Cooldown         time.Duration
}

type memoryRouteCircuitBreaker struct {
	mu               sync.Mutex
	states           map[string]routeCircuitState
	failureThreshold int
	cooldown         time.Duration
	now              func() time.Time
}

type routeCircuitState struct {
	Failures  int
	OpenUntil time.Time
}

func NewMemoryRouteCircuitBreaker() RouteCircuitBreaker {
	return newMemoryRouteCircuitBreakerWithClock(RouteCircuitBreakerConfig{}, time.Now)
}

func newMemoryRouteCircuitBreakerWithClock(config RouteCircuitBreakerConfig, now func() time.Time) *memoryRouteCircuitBreaker {
	failureThreshold := config.FailureThreshold
	if failureThreshold <= 0 {
		failureThreshold = defaultRouteCircuitBreakerFailureThreshold
	}
	cooldown := config.Cooldown
	if cooldown <= 0 {
		cooldown = defaultRouteCircuitBreakerCooldown
	}
	if now == nil {
		now = time.Now
	}
	return &memoryRouteCircuitBreaker{
		states:           map[string]routeCircuitState{},
		failureThreshold: failureThreshold,
		cooldown:         cooldown,
		now:              now,
	}
}

func (breaker *memoryRouteCircuitBreaker) Allow(routeKey string) CircuitBreakerDecision {
	key := strings.TrimSpace(routeKey)
	if key == "" {
		return CircuitBreakerDecision{Allowed: true}
	}

	breaker.mu.Lock()
	defer breaker.mu.Unlock()

	state, ok := breaker.states[key]
	if !ok || state.OpenUntil.IsZero() {
		return CircuitBreakerDecision{Allowed: true}
	}

	current := breaker.now()
	if current.Before(state.OpenUntil) {
		return CircuitBreakerDecision{
			Allowed:    false,
			RetryAfter: state.OpenUntil.Sub(current),
		}
	}

	state.OpenUntil = time.Time{}
	if breaker.failureThreshold > 1 {
		state.Failures = breaker.failureThreshold - 1
	} else {
		state.Failures = 0
	}
	breaker.states[key] = state
	return CircuitBreakerDecision{Allowed: true}
}

func (breaker *memoryRouteCircuitBreaker) Record(routeKey string, failed bool) {
	key := strings.TrimSpace(routeKey)
	if key == "" {
		return
	}

	breaker.mu.Lock()
	defer breaker.mu.Unlock()

	if !failed {
		delete(breaker.states, key)
		return
	}

	state := breaker.states[key]
	state.Failures++
	if state.Failures >= breaker.failureThreshold {
		state.OpenUntil = breaker.now().Add(breaker.cooldown)
	}
	breaker.states[key] = state
}
