package gateway

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/csvexport"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/httpjson"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/retention"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
)

const (
	defaultRouteHealthTimeout = time.Second
	maxRouteHealthTimeout     = 5 * time.Second
)

type Options struct {
	RateLimiter    RouteLimiter
	CircuitBreaker RouteCircuitBreaker
}

type gatewayRouteHealthCheckResponse struct {
	ID         string `json:"id"`
	Route      string `json:"route"`
	Upstream   string `json:"upstream"`
	Status     string `json:"status"`
	Healthy    bool   `json:"healthy"`
	StatusCode int    `json:"statusCode"`
	LatencyMS  int64  `json:"latencyMs"`
	CheckedAt  string `json:"checkedAt"`
	Error      string `json:"error,omitempty"`
}

type gatewayRoutePreflightCheck struct {
	Name     string `json:"name"`
	Status   string `json:"status"`
	Severity string `json:"severity"`
	Message  string `json:"message"`
}

type gatewayRoutePreflightResponse struct {
	ID        string                           `json:"id"`
	Route     string                           `json:"route"`
	Upstream  string                           `json:"upstream"`
	Status    string                           `json:"status"`
	Ready     bool                             `json:"ready"`
	CheckedAt string                           `json:"checkedAt"`
	Checks    []gatewayRoutePreflightCheck     `json:"checks"`
	Health    *gatewayRouteHealthCheckResponse `json:"health,omitempty"`
}

type createRouteRequest struct {
	Route           string         `json:"route"`
	Upstream        string         `json:"upstream"`
	Limit           string         `json:"limit"`
	Strategy        string         `json:"strategy"`
	UpstreamWeights map[string]int `json:"upstreamWeights,omitempty"`
	CanaryHeader    string         `json:"canaryHeader,omitempty"`
	CanaryValue     string         `json:"canaryValue,omitempty"`
	CanaryUpstream  string         `json:"canaryUpstream,omitempty"`
}

func Register(mux *http.ServeMux, st *store.Store) {
	RegisterWithOptions(mux, st, Options{})
}

func RegisterWithOptions(mux *http.ServeMux, st *store.Store, options Options) {
	RegisterWithRepositoriesAndOptions(mux, st, NewMemoryRepositories(st), options)
}

func RegisterWithRoutes(mux *http.ServeMux, st *store.Store, routes RouteRepository) {
	repos := NewMemoryRepositories(st)
	repos.Routes = routes
	RegisterWithRepositoriesAndOptions(mux, st, repos, Options{})
}

func RegisterWithRepositories(mux *http.ServeMux, st *store.Store, repos Repositories) {
	RegisterWithRepositoriesAndOptions(mux, st, repos, Options{})
}

func RegisterWithRepositoriesAndOptions(mux *http.ServeMux, st *store.Store, repos Repositories, options Options) {
	limiter := options.RateLimiter
	if limiter == nil {
		limiter = NewMemoryRouteLimiter()
	}
	breaker := options.CircuitBreaker
	if breaker == nil {
		breaker = NewMemoryRouteCircuitBreaker()
	}

	mux.HandleFunc("/api/gateway/healthz", func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodGet) {
			return
		}
		httpjson.OK(w, map[string]string{"service": "gateway-api", "status": "ok"})
	})
	mux.HandleFunc("/api/gateway/routes", routesHandler(repos.Routes))
	mux.HandleFunc("/api/gateway/routes/publish", publishRouteHandler(repos.Routes))
	mux.HandleFunc("/api/gateway/routes/health-check", routeHealthCheckHandler(repos.Routes))
	mux.HandleFunc("/api/gateway/routes/preflight", routePreflightHandler(repos.Routes))
	mux.HandleFunc("/api/gateway/model-routes", modelRoutesHandler(repos.ModelRoutes))
	mux.HandleFunc("/api/gateway/model-routes/publish", publishModelRouteHandler(repos.ModelRoutes))
	mux.HandleFunc("/api/gateway/skills", skillsHandler(repos.Skills))
	mux.HandleFunc("/api/gateway/skills/publish", publishSkillBindingHandler(repos.Skills))
	mux.HandleFunc("/api/gateway/skills/invoke", skillInvokeHandler(repos.Skills, repos.Invocations))
	mux.HandleFunc("/api/gateway/request-logs", requestLogsHandler(repos.RequestLogs))
	mux.HandleFunc("/api/gateway/request-logs/export", requestLogsExportHandler(repos.RequestLogs))
	mux.HandleFunc("/api/gateway/request-logs/retention/purge", requestLogsRetentionPurgeHandler(repos.RequestLogs))
	mux.HandleFunc("/api/gateway/proxy", proxyHandlerWithGovernance(repos.Routes, repos.ProxyRequests, limiter, breaker))
	mux.HandleFunc("/api/gateway/llm/invoke", llmInvokeHandler(repos.ModelRoutes, repos.Invocations))
	mux.HandleFunc("/api/gateway/llm/stream", llmStreamHandler(repos.ModelRoutes, repos.Invocations))
}

