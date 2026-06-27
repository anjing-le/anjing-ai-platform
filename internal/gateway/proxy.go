package gateway

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/httpjson"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
)

const (
	defaultProxyTimeout       = 3 * time.Second
	maxProxyTimeout           = 30 * time.Second
	maxProxyRetries           = 3
	maxProxyResponseBodyBytes = 1 << 20
	defaultProxyStrategy      = "ordered"
	roundRobinProxyStrategy   = "round_robin"
	weightedProxyStrategy     = "weighted"
	maxProxyUpstreamWeight    = 10000
)

var (
	errActiveRouteNotFound     = errors.New("active gateway route not found")
	gatewayProxyStrategyCursor atomic.Uint64
)

type gatewayProxyRequest struct {
	Route            string            `json:"route"`
	Method           string            `json:"method"`
	Upstream         string            `json:"upstream"`
	Upstreams        []string          `json:"upstreams,omitempty"`
	UpstreamWeights  map[string]int    `json:"upstreamWeights,omitempty"`
	FallbackUpstream string            `json:"fallbackUpstream"`
	Strategy         string            `json:"strategy,omitempty"`
	CanaryHeader     string            `json:"canaryHeader,omitempty"`
	CanaryValue      string            `json:"canaryValue,omitempty"`
	CanaryUpstream   string            `json:"canaryUpstream,omitempty"`
	TimeoutMS        int               `json:"timeoutMs"`
	Retries          int               `json:"retries"`
	Headers          map[string]string `json:"headers"`
	Body             string            `json:"body"`
	Stream           bool              `json:"stream,omitempty"`
	CanaryMatched    bool              `json:"-"`
}

type gatewayProxyResponse struct {
	Route              string              `json:"route"`
	Upstream           string              `json:"upstream"`
	Strategy           string              `json:"strategy,omitempty"`
	CandidateUpstreams []string            `json:"candidateUpstreams,omitempty"`
	CanaryMatched      bool                `json:"canaryMatched,omitempty"`
	StatusCode         int                 `json:"statusCode"`
	Attempts           int                 `json:"attempts"`
	Fallback           bool                `json:"fallback"`
	DurationMS         int64               `json:"durationMs"`
	Headers            map[string][]string `json:"headers"`
	Body               string              `json:"body"`
	Streamed           bool                `json:"-"`
}

type resolvedProxyRoute struct {
	Upstream      string
	Upstreams     []string
	Strategy      string
	CanaryMatched bool
	RoutePattern  string
	Limit         string
}

type gatewayProxyRoutingOptions struct {
	Route           string
	Upstream        string
	Upstreams       []string
	UpstreamWeights map[string]int
	Strategy        string
	Headers         map[string]string
	CanaryHeader    string
	CanaryValue     string
	CanaryUpstream  string
}

func proxyHandler(routes RouteRepository, recorder ProxyRecorder) http.HandlerFunc {
	return proxyHandlerWithLimiter(routes, recorder, NewMemoryRouteLimiter())
}

func proxyHandlerWithLimiter(routes RouteRepository, recorder ProxyRecorder, limiter RouteLimiter) http.HandlerFunc {
	return proxyHandlerWithGovernance(routes, recorder, limiter, NewMemoryRouteCircuitBreaker())
}

