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
	"time"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/httpjson"
)

const (
	defaultProxyTimeout       = 3 * time.Second
	maxProxyTimeout           = 30 * time.Second
	maxProxyRetries           = 3
	maxProxyResponseBodyBytes = 1 << 20
)

var errActiveRouteNotFound = errors.New("active gateway route not found")

type gatewayProxyRequest struct {
	Route            string            `json:"route"`
	Method           string            `json:"method"`
	Upstream         string            `json:"upstream"`
	FallbackUpstream string            `json:"fallbackUpstream"`
	TimeoutMS        int               `json:"timeoutMs"`
	Retries          int               `json:"retries"`
	Headers          map[string]string `json:"headers"`
	Body             string            `json:"body"`
	Stream           bool              `json:"stream,omitempty"`
}

type gatewayProxyResponse struct {
	Route      string              `json:"route"`
	Upstream   string              `json:"upstream"`
	StatusCode int                 `json:"statusCode"`
	Attempts   int                 `json:"attempts"`
	Fallback   bool                `json:"fallback"`
	DurationMS int64               `json:"durationMs"`
	Headers    map[string][]string `json:"headers"`
	Body       string              `json:"body"`
	Streamed   bool                `json:"-"`
}

type resolvedProxyRoute struct {
	Upstream     string
	RoutePattern string
	Limit        string
}

func proxyHandler(routes RouteRepository, recorder ProxyRecorder) http.HandlerFunc {
	limiter := newGatewayRouteLimiter(time.Now)
	return proxyHandlerWithLimiter(routes, recorder, limiter)
}

func proxyHandlerWithLimiter(routes RouteRepository, recorder ProxyRecorder, limiter *gatewayRouteLimiter) http.HandlerFunc {
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

		resolved, err := resolveProxyRoute(r.Context(), routes, req.Route, req.Upstream)
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
		if decision := limiter.Allow(resolved.RoutePattern, resolved.Limit); !decision.Allowed {
			retryAfter := int(decision.RetryAfter.Seconds())
			if retryAfter < 1 {
				retryAfter = 1
			}
			w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
			result := gatewayProxyResponse{
				Route:      req.Route,
				Upstream:   req.Upstream,
				StatusCode: http.StatusTooManyRequests,
				Headers:    map[string][]string{},
			}
			if logErr := recordProxyRequest(r.Context(), recorder, req, result, "RateLimited"); logErr != nil {
				httpjson.Fail(w, http.StatusInternalServerError, "internal_error", logErr.Error())
				return
			}
			httpjson.Fail(w, http.StatusTooManyRequests, "rate_limited", fmt.Sprintf("route limit %s exceeded", resolved.Limit))
			return
		}

		if req.Stream {
			result, err := streamGatewayProxy(r.Context(), w, req)
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

func executeGatewayProxy(ctx context.Context, req gatewayProxyRequest) (gatewayProxyResponse, error) {
	started := time.Now()
	timeout := normalizeProxyTimeout(req.TimeoutMS)
	retries := normalizeProxyRetries(req.Retries)
	client := http.Client{Timeout: timeout}
	upstreams := []string{req.Upstream}
	if strings.TrimSpace(req.FallbackUpstream) != "" {
		upstreams = append(upstreams, strings.TrimSpace(req.FallbackUpstream))
	}

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
			Route:      req.Route,
			Upstream:   req.Upstream,
			Attempts:   attempts,
			DurationMS: time.Since(started).Milliseconds(),
			Headers:    map[string][]string{},
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
		return gatewayProxyResponse{Route: req.Route, Upstream: upstream, Headers: map[string][]string{}}, err
	}

	resp, err := client.Do(httpReq)
	if err != nil {
		return gatewayProxyResponse{Route: req.Route, Upstream: upstream, Headers: map[string][]string{}}, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxProxyResponseBodyBytes))
	if err != nil {
		return gatewayProxyResponse{Route: req.Route, Upstream: upstream, StatusCode: resp.StatusCode, Headers: cloneHeader(resp.Header)}, err
	}

	return gatewayProxyResponse{
		Route:      req.Route,
		Upstream:   upstream,
		StatusCode: resp.StatusCode,
		Headers:    cloneHeader(resp.Header),
		Body:       string(body),
	}, nil
}

func streamGatewayProxy(ctx context.Context, w http.ResponseWriter, req gatewayProxyRequest) (gatewayProxyResponse, error) {
	started := time.Now()
	timeout := normalizeProxyTimeout(req.TimeoutMS)
	retries := normalizeProxyRetries(req.Retries)
	client := http.Client{Timeout: timeout}
	upstreams := []string{req.Upstream}
	if strings.TrimSpace(req.FallbackUpstream) != "" {
		upstreams = append(upstreams, strings.TrimSpace(req.FallbackUpstream))
	}

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
				Route:    req.Route,
				Upstream: upstream,
				Attempts: attempts,
				Fallback: index > 0,
				Headers:  map[string][]string{},
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
			Route:      req.Route,
			Upstream:   req.Upstream,
			Attempts:   attempts,
			DurationMS: time.Since(started).Milliseconds(),
			Headers:    map[string][]string{},
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

func resolveProxyRoute(ctx context.Context, routes RouteRepository, route string, upstreamOverride string) (resolvedProxyRoute, error) {
	upstream := strings.TrimSpace(upstreamOverride)
	if upstream != "" {
		validated, err := validateProxyUpstream(upstream)
		if err != nil {
			return resolvedProxyRoute{}, err
		}
		return resolvedProxyRoute{Upstream: validated}, nil
	}

	items, err := routes.ListRoutes(ctx)
	if err != nil {
		return resolvedProxyRoute{}, fmt.Errorf("list gateway routes: %w", err)
	}
	for _, item := range items {
		if item.Status != "Active" {
			continue
		}
		if routeMatches(item.Route, route) {
			validated, err := validateProxyUpstream(item.Upstream)
			if err != nil {
				return resolvedProxyRoute{}, err
			}
			return resolvedProxyRoute{
				Upstream:     validated,
				RoutePattern: item.Route,
				Limit:        item.Limit,
			}, nil
		}
	}
	return resolvedProxyRoute{}, errActiveRouteNotFound
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