func routesHandler(routes RouteRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			items, err := routes.ListRoutes(r.Context())
			if err != nil {
				httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
				return
			}
			httpjson.OK(w, items)
		case http.MethodPost:
			var req createRouteRequest
			if err := httpjson.Decode(r, &req); err != nil {
				httpjson.BadRequest(w, err.Error())
				return
			}
			if req.Route == "" {
				httpjson.BadRequest(w, "route is required")
				return
			}
			if req.Upstream == "" {
				req.Upstream = "gateway-api"
			}
			if req.Limit == "" {
				req.Limit = "600/min"
			}
			strategy, weights, canaryHeader, canaryValue, canaryUpstream, err := normalizeGatewayRouteCreatePolicy(req)
			if err != nil {
				httpjson.BadRequest(w, err.Error())
				return
			}
			route, err := routes.CreateRoute(r.Context(), CreateRouteInput{
				Route:           req.Route,
				Upstream:        req.Upstream,
				Limit:           req.Limit,
				Strategy:        strategy,
				UpstreamWeights: weights,
				CanaryHeader:    canaryHeader,
				CanaryValue:     canaryValue,
				CanaryUpstream:  canaryUpstream,
			})
			if err != nil {
				httpjson.BadRequest(w, err.Error())
				return
			}
			httpjson.Created(w, route)
		default:
			httpjson.MethodNotAllowed(w)
		}
	}
}

func publishRouteHandler(routes RouteRepository) http.HandlerFunc {
	type publishRouteRequest struct {
		ID string `json:"id"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodPost) {
			return
		}

		var req publishRouteRequest
		if err := httpjson.Decode(r, &req); err != nil {
			httpjson.BadRequest(w, err.Error())
			return
		}
		if req.ID == "" {
			httpjson.BadRequest(w, "id is required")
			return
		}

		route, ok, err := routes.PublishRoute(r.Context(), req.ID)
		if err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		if !ok {
			httpjson.NotFound(w, "route not found")
			return
		}

		httpjson.OK(w, route)
	}
}

func normalizeGatewayRouteCreatePolicy(req createRouteRequest) (string, map[string]int, string, string, string, error) {
	strategy, err := normalizeGatewayProxyStrategy(req.Strategy)
	if err != nil {
		return "", nil, "", "", "", err
	}
	weights, err := validateGatewayProxyWeights(splitGatewayProxyUpstreams(req.Upstream), req.UpstreamWeights)
	if err != nil {
		return "", nil, "", "", "", err
	}

	canaryHeader := strings.TrimSpace(req.CanaryHeader)
	canaryValue := strings.TrimSpace(req.CanaryValue)
	canaryUpstream := strings.TrimSpace(req.CanaryUpstream)
	if canaryHeader == "" && canaryValue == "" && canaryUpstream == "" {
		return strategy, weights, "", "", "", nil
	}
	if canaryHeader == "" || canaryUpstream == "" {
		return "", nil, "", "", "", errors.New("canaryHeader and canaryUpstream are required together")
	}
	validatedUpstream, err := validateProxyUpstream(canaryUpstream)
	if err != nil {
		return "", nil, "", "", "", err
	}
	return strategy, weights, canaryHeader, canaryValue, validatedUpstream, nil
}

func routeHealthCheckHandler(routes RouteRepository) http.HandlerFunc {
	type healthCheckRouteRequest struct {
		ID        string `json:"id"`
		TimeoutMS int    `json:"timeoutMs"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodPost) {
			return
		}

		var req healthCheckRouteRequest
		if err := httpjson.Decode(r, &req); err != nil {
			httpjson.BadRequest(w, err.Error())
			return
		}
		req.ID = strings.TrimSpace(req.ID)
		if req.ID == "" {
			httpjson.BadRequest(w, "id is required")
			return
		}
		if req.TimeoutMS < 0 {
			httpjson.BadRequest(w, "timeoutMs must be greater than or equal to 0")
			return
		}

		route, ok, err := findGatewayRoute(r.Context(), routes, req.ID)
		if err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		if !ok {
			httpjson.NotFound(w, "route not found")
			return
		}

		httpjson.OK(w, checkGatewayRouteHealth(r.Context(), route, normalizeRouteHealthTimeout(req.TimeoutMS)))
	}
}