func proxyHandlerWithGovernance(routes RouteRepository, recorder ProxyRecorder, limiter RouteLimiter, breaker RouteCircuitBreaker) http.HandlerFunc {
	if limiter == nil {
		limiter = NewMemoryRouteLimiter()
	}
	if breaker == nil {
		breaker = NewMemoryRouteCircuitBreaker()
	}
	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodPost) {
			return
		}

		var req gatewayProxyRequest
		if err := httpjson.Decode(r, &req); err != nil {
			httpjson.BadRequest(w, err.Error())
			return
		}

		req.Route = strings.TrimSpace(req.Route)
		if req.Route == "" {
			httpjson.BadRequest(w, "route is required")
			return
		}
		method := normalizeProxyMethod(req.Method)
		if method == "" {
			httpjson.BadRequest(w, "method is not allowed")
			return
		}
		if req.Retries < 0 {
			httpjson.BadRequest(w, "retries must be greater than or equal to 0")
			return
		}
		if req.TimeoutMS < 0 {
			httpjson.BadRequest(w, "timeoutMs must be greater than or equal to 0")
			return
		}

		resolved, err := resolveProxyRoute(r.Context(), routes, gatewayProxyRoutingOptions{
			Route:           req.Route,
			Upstream:        req.Upstream,
			Upstreams:       req.Upstreams,
			UpstreamWeights: req.UpstreamWeights,
			Strategy:        req.Strategy,
			Headers:         req.Headers,
			CanaryHeader:    req.CanaryHeader,
			CanaryValue:     req.CanaryValue,
			CanaryUpstream:  req.CanaryUpstream,
		})
		if err != nil {
			if errors.Is(err, errActiveRouteNotFound) {
				httpjson.NotFound(w, err.Error())
				return
			}
			httpjson.BadRequest(w, err.Error())
			return
		}

		req.Method = method
		req.Upstream = resolved.Upstream
		req.Upstreams, err = buildGatewayProxyAttemptUpstreams(resolved.Upstreams, req.FallbackUpstream)
		if err != nil {
			httpjson.BadRequest(w, err.Error())
			return
		}
		if len(req.Upstreams) > 0 {
			req.Upstream = req.Upstreams[0]
		}
		req.Strategy = resolved.Strategy
		req.CanaryMatched = resolved.CanaryMatched
		circuitKey := proxyCircuitBreakerKey(req, resolved)
		if decision := limiter.Allow(r.Context(), resolved.RoutePattern, resolved.Limit); !decision.Allowed {
			w.Header().Set("Retry-After", strconv.Itoa(proxyRetryAfterSeconds(decision.RetryAfter)))
			result := gatewayProxyResponse{
				Route:              req.Route,
				Upstream:           req.Upstream,
				Strategy:           req.Strategy,
				CandidateUpstreams: append([]string(nil), req.Upstreams...),
				CanaryMatched:      req.CanaryMatched,
				StatusCode:         http.StatusTooManyRequests,
				Headers:            map[string][]string{},
			}
			if logErr := recordProxyRequest(r.Context(), recorder, req, result, "RateLimited"); logErr != nil {
				httpjson.Fail(w, http.StatusInternalServerError, "internal_error", logErr.Error())
				return
			}
			httpjson.Fail(w, http.StatusTooManyRequests, "rate_limited", fmt.Sprintf("route limit %s exceeded", resolved.Limit))
			return
		}
		if decision := breaker.Allow(circuitKey); !decision.Allowed {
			w.Header().Set("Retry-After", strconv.Itoa(proxyRetryAfterSeconds(decision.RetryAfter)))
			result := gatewayProxyResponse{
				Route:              req.Route,
				Upstream:           req.Upstream,
				Strategy:           req.Strategy,
				CandidateUpstreams: append([]string(nil), req.Upstreams...),
				CanaryMatched:      req.CanaryMatched,
				StatusCode:         http.StatusServiceUnavailable,
				Headers:            map[string][]string{},
			}
			if logErr := recordProxyRequest(r.Context(), recorder, req, result, "CircuitOpen"); logErr != nil {
				httpjson.Fail(w, http.StatusInternalServerError, "internal_error", logErr.Error())
				return
			}
			httpjson.Fail(w, http.StatusServiceUnavailable, "upstream_circuit_open", "route circuit is cooling down")
			return
		}

		if req.Stream {
			result, err := streamGatewayProxy(r.Context(), w, req)
			breaker.Record(circuitKey, proxyRequestFailed(result, err))
			status := proxyLogStatus(result, err)
			if logErr := recordProxyRequest(r.Context(), recorder, req, result, status); logErr != nil && !result.Streamed {
				httpjson.Fail(w, http.StatusInternalServerError, "internal_error", logErr.Error())
				return
			}
			if err != nil && !result.Streamed {
				httpjson.Fail(w, http.StatusBadGateway, "upstream_unavailable", err.Error())
			}
			return
		}

		result, err := executeGatewayProxy(r.Context(), req)
		breaker.Record(circuitKey, proxyRequestFailed(result, err))
		status := proxyLogStatus(result, err)
		if logErr := recordProxyRequest(r.Context(), recorder, req, result, status); logErr != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", logErr.Error())
			return
		}
		if err != nil {
			httpjson.Fail(w, http.StatusBadGateway, "upstream_unavailable", err.Error())
			return
		}

		httpjson.OK(w, result)
	}
}

func proxyCircuitBreakerKey(req gatewayProxyRequest, resolved resolvedProxyRoute) string {
	routeKey := strings.TrimSpace(resolved.RoutePattern)
	if routeKey == "" {
		routeKey = strings.SplitN(strings.TrimSpace(req.Route), "?", 2)[0]
	}
	upstream := strings.TrimSpace(resolved.Upstream)
	if upstream == "" {
		upstream = strings.TrimSpace(req.Upstream)
	}
	if routeKey == "" {
		return upstream
	}
	if upstream == "" {
		return routeKey
	}
	return routeKey + " -> " + upstream
}

func proxyRequestFailed(result gatewayProxyResponse, err error) bool {
	return err != nil || result.StatusCode >= http.StatusInternalServerError
}

func proxyRetryAfterSeconds(duration time.Duration) int {
	if duration <= 0 {
		return 1
	}
	seconds := int((duration + time.Second - 1) / time.Second)
	if seconds < 1 {
		return 1
	}
	return seconds
}

func executeGatewayProxy(ctx context.Context, req gatewayProxyRequest) (gatewayProxyResponse, error) {
	started := time.Now()
	timeout := normalizeProxyTimeout(req.TimeoutMS)
	retries := normalizeProxyRetries(req.Retries)
	client := http.Client{Timeout: timeout}
	upstreams := gatewayProxyAttemptUpstreams(req)

	var result gatewayProxyResponse
	var lastErr error
	attempts := 0
	for index, upstream := range upstreams {
		attemptLimit := retries + 1
		if index > 0 {
			attemptLimit = 1
		}
		for attempt := 0; attempt < attemptLimit; attempt++ {
			attempts++
			response, err := sendGatewayProxyAttempt(ctx, client, req, upstream)
			response.Attempts = attempts
			response.Fallback = index > 0
			response.DurationMS = time.Since(started).Milliseconds()
			response.Strategy = req.Strategy
			response.CandidateUpstreams = append([]string(nil), upstreams...)
			response.CanaryMatched = req.CanaryMatched
			result = response
			if err != nil {
				lastErr = err
				continue
			}
			if response.StatusCode >= http.StatusInternalServerError {
				lastErr = fmt.Errorf("upstream returned %d", response.StatusCode)
				continue
			}
			return response, nil
		}
	}

	if result.Route == "" {
		result = gatewayProxyResponse{
			Route:              req.Route,
			Upstream:           req.Upstream,
			Strategy:           req.Strategy,
			CandidateUpstreams: append([]string(nil), upstreams...),
			CanaryMatched:      req.CanaryMatched,
			Attempts:           attempts,
			DurationMS:         time.Since(started).Milliseconds(),
			Headers:            map[string][]string{},
		}
	}
	if lastErr == nil {
		lastErr = errors.New("upstream request failed")
	}
	return result, lastErr
}