func routePreflightHandler(routes RouteRepository) http.HandlerFunc {
	type preflightRouteRequest struct {
		ID        string `json:"id"`
		TimeoutMS int    `json:"timeoutMs"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodPost) {
			return
		}

		var req preflightRouteRequest
		if err := httpjson.Decode(r, &req); err != nil {
			httpjson.BadRequest(w, err.Error())
			return
		}
		req.ID = strings.TrimSpace(req.ID)
		if req.ID == "" {
			httpjson.BadRequest(w, "id is required")
			return
		}
		if req.TimeoutMS < 0 {
			httpjson.BadRequest(w, "timeoutMs must be greater than or equal to 0")
			return
		}

		route, ok, err := findGatewayRoute(r.Context(), routes, req.ID)
		if err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		if !ok {
			httpjson.NotFound(w, "route not found")
			return
		}

		httpjson.OK(w, preflightGatewayRoute(r.Context(), route, normalizeRouteHealthTimeout(req.TimeoutMS)))
	}
}

func findGatewayRoute(ctx context.Context, routes RouteRepository, id string) (store.GatewayRoute, bool, error) {
	items, err := routes.ListRoutes(ctx)
	if err != nil {
		return store.GatewayRoute{}, false, err
	}
	for _, item := range items {
		if item.ID == id {
			return item, true, nil
		}
	}
	return store.GatewayRoute{}, false, nil
}

func preflightGatewayRoute(ctx context.Context, route store.GatewayRoute, timeout time.Duration) gatewayRoutePreflightResponse {
	health := checkGatewayRouteHealth(ctx, route, timeout)
	checks := []gatewayRoutePreflightCheck{
		checkGatewayRoutePattern(route.Route),
		checkGatewayRouteAuth(route.Auth),
		checkGatewayRouteLimit(route.Limit),
		checkGatewayRouteStatus(route.Status),
		checkGatewayRouteUpstream(health),
	}
	status := summarizeGatewayRoutePreflight(checks)

	return gatewayRoutePreflightResponse{
		ID:        route.ID,
		Route:     route.Route,
		Upstream:  route.Upstream,
		Status:    status,
		Ready:     status != "Block",
		CheckedAt: health.CheckedAt,
		Checks:    checks,
		Health:    &health,
	}
}

func checkGatewayRoutePattern(pattern string) gatewayRoutePreflightCheck {
	pattern = strings.TrimSpace(pattern)
	if pattern == "" {
		return blockGatewayRouteCheck("route", "route is required")
	}
	if !strings.HasPrefix(pattern, "/") {
		return blockGatewayRouteCheck("route", "route must start with /")
	}
	if strings.ContainsAny(pattern, " \t\r\n") {
		return blockGatewayRouteCheck("route", "route must not contain whitespace")
	}
	return passGatewayRouteCheck("route", "route pattern is ready")
}

func checkGatewayRouteAuth(auth string) gatewayRoutePreflightCheck {
	auth = strings.TrimSpace(auth)
	if auth == "" {
		return warnGatewayRouteCheck("auth", "auth policy is not set")
	}
	switch strings.ToLower(auth) {
	case "api key", "bearer", "oauth", "none":
		return passGatewayRouteCheck("auth", "auth policy is recognized")
	default:
		return warnGatewayRouteCheck("auth", "auth policy should be reviewed")
	}
}

func checkGatewayRouteLimit(limit string) gatewayRoutePreflightCheck {
	limit = strings.TrimSpace(limit)
	if limit == "" {
		return warnGatewayRouteCheck("limit", "rate limit is not set")
	}
	switch strings.ToLower(limit) {
	case "none", "unlimited":
		return warnGatewayRouteCheck("limit", "unlimited route should be reviewed before publish")
	}
	if _, ok := parseGatewayRateLimit(limit); !ok {
		return blockGatewayRouteCheck("limit", "rate limit must use formats like 600/min")
	}
	return passGatewayRouteCheck("limit", "rate limit is valid")
}

func checkGatewayRouteStatus(status string) gatewayRoutePreflightCheck {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "active":
		return passGatewayRouteCheck("lifecycle", "route is active")
	case "draft":
		return warnGatewayRouteCheck("lifecycle", "route is draft and can be published after review")
	default:
		return warnGatewayRouteCheck("lifecycle", "route lifecycle status should be reviewed")
	}
}

func checkGatewayRouteUpstream(health gatewayRouteHealthCheckResponse) gatewayRoutePreflightCheck {
	switch health.Status {
	case "Healthy":
		return passGatewayRouteCheck("upstream", "upstream probe is healthy")
	case "Degraded":
		return warnGatewayRouteCheck("upstream", "upstream responded with a server error")
	case "Invalid":
		return blockGatewayRouteCheck("upstream", "upstream is invalid: "+health.Error)
	default:
		message := "upstream is unreachable"
		if health.Error != "" {
			message += ": " + health.Error
		}
		return blockGatewayRouteCheck("upstream", message)
	}
}

func summarizeGatewayRoutePreflight(checks []gatewayRoutePreflightCheck) string {
	status := "Pass"
	for _, check := range checks {
		switch check.Status {
		case "Block":
			return "Block"
		case "Warn":
			status = "Warn"
		}
	}
	return status
}

func passGatewayRouteCheck(name, message string) gatewayRoutePreflightCheck {
	return gatewayRoutePreflightCheck{Name: name, Status: "Pass", Severity: "info", Message: message}
}

func warnGatewayRouteCheck(name, message string) gatewayRoutePreflightCheck {
	return gatewayRoutePreflightCheck{Name: name, Status: "Warn", Severity: "warning", Message: message}
}

func blockGatewayRouteCheck(name, message string) gatewayRoutePreflightCheck {
	return gatewayRoutePreflightCheck{Name: name, Status: "Block", Severity: "critical", Message: message}
}

func checkGatewayRouteHealth(ctx context.Context, route store.GatewayRoute, timeout time.Duration) gatewayRouteHealthCheckResponse {
	started := time.Now()
	result := gatewayRouteHealthCheckResponse{
		ID:        route.ID,
		Route:     route.Route,
		Upstream:  route.Upstream,
		Status:    "Invalid",
		CheckedAt: started.UTC().Format(time.RFC3339),
	}

	upstreams, err := validateGatewayProxyUpstreams(splitGatewayProxyUpstreams(route.Upstream))
	if err != nil {
		result.LatencyMS = time.Since(started).Milliseconds()
		result.Error = err.Error()
		return result
	}

	var degraded *gatewayRouteHealthCheckResponse
	var unreachable *gatewayRouteHealthCheckResponse
	for _, upstream := range upstreams {
		probe := result
		probe.Upstream = upstream
		statusCode, err := probeGatewayRouteUpstream(ctx, upstream, timeout)
		probe.LatencyMS = time.Since(started).Milliseconds()
		probe.StatusCode = statusCode
		if err != nil {
			probe.Status = "Unreachable"
			probe.Error = err.Error()
			unreachable = &probe
			continue
		}
		if statusCode >= http.StatusInternalServerError {
			probe.Status = "Degraded"
			if degraded == nil {
				degraded = &probe
			}
			continue
		}

		probe.Status = "Healthy"
		probe.Healthy = true
		return probe
	}

	if degraded != nil {
		return *degraded
	}
	if unreachable != nil {
		return *unreachable
	}
	result.LatencyMS = time.Since(started).Milliseconds()
	result.Error = "upstream is required"
	return result
}

func probeGatewayRouteUpstream(ctx context.Context, upstream string, timeout time.Duration) (int, error) {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	statusCode, err := probeGatewayRouteUpstreamWithMethod(ctx, http.MethodHead, upstream, timeout)
	if err == nil && statusCode != http.StatusMethodNotAllowed {
		return statusCode, nil
	}
	if err != nil {
		return 0, err
	}
	return probeGatewayRouteUpstreamWithMethod(ctx, http.MethodGet, upstream, timeout)
}

func probeGatewayRouteUpstreamWithMethod(ctx context.Context, method string, upstream string, timeout time.Duration) (int, error) {
	req, err := http.NewRequestWithContext(ctx, method, upstream, nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("User-Agent", "anjing-gateway-health-check/0.1")

	client := http.Client{Timeout: timeout}
	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	return resp.StatusCode, nil
}

func normalizeRouteHealthTimeout(timeoutMS int) time.Duration {
	if timeoutMS <= 0 {
		return defaultRouteHealthTimeout
	}
	timeout := time.Duration(timeoutMS) * time.Millisecond
	if timeout > maxRouteHealthTimeout {
		return maxRouteHealthTimeout
	}
	return timeout
}

func modelRoutesHandler(modelRoutes ModelRouteRepository) http.HandlerFunc {
	type createModelRouteRequest struct {
		Alias    string `json:"alias"`
		Scenario string `json:"scenario"`
		Primary  string `json:"primary"`
		Fallback string `json:"fallback"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			items, err := modelRoutes.ListModelRoutes(r.Context())
			if err != nil {
				httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
				return
			}
			httpjson.OK(w, items)
		case http.MethodPost:
			var req createModelRouteRequest
			if err := httpjson.Decode(r, &req); err != nil {
				httpjson.BadRequest(w, err.Error())
				return
			}
			if req.Alias == "" {
				httpjson.BadRequest(w, "alias is required")
				return
			}
			if req.Primary == "" {
				httpjson.BadRequest(w, "primary is required")
				return
			}
			if req.Scenario == "" {
				req.Scenario = "General"
			}
			if req.Fallback == "" {
				req.Fallback = "local-fallback"
			}
			route, err := modelRoutes.CreateModelRoute(r.Context(), CreateModelRouteInput{
				Alias:    req.Alias,
				Scenario: req.Scenario,
				Primary:  req.Primary,
				Fallback: req.Fallback,
			})
			if err != nil {
				httpjson.BadRequest(w, err.Error())
				return
			}
			httpjson.Created(w, route)
		default:
			httpjson.MethodNotAllowed(w)
		}
	}
}