func sendGatewayProxyAttempt(ctx context.Context, client http.Client, req gatewayProxyRequest, upstream string) (gatewayProxyResponse, error) {
	httpReq, err := newGatewayProxyHTTPRequest(ctx, req, upstream)
	if err != nil {
		return gatewayProxyResponse{Route: req.Route, Upstream: upstream, Strategy: req.Strategy, CanaryMatched: req.CanaryMatched, Headers: map[string][]string{}}, err
	}

	resp, err := client.Do(httpReq)
	if err != nil {
		return gatewayProxyResponse{Route: req.Route, Upstream: upstream, Strategy: req.Strategy, CanaryMatched: req.CanaryMatched, Headers: map[string][]string{}}, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxProxyResponseBodyBytes))
	if err != nil {
		return gatewayProxyResponse{Route: req.Route, Upstream: upstream, Strategy: req.Strategy, CanaryMatched: req.CanaryMatched, StatusCode: resp.StatusCode, Headers: cloneHeader(resp.Header)}, err
	}

	return gatewayProxyResponse{
		Route:         req.Route,
		Upstream:      upstream,
		Strategy:      req.Strategy,
		CanaryMatched: req.CanaryMatched,
		StatusCode:    resp.StatusCode,
		Headers:       cloneHeader(resp.Header),
		Body:          string(body),
	}, nil
}

func streamGatewayProxy(ctx context.Context, w http.ResponseWriter, req gatewayProxyRequest) (gatewayProxyResponse, error) {
	started := time.Now()
	timeout := normalizeProxyTimeout(req.TimeoutMS)
	retries := normalizeProxyRetries(req.Retries)
	client := http.Client{Timeout: timeout}
	upstreams := gatewayProxyAttemptUpstreams(req)

	var result gatewayProxyResponse
	var lastErr error
	attempts := 0
	for index, upstream := range upstreams {
		attemptLimit := retries + 1
		if index > 0 {
			attemptLimit = 1
		}
		for attempt := 0; attempt < attemptLimit; attempt++ {
			attempts++
			response := gatewayProxyResponse{
				Route:              req.Route,
				Upstream:           upstream,
				Strategy:           req.Strategy,
				CandidateUpstreams: append([]string(nil), upstreams...),
				CanaryMatched:      req.CanaryMatched,
				Attempts:           attempts,
				Fallback:           index > 0,
				Headers:            map[string][]string{},
			}
			httpReq, err := newGatewayProxyHTTPRequest(ctx, req, upstream)
			if err != nil {
				response.DurationMS = time.Since(started).Milliseconds()
				result = response
				lastErr = err
				continue
			}
			resp, err := client.Do(httpReq)
			if err != nil {
				response.DurationMS = time.Since(started).Milliseconds()
				result = response
				lastErr = err
				continue
			}

			response.StatusCode = resp.StatusCode
			response.Headers = cloneHeader(resp.Header)
			result = response
			if resp.StatusCode >= http.StatusInternalServerError {
				_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, maxProxyResponseBodyBytes))
				_ = resp.Body.Close()
				result.DurationMS = time.Since(started).Milliseconds()
				lastErr = fmt.Errorf("upstream returned %d", resp.StatusCode)
				continue
			}

			err = copyGatewayProxyStream(w, resp)
			result.DurationMS = time.Since(started).Milliseconds()
			result.Streamed = true
			if err != nil {
				return result, err
			}
			return result, nil
		}
	}

	if result.Route == "" {
		result = gatewayProxyResponse{
			Route:              req.Route,
			Upstream:           req.Upstream,
			Strategy:           req.Strategy,
			CandidateUpstreams: append([]string(nil), upstreams...),
			CanaryMatched:      req.CanaryMatched,
			Attempts:           attempts,
			DurationMS:         time.Since(started).Milliseconds(),
			Headers:            map[string][]string{},
		}
	}
	if lastErr == nil {
		lastErr = errors.New("upstream request failed")
	}
	return result, lastErr
}

func newGatewayProxyHTTPRequest(ctx context.Context, req gatewayProxyRequest, upstream string) (*http.Request, error) {
	target, err := buildProxyURL(upstream, req.Route)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, req.Method, target, strings.NewReader(req.Body))
	if err != nil {
		return nil, err
	}
	for key, value := range req.Headers {
		if isForwardHeaderAllowed(key) {
			httpReq.Header.Set(key, value)
		}
	}
	if req.Body != "" && httpReq.Header.Get("Content-Type") == "" {
		httpReq.Header.Set("Content-Type", "application/json")
	}
	return httpReq, nil
}

func copyGatewayProxyStream(w http.ResponseWriter, resp *http.Response) error {
	defer resp.Body.Close()

	copyProxyResponseHeaders(w.Header(), resp.Header)
	w.WriteHeader(resp.StatusCode)
	if _, err := io.Copy(w, resp.Body); err != nil {
		return err
	}
	if flusher, ok := w.(http.Flusher); ok {
		flusher.Flush()
	}
	return nil
}

func copyProxyResponseHeaders(dst http.Header, src http.Header) {
	for key, values := range src {
		if !isForwardHeaderAllowed(key) {
			continue
		}
		for _, value := range values {
			dst.Add(key, value)
		}
	}
}

func resolveProxyRoute(ctx context.Context, routes RouteRepository, options gatewayProxyRoutingOptions) (resolvedProxyRoute, error) {
	requestStrategy, err := normalizeGatewayProxyStrategy(options.Strategy)
	if err != nil {
		return resolvedProxyRoute{}, err
	}
	upstreams := splitGatewayProxyUpstreams(append([]string{options.Upstream}, options.Upstreams...)...)
	if len(upstreams) > 0 {
		validated, err := validateGatewayProxyUpstreams(upstreams)
		if err != nil {
			return resolvedProxyRoute{}, err
		}
		ordered, canaryMatched, err := orderGatewayProxyUpstreams(validated, requestStrategy, options)
		if err != nil {
			return resolvedProxyRoute{}, err
		}
		return resolvedProxyRoute{Upstream: ordered[0], Upstreams: ordered, Strategy: requestStrategy, CanaryMatched: canaryMatched}, nil
	}

	items, err := routes.ListRoutes(ctx)
	if err != nil {
		return resolvedProxyRoute{}, fmt.Errorf("list gateway routes: %w", err)
	}
	for _, item := range items {
		if item.Status != "Active" {
			continue
		}
		if routeMatches(item.Route, options.Route) {
			validated, err := validateGatewayProxyUpstreams(splitGatewayProxyUpstreams(item.Upstream))
			if err != nil {
				return resolvedProxyRoute{}, err
			}
			routeOptions := mergeGatewayRouteRoutingOptions(options, item)
			routeStrategy, err := normalizeGatewayProxyStrategy(routeOptions.Strategy)
			if err != nil {
				return resolvedProxyRoute{}, err
			}
			ordered, canaryMatched, err := orderGatewayProxyUpstreams(validated, routeStrategy, routeOptions)
			if err != nil {
				return resolvedProxyRoute{}, err
			}
			return resolvedProxyRoute{
				Upstream:      ordered[0],
				Upstreams:     ordered,
				Strategy:      routeStrategy,
				CanaryMatched: canaryMatched,
				RoutePattern:  item.Route,
				Limit:         item.Limit,
			}, nil
		}
	}
	return resolvedProxyRoute{}, errActiveRouteNotFound
}

func mergeGatewayRouteRoutingOptions(options gatewayProxyRoutingOptions, route store.GatewayRoute) gatewayProxyRoutingOptions {
	merged := options
	if strings.TrimSpace(merged.Strategy) == "" {
		merged.Strategy = route.Strategy
	}
	if len(merged.UpstreamWeights) == 0 && len(route.UpstreamWeights) > 0 {
		merged.UpstreamWeights = cloneGatewayProxyWeights(route.UpstreamWeights)
	}
	if strings.TrimSpace(merged.CanaryHeader) == "" {
		merged.CanaryHeader = route.CanaryHeader
	}
	if strings.TrimSpace(merged.CanaryValue) == "" {
		merged.CanaryValue = route.CanaryValue
	}
	if strings.TrimSpace(merged.CanaryUpstream) == "" {
		merged.CanaryUpstream = route.CanaryUpstream
	}
	return merged
}