func publishModelRouteHandler(modelRoutes ModelRouteRepository) http.HandlerFunc {
	type publishModelRouteRequest struct {
		ID string `json:"id"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodPost) {
			return
		}

		var req publishModelRouteRequest
		if err := httpjson.Decode(r, &req); err != nil {
			httpjson.BadRequest(w, err.Error())
			return
		}
		if req.ID == "" {
			httpjson.BadRequest(w, "id is required")
			return
		}

		route, ok, err := modelRoutes.PublishModelRoute(r.Context(), req.ID)
		if err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		if !ok {
			httpjson.NotFound(w, "model route not found")
			return
		}

		httpjson.OK(w, route)
	}
}

func skillsHandler(skills SkillRepository) http.HandlerFunc {
	type createSkillBindingRequest struct {
		Name          string `json:"name"`
		Protocol      string `json:"protocol"`
		Route         string `json:"route"`
		Timeout       string `json:"timeout"`
		SchemaVersion string `json:"schemaVersion"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			items, err := skills.ListSkills(r.Context())
			if err != nil {
				httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
				return
			}
			httpjson.OK(w, items)
		case http.MethodPost:
			var req createSkillBindingRequest
			if err := httpjson.Decode(r, &req); err != nil {
				httpjson.BadRequest(w, err.Error())
				return
			}
			if req.Name == "" {
				httpjson.BadRequest(w, "name is required")
				return
			}
			if req.Route == "" {
				httpjson.BadRequest(w, "route is required")
				return
			}
			if req.Protocol == "" {
				req.Protocol = "HTTP"
			}
			if req.Timeout == "" {
				req.Timeout = "8s"
			}
			if req.SchemaVersion == "" {
				req.SchemaVersion = "0.1"
			}
			skill, err := skills.CreateSkillBinding(r.Context(), CreateSkillBindingInput{
				Name:          req.Name,
				Protocol:      req.Protocol,
				Route:         req.Route,
				Timeout:       req.Timeout,
				SchemaVersion: req.SchemaVersion,
			})
			if err != nil {
				httpjson.BadRequest(w, err.Error())
				return
			}
			httpjson.Created(w, skill)
		default:
			httpjson.MethodNotAllowed(w)
		}
	}
}

func publishSkillBindingHandler(skills SkillRepository) http.HandlerFunc {
	type publishSkillBindingRequest struct {
		ID string `json:"id"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodPost) {
			return
		}

		var req publishSkillBindingRequest
		if err := httpjson.Decode(r, &req); err != nil {
			httpjson.BadRequest(w, err.Error())
			return
		}
		if req.ID == "" {
			httpjson.BadRequest(w, "id is required")
			return
		}

		skill, ok, err := skills.PublishSkillBinding(r.Context(), req.ID)
		if err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		if !ok {
			httpjson.NotFound(w, "skill binding not found")
			return
		}

		httpjson.OK(w, skill)
	}
}

func requestLogsHandler(requestLogs RequestLogRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodGet) {
			return
		}
		items, err := requestLogs.QueryRequestLogs(r.Context(), requestLogQueryFromRequest(r))
		if err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		httpjson.OK(w, items)
	}
}

func requestLogsExportHandler(requestLogs RequestLogRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodGet) {
			return
		}

		query := requestLogQueryFromRequest(r)
		if query.Limit == 0 {
			query.Limit = 500
		}
		items, err := requestLogs.QueryRequestLogs(r.Context(), query)
		if err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}

		rows := make([][]string, 0, len(items))
		for _, item := range items {
			rows = append(rows, []string{
				item.ID,
				item.Request,
				item.Consumer,
				item.Latency,
				item.Result,
				item.Status,
				item.CreatedAt,
			})
		}

		if err := csvexport.Write(w, "gateway-request-logs.csv", []string{
			"id",
			"request",
			"consumer",
			"latency",
			"result",
			"status",
			"createdAt",
		}, rows); err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
	}
}

func requestLogsRetentionPurgeHandler(requestLogs RequestLogRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodPost) {
			return
		}

		var req retention.PurgeRequest
		if err := httpjson.Decode(r, &req); err != nil {
			httpjson.BadRequest(w, err.Error())
			return
		}
		olderThanDays, err := retention.ResolveOlderThanDays(req.OlderThanDays)
		if err != nil {
			httpjson.BadRequest(w, err.Error())
			return
		}

		result, err := requestLogs.PurgeRequestLogsBefore(r.Context(), retention.Cutoff(olderThanDays), olderThanDays)
		if err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		httpjson.OK(w, result)
	}
}

func requestLogQueryFromRequest(r *http.Request) RequestLogQuery {
	values := r.URL.Query()
	return RequestLogQuery{
		Q:        strings.TrimSpace(values.Get("q")),
		Consumer: strings.TrimSpace(values.Get("consumer")),
		Status:   strings.TrimSpace(values.Get("status")),
		Limit:    parseListLimit(values.Get("limit")),
	}
}

func parseListLimit(value string) int {
	limit, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil || limit <= 0 {
		return 0
	}
	if limit > 500 {
		return 500
	}
	return limit
}