func cloneGatewayProxyWeights(values map[string]int) map[string]int {
	if len(values) == 0 {
		return nil
	}
	cloned := make(map[string]int, len(values))
	for key, value := range values {
		cloned[key] = value
	}
	return cloned
}

func normalizeGatewayProxyStrategy(strategy string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(strategy)) {
	case "", defaultProxyStrategy, "primary":
		return defaultProxyStrategy, nil
	case roundRobinProxyStrategy, "round-robin", "roundrobin":
		return roundRobinProxyStrategy, nil
	case weightedProxyStrategy, "weight":
		return weightedProxyStrategy, nil
	default:
		return "", errors.New("strategy must be ordered, round_robin, or weighted")
	}
}

func splitGatewayProxyUpstreams(values ...string) []string {
	seen := map[string]struct{}{}
	upstreams := []string{}
	for _, value := range values {
		for _, upstream := range strings.FieldsFunc(value, func(r rune) bool {
			return r == ',' || r == '\n' || r == '\r' || r == '\t' || r == ';'
		}) {
			upstream = strings.TrimSpace(upstream)
			if upstream == "" {
				continue
			}
			if _, ok := seen[upstream]; ok {
				continue
			}
			seen[upstream] = struct{}{}
			upstreams = append(upstreams, upstream)
		}
	}
	return upstreams
}

func validateGatewayProxyUpstreams(upstreams []string) ([]string, error) {
	if len(upstreams) == 0 {
		return nil, errors.New("upstream is required")
	}
	validated := make([]string, 0, len(upstreams))
	for _, upstream := range upstreams {
		validatedUpstream, err := validateProxyUpstream(upstream)
		if err != nil {
			return nil, err
		}
		validated = append(validated, validatedUpstream)
	}
	return validated, nil
}

func orderGatewayProxyUpstreams(upstreams []string, strategy string, options gatewayProxyRoutingOptions) ([]string, bool, error) {
	ordered := append([]string(nil), upstreams...)
	canaryUpstream, canaryMatched, err := resolveGatewayProxyCanary(options)
	if err != nil {
		return nil, false, err
	}
	if canaryMatched {
		return appendGatewayProxyUpstreams([]string{canaryUpstream}, ordered...), true, nil
	}
	if len(ordered) <= 1 {
		return ordered, false, nil
	}
	switch strategy {
	case roundRobinProxyStrategy:
		offset := int(gatewayProxyStrategyCursor.Add(1)-1) % len(ordered)
		return append(ordered[offset:], ordered[:offset]...), false, nil
	case weightedProxyStrategy:
		weights, err := validateGatewayProxyWeights(ordered, options.UpstreamWeights)
		if err != nil {
			return nil, false, err
		}
		return orderGatewayProxyWeightedUpstreams(ordered, weights), false, nil
	default:
		return ordered, false, nil
	}
}

func resolveGatewayProxyCanary(options gatewayProxyRoutingOptions) (string, bool, error) {
	header := strings.TrimSpace(options.CanaryHeader)
	value := strings.TrimSpace(options.CanaryValue)
	upstream := strings.TrimSpace(options.CanaryUpstream)
	if header == "" && value == "" && upstream == "" {
		return "", false, nil
	}
	if header == "" || upstream == "" {
		return "", false, errors.New("canaryHeader and canaryUpstream are required together")
	}
	if !gatewayProxyHeaderMatches(options.Headers, header, value) {
		return "", false, nil
	}
	validated, err := validateProxyUpstream(upstream)
	if err != nil {
		return "", false, err
	}
	return validated, true, nil
}

func gatewayProxyHeaderMatches(headers map[string]string, name string, expected string) bool {
	for key, value := range headers {
		if !strings.EqualFold(strings.TrimSpace(key), strings.TrimSpace(name)) {
			continue
		}
		actual := strings.TrimSpace(value)
		if strings.TrimSpace(expected) == "" {
			return actual != ""
		}
		return actual == strings.TrimSpace(expected)
	}
	return false
}

func validateGatewayProxyWeights(upstreams []string, weights map[string]int) (map[string]int, error) {
	if len(weights) == 0 {
		return nil, nil
	}
	candidates := map[string]struct{}{}
	for _, upstream := range upstreams {
		candidates[upstream] = struct{}{}
	}
	validated := make(map[string]int, len(weights))
	for upstream, weight := range weights {
		upstream = strings.TrimSpace(upstream)
		if upstream == "" {
			return nil, errors.New("upstreamWeights keys must not be empty")
		}
		if _, ok := candidates[upstream]; !ok {
			return nil, errors.New("upstreamWeights contains unknown upstream")
		}
		if weight <= 0 {
			return nil, errors.New("upstreamWeights values must be greater than 0")
		}
		if weight > maxProxyUpstreamWeight {
			return nil, fmt.Errorf("upstreamWeights values must be less than or equal to %d", maxProxyUpstreamWeight)
		}
		validated[upstream] = weight
	}
	return validated, nil
}

func orderGatewayProxyWeightedUpstreams(upstreams []string, weights map[string]int) []string {
	if len(upstreams) <= 1 {
		return append([]string(nil), upstreams...)
	}
	total := 0
	for _, upstream := range upstreams {
		total += gatewayProxyUpstreamWeight(upstream, weights)
	}
	if total <= 0 {
		return append([]string(nil), upstreams...)
	}
	cursor := int(gatewayProxyStrategyCursor.Add(1)-1) % total
	selected := 0
	seen := 0
	for index, upstream := range upstreams {
		seen += gatewayProxyUpstreamWeight(upstream, weights)
		if cursor < seen {
			selected = index
			break
		}
	}
	if selected == 0 {
		return append([]string(nil), upstreams...)
	}
	return append(append([]string(nil), upstreams[selected:]...), upstreams[:selected]...)
}

func gatewayProxyUpstreamWeight(upstream string, weights map[string]int) int {
	if weights == nil {
		return 1
	}
	weight := weights[upstream]
	if weight <= 0 {
		return 1
	}
	return weight
}

func buildGatewayProxyAttemptUpstreams(primary []string, fallback string) ([]string, error) {
	upstreams := appendGatewayProxyUpstreams(nil, primary...)
	fallbackUpstreams := splitGatewayProxyUpstreams(fallback)
	if len(fallbackUpstreams) > 0 {
		validated, err := validateGatewayProxyUpstreams(fallbackUpstreams)
		if err != nil {
			return nil, err
		}
		upstreams = appendGatewayProxyUpstreams(upstreams, validated...)
	}
	if len(upstreams) == 0 {
		return nil, errors.New("upstream is required")
	}
	return upstreams, nil
}

func gatewayProxyAttemptUpstreams(req gatewayProxyRequest) []string {
	upstreams := appendGatewayProxyUpstreams(nil, req.Upstreams...)
	if len(upstreams) == 0 {
		upstreams = appendGatewayProxyUpstreams(upstreams, req.Upstream)
	}
	upstreams = appendGatewayProxyUpstreams(upstreams, splitGatewayProxyUpstreams(req.FallbackUpstream)...)
	return upstreams
}

func appendGatewayProxyUpstreams(base []string, extras ...string) []string {
	seen := make(map[string]struct{}, len(base)+len(extras))
	result := make([]string, 0, len(base)+len(extras))
	for _, upstream := range append(append([]string(nil), base...), extras...) {
		upstream = strings.TrimSpace(upstream)
		if upstream == "" {
			continue
		}
		if _, ok := seen[upstream]; ok {
			continue
		}
		seen[upstream] = struct{}{}
		result = append(result, upstream)
	}
	return result
}

func validateProxyUpstream(upstream string) (string, error) {
	parsed, err := url.Parse(upstream)
	if err != nil {
		return "", fmt.Errorf("parse upstream: %w", err)
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", errors.New("upstream must start with http:// or https://")
	}
	if parsed.Host == "" {
		return "", errors.New("upstream host is required")
	}
	return upstream, nil
}

func buildProxyURL(upstream string, route string) (string, error) {
	base, err := url.Parse(upstream)
	if err != nil {
		return "", fmt.Errorf("parse upstream: %w", err)
	}
	if base.Scheme != "http" && base.Scheme != "https" {
		return "", errors.New("upstream must start with http:// or https://")
	}
	if base.Host == "" {
		return "", errors.New("upstream host is required")
	}

	routeURL, err := url.Parse(route)
	if err != nil {
		return "", fmt.Errorf("parse route: %w", err)
	}
	base.Path = joinURLPath(base.Path, routeURL.Path)
	if routeURL.RawQuery != "" {
		if base.RawQuery != "" {
			base.RawQuery += "&" + routeURL.RawQuery
		} else {
			base.RawQuery = routeURL.RawQuery
		}
	}
	return base.String(), nil
}

func joinURLPath(basePath string, routePath string) string {
	if strings.TrimSpace(routePath) == "" {
		routePath = "/"
	}
	if basePath == "" || basePath == "/" {
		return "/" + strings.TrimLeft(routePath, "/")
	}
	return strings.TrimRight(basePath, "/") + "/" + strings.TrimLeft(routePath, "/")
}

func routeMatches(pattern string, route string) bool {
	pattern = strings.TrimSpace(pattern)
	routePath := strings.SplitN(route, "?", 2)[0]
	if strings.HasSuffix(pattern, "/**") {
		prefix := strings.TrimSuffix(pattern, "/**")
		return routePath == prefix || strings.HasPrefix(routePath, prefix+"/")
	}
	if strings.HasSuffix(pattern, "*") {
		prefix := strings.TrimRight(strings.TrimSuffix(pattern, "*"), "/")
		return routePath == prefix || strings.HasPrefix(routePath, prefix+"/")
	}
	return pattern == routePath
}

func normalizeProxyMethod(method string) string {
	normalized := strings.ToUpper(strings.TrimSpace(method))
	if normalized == "" {
		normalized = http.MethodPost
	}
	switch normalized {
	case http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		return normalized
	default:
		return ""
	}
}

func normalizeProxyTimeout(timeoutMS int) time.Duration {
	if timeoutMS <= 0 {
		return defaultProxyTimeout
	}
	timeout := time.Duration(timeoutMS) * time.Millisecond
	if timeout > maxProxyTimeout {
		return maxProxyTimeout
	}
	return timeout
}

func normalizeProxyRetries(retries int) int {
	if retries > maxProxyRetries {
		return maxProxyRetries
	}
	return retries
}

func cloneHeader(header http.Header) map[string][]string {
	cloned := make(map[string][]string, len(header))
	for key, values := range header {
		cloned[key] = append([]string(nil), values...)
	}
	return cloned
}

func isForwardHeaderAllowed(name string) bool {
	switch strings.ToLower(strings.TrimSpace(name)) {
	case "", "host", "content-length", "connection", "transfer-encoding", "upgrade":
		return false
	default:
		return true
	}
}

func proxyLogStatus(result gatewayProxyResponse, err error) string {
	if err != nil {
		return "Failed"
	}
	if result.Fallback {
		return "Fallback"
	}
	if result.StatusCode >= http.StatusBadRequest {
		return "Failed"
	}
	return "Success"
}

func recordProxyRequest(ctx context.Context, recorder ProxyRecorder, req gatewayProxyRequest, result gatewayProxyResponse, status string) error {
	if recorder == nil {
		return nil
	}
	resultValue := "unavailable"
	if result.StatusCode > 0 {
		resultValue = strconv.Itoa(result.StatusCode)
	}
	latency := fmt.Sprintf("%dms", result.DurationMS)
	consumer := result.Upstream
	if consumer == "" {
		consumer = req.Upstream
	}
	return recorder.RecordProxyRequest(ctx, ProxyRequestLogInput{
		Request:  req.Method + " " + req.Route,
		Consumer: consumer,
		Latency:  latency,
		Result:   resultValue,
		Status:   status,
	})
}
