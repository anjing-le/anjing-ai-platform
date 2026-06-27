package gateway

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
)

type recordingRouteLimiter struct {
	decision     RateLimitDecision
	calls        int
	routePattern string
	limitValue   string
}

func (limiter *recordingRouteLimiter) Allow(_ context.Context, routePattern string, limitValue string) RateLimitDecision {
	limiter.calls++
	limiter.routePattern = routePattern
	limiter.limitValue = limitValue
	return limiter.decision
}

func TestCreateRouteAddsRoute(t *testing.T) {
	st := store.NewSeedStore()
	mux := http.NewServeMux()
	Register(mux, st)

	body := bytes.NewBufferString(`{"route":"/api/v1/demo/**","upstream":"gateway-api","limit":"600/min"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/gateway/routes", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Success bool               `json:"success"`
		Data    store.GatewayRoute `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !payload.Success || payload.Data.Route != "/api/v1/demo/**" {
		t.Fatalf("unexpected payload: %+v", payload)
	}

	publishBody := bytes.NewBufferString(`{"id":"` + payload.Data.ID + `"}`)
	publishReq := httptest.NewRequest(http.MethodPost, "/api/gateway/routes/publish", publishBody)
	publishReq.Header.Set("Content-Type", "application/json")
	publishRec := httptest.NewRecorder()

	mux.ServeHTTP(publishRec, publishReq)

	if publishRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", publishRec.Code, publishRec.Body.String())
	}

	var published struct {
		Success bool               `json:"success"`
		Data    store.GatewayRoute `json:"data"`
	}
	if err := json.NewDecoder(publishRec.Body).Decode(&published); err != nil {
		t.Fatalf("decode publish response: %v", err)
	}
	if !published.Success || published.Data.Status != "Active" {
		t.Fatalf("expected published route, got %+v", published)
	}

	if logs := st.ListRequestLogs(); len(logs) < 3 {
		t.Fatalf("expected request log to be appended, got %d logs", len(logs))
	}
}

func TestGatewayRouteHealthCheckReportsHealthy(t *testing.T) {
	st := store.NewSeedStore()
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodHead {
			t.Errorf("expected HEAD, got %s", r.Method)
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer upstream.Close()

	draft := st.CreateRoute("/api/v1/healthy/**", upstream.URL, "100/min")
	mux := http.NewServeMux()
	Register(mux, st)

	body := bytes.NewBufferString(`{"id":"` + draft.ID + `","timeoutMs":1000}`)
	req := httptest.NewRequest(http.MethodPost, "/api/gateway/routes/health-check", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Success bool `json:"success"`
		Data    struct {
			ID         string `json:"id"`
			Route      string `json:"route"`
			Upstream   string `json:"upstream"`
			Status     string `json:"status"`
			Healthy    bool   `json:"healthy"`
			StatusCode int    `json:"statusCode"`
			LatencyMS  int64  `json:"latencyMs"`
			CheckedAt  string `json:"checkedAt"`
			Error      string `json:"error"`
		} `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !payload.Success || payload.Data.ID != draft.ID || payload.Data.Route != draft.Route {
		t.Fatalf("unexpected health payload: %+v", payload)
	}
	if !payload.Data.Healthy || payload.Data.Status != "Healthy" || payload.Data.StatusCode != http.StatusNoContent {
		t.Fatalf("expected healthy route, got %+v", payload.Data)
	}
	if payload.Data.Upstream != upstream.URL || payload.Data.CheckedAt == "" || payload.Data.LatencyMS < 0 || payload.Data.Error != "" {
		t.Fatalf("unexpected health metadata: %+v", payload.Data)
	}
}

func TestGatewayRouteHealthCheckFallsBackToGetWhenHeadIsNotAllowed(t *testing.T) {
	st := store.NewSeedStore()
	getHits := 0
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodHead {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if r.Method != http.MethodGet {
			t.Errorf("expected GET fallback, got %s", r.Method)
		}
		getHits++
		w.WriteHeader(http.StatusOK)
	}))
	defer upstream.Close()

	draft := st.CreateRoute("/api/v1/headless/**", upstream.URL, "100/min")
	mux := http.NewServeMux()
	Register(mux, st)

	body := bytes.NewBufferString(`{"id":"` + draft.ID + `","timeoutMs":1000}`)
	req := httptest.NewRequest(http.MethodPost, "/api/gateway/routes/health-check", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Success bool `json:"success"`
		Data    struct {
			Status     string `json:"status"`
			Healthy    bool   `json:"healthy"`
			StatusCode int    `json:"statusCode"`
		} `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !payload.Success || !payload.Data.Healthy || payload.Data.Status != "Healthy" || payload.Data.StatusCode != http.StatusOK {
		t.Fatalf("expected GET fallback to report healthy, got %+v", payload)
	}
	if getHits != 1 {
		t.Fatalf("expected one GET fallback hit, got %d", getHits)
	}
}

func TestGatewayRouteHealthCheckReportsUnreachable(t *testing.T) {
	st := store.NewSeedStore()
	draft := st.CreateRoute("/api/v1/down/**", "http://127.0.0.1:1", "100/min")
	mux := http.NewServeMux()
	Register(mux, st)

	body := bytes.NewBufferString(`{"id":"` + draft.ID + `","timeoutMs":100}`)
	req := httptest.NewRequest(http.MethodPost, "/api/gateway/routes/health-check", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Success bool `json:"success"`
		Data    struct {
			Status     string `json:"status"`
			Healthy    bool   `json:"healthy"`
			StatusCode int    `json:"statusCode"`
			Error      string `json:"error"`
		} `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !payload.Success || payload.Data.Healthy || payload.Data.Status != "Unreachable" || payload.Data.StatusCode != 0 || payload.Data.Error == "" {
		t.Fatalf("expected unreachable route health, got %+v", payload)
	}
}

func TestGatewayRouteHealthCheckReportsInvalidUpstream(t *testing.T) {
	st := store.NewSeedStore()
	draft := st.CreateRoute("/api/v1/invalid/**", "gateway-api", "100/min")
	mux := http.NewServeMux()
	Register(mux, st)

	body := bytes.NewBufferString(`{"id":"` + draft.ID + `","timeoutMs":1000}`)
	req := httptest.NewRequest(http.MethodPost, "/api/gateway/routes/health-check", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Success bool `json:"success"`
		Data    struct {
			Status  string `json:"status"`
			Healthy bool   `json:"healthy"`
			Error   string `json:"error"`
		} `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !payload.Success || payload.Data.Healthy || payload.Data.Status != "Invalid" || !strings.Contains(payload.Data.Error, "upstream must start") {
		t.Fatalf("expected invalid upstream health, got %+v", payload)
	}
}

func TestGatewayRoutePreflightPassesHealthyPublishedRoute(t *testing.T) {
	st := store.NewSeedStore()
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodHead {
			t.Errorf("expected HEAD, got %s", r.Method)
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer upstream.Close()

	draft := st.CreateRoute("/api/v1/preflight/**", upstream.URL, "100/min")
	if _, ok := st.PublishRoute(draft.ID); !ok {
		t.Fatalf("expected route to publish")
	}
	mux := http.NewServeMux()
	Register(mux, st)

	body := bytes.NewBufferString(`{"id":"` + draft.ID + `","timeoutMs":1000}`)
	req := httptest.NewRequest(http.MethodPost, "/api/gateway/routes/preflight", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Success bool `json:"success"`
		Data    struct {
			ID     string `json:"id"`
			Status string `json:"status"`
			Ready  bool   `json:"ready"`
			Checks []struct {
				Name   string `json:"name"`
				Status string `json:"status"`
			} `json:"checks"`
			Health struct {
				Status  string `json:"status"`
				Healthy bool   `json:"healthy"`
			} `json:"health"`
		} `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !payload.Success || payload.Data.ID != draft.ID || payload.Data.Status != "Pass" || !payload.Data.Ready {
		t.Fatalf("expected passing preflight, got %+v", payload)
	}
	if !payload.Data.Health.Healthy || payload.Data.Health.Status != "Healthy" {
		t.Fatalf("expected healthy preflight probe, got %+v", payload.Data.Health)
	}
	if len(payload.Data.Checks) != 5 {
		t.Fatalf("expected five checks, got %+v", payload.Data.Checks)
	}
	for _, check := range payload.Data.Checks {
		if check.Status != "Pass" {
			t.Fatalf("expected all checks to pass, got %+v", payload.Data.Checks)
		}
	}
}

func TestGatewayRoutePreflightWarnsDraftButRemainsReady(t *testing.T) {
	st := store.NewSeedStore()
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer upstream.Close()

	draft := st.CreateRoute("/api/v1/draft/**", upstream.URL, "100/min")
	mux := http.NewServeMux()
	Register(mux, st)

	body := bytes.NewBufferString(`{"id":"` + draft.ID + `","timeoutMs":1000}`)
	req := httptest.NewRequest(http.MethodPost, "/api/gateway/routes/preflight", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Success bool `json:"success"`
		Data    struct {
			Status string `json:"status"`
			Ready  bool   `json:"ready"`
			Checks []struct {
				Name   string `json:"name"`
				Status string `json:"status"`
			} `json:"checks"`
		} `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !payload.Success || payload.Data.Status != "Warn" || !payload.Data.Ready {
		t.Fatalf("expected draft preflight warning without block, got %+v", payload)
	}
	foundLifecycleWarning := false
	for _, check := range payload.Data.Checks {
		if check.Name == "lifecycle" && check.Status == "Warn" {
			foundLifecycleWarning = true
		}
	}
	if !foundLifecycleWarning {
		t.Fatalf("expected lifecycle warning, got %+v", payload.Data.Checks)
	}
}

func TestGatewayRoutePreflightBlocksInvalidUpstream(t *testing.T) {
	st := store.NewSeedStore()
	draft := st.CreateRoute("/api/v1/preflight-invalid/**", "gateway-api", "100/min")
	mux := http.NewServeMux()
	Register(mux, st)

	body := bytes.NewBufferString(`{"id":"` + draft.ID + `","timeoutMs":1000}`)
	req := httptest.NewRequest(http.MethodPost, "/api/gateway/routes/preflight", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Success bool `json:"success"`
		Data    struct {
			Status string `json:"status"`
			Ready  bool   `json:"ready"`
			Checks []struct {
				Name    string `json:"name"`
				Status  string `json:"status"`
				Message string `json:"message"`
			} `json:"checks"`
			Health struct {
				Status string `json:"status"`
				Error  string `json:"error"`
			} `json:"health"`
		} `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !payload.Success || payload.Data.Status != "Block" || payload.Data.Ready {
		t.Fatalf("expected blocking preflight, got %+v", payload)
	}
	if payload.Data.Health.Status != "Invalid" || !strings.Contains(payload.Data.Health.Error, "upstream must start") {
		t.Fatalf("expected invalid upstream health, got %+v", payload.Data.Health)
	}
	foundUpstreamBlock := false
	for _, check := range payload.Data.Checks {
		if check.Name == "upstream" && check.Status == "Block" && strings.Contains(check.Message, "upstream must start") {
			foundUpstreamBlock = true
		}
	}
	if !foundUpstreamBlock {
		t.Fatalf("expected upstream block check, got %+v", payload.Data.Checks)
	}
}

func TestInvokeLLMUsesModelRoute(t *testing.T) {
	st := store.NewSeedStore()
	initialLogs := len(st.ListRequestLogs())
	initialUsage := len(st.ListUsage())
	mux := http.NewServeMux()
	Register(mux, st)

	body := bytes.NewBufferString(`{"modelAlias":"chat-default","input":"帮我生成一个客服回复"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/gateway/llm/invoke", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Success bool `json:"success"`
		Data    struct {
			ModelAlias   string `json:"modelAlias"`
			Provider     string `json:"provider"`
			Model        string `json:"model"`
			UsedFallback bool   `json:"usedFallback"`
			Usage        struct {
				TotalTokens int `json:"totalTokens"`
			} `json:"usage"`
		} `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !payload.Success || payload.Data.ModelAlias != "chat-default" {
		t.Fatalf("unexpected payload: %+v", payload)
	}
	if payload.Data.Provider != "mock-openai" || payload.Data.Model == "" {
		t.Fatalf("expected mock-openai model route, got %+v", payload.Data)
	}
	if payload.Data.UsedFallback {
		t.Fatalf("expected primary model route, got %+v", payload.Data)
	}
	if payload.Data.Usage.TotalTokens <= 0 {
		t.Fatalf("expected token usage, got %+v", payload.Data.Usage)
	}
	if logs := st.ListRequestLogs(); len(logs) != initialLogs+1 || logs[0].Consumer != "chat-default" || logs[0].Status != "Success" || logs[0].Result != "200" {
		t.Fatalf("expected llm request log to be appended, got %+v", logs)
	}
	if usage := st.ListUsage(); len(usage) != initialUsage+1 || usage[0].Project != "chat-default" || usage[0].Tokens == "0" {
		t.Fatalf("expected llm usage record to be appended, got %+v", usage)
	}
}

func TestStreamLLMUsesModelRoute(t *testing.T) {
	st := store.NewSeedStore()
	initialLogs := len(st.ListRequestLogs())
	initialUsage := len(st.ListUsage())
	mux := http.NewServeMux()
	Register(mux, st)

	body := bytes.NewBufferString(`{"modelAlias":"chat-default","input":"帮我生成一个流式客服回复"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/gateway/llm/stream", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if contentType := rec.Header().Get("Content-Type"); !strings.Contains(contentType, "text/event-stream") {
		t.Fatalf("expected text/event-stream content type, got %q", contentType)
	}
	bodyText := rec.Body.String()
	for _, expected := range []string{"event: meta", "event: delta", "event: done", "Mock response routed"} {
		if !strings.Contains(bodyText, expected) {
			t.Fatalf("expected stream body to contain %q, got %s", expected, bodyText)
		}
	}
	if logs := st.ListRequestLogs(); len(logs) != initialLogs+1 || logs[0].Consumer != "chat-default" || logs[0].Status != "Success" || logs[0].Result != "200" {
		t.Fatalf("expected stream request log to be appended, got %+v", logs)
	}
	if usage := st.ListUsage(); len(usage) != initialUsage+1 || usage[0].Project != "chat-default" || usage[0].Tokens == "0" {
		t.Fatalf("expected stream usage record to be appended, got %+v", usage)
	}
}

func TestInvokeLLMFallsBackWhenPrimaryProviderFails(t *testing.T) {
	st := store.NewSeedStore()
	route := st.CreateModelRoute("fallback-demo", "LLM fallback", "gpt-unavailable", "claude-haiku")
	if _, ok := st.PublishModelRoute(route.ID); !ok {
		t.Fatalf("expected model route to publish")
	}
	initialLogs := len(st.ListRequestLogs())
	initialUsage := len(st.ListUsage())
	mux := http.NewServeMux()
	Register(mux, st)

	body := bytes.NewBufferString(`{"modelAlias":"fallback-demo","input":"需要稳定兜底"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/gateway/llm/invoke", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Success bool `json:"success"`
		Data    struct {
			ModelAlias   string `json:"modelAlias"`
			Provider     string `json:"provider"`
			Model        string `json:"model"`
			UsedFallback bool   `json:"usedFallback"`
			Usage        struct {
				TotalTokens int `json:"totalTokens"`
			} `json:"usage"`
		} `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !payload.Success || payload.Data.ModelAlias != "fallback-demo" {
		t.Fatalf("unexpected payload: %+v", payload)
	}
	if !payload.Data.UsedFallback || payload.Data.Model != "claude-haiku" || payload.Data.Provider != "mock-anthropic" {
		t.Fatalf("expected anthropic fallback route, got %+v", payload.Data)
	}
	if payload.Data.Usage.TotalTokens <= 0 {
		t.Fatalf("expected fallback token usage, got %+v", payload.Data.Usage)
	}
	if logs := st.ListRequestLogs(); len(logs) != initialLogs+1 || logs[0].Consumer != "fallback-demo" || logs[0].Status != "Fallback" || logs[0].Result != "200" {
		t.Fatalf("expected fallback request log, got %+v", logs)
	}
	if usage := st.ListUsage(); len(usage) != initialUsage+1 || usage[0].Project != "fallback-demo" || usage[0].Tokens == "0" {
		t.Fatalf("expected fallback usage record, got %+v", usage)
	}
}

func TestInvokeLLMReturnsBadGatewayWhenAllProvidersFail(t *testing.T) {
	st := store.NewSeedStore()
	route := st.CreateModelRoute("down-route", "LLM failure", "gpt-unavailable", "local-fail")
	if _, ok := st.PublishModelRoute(route.ID); !ok {
		t.Fatalf("expected model route to publish")
	}
	initialLogs := len(st.ListRequestLogs())
	initialUsage := len(st.ListUsage())
	mux := http.NewServeMux()
	Register(mux, st)

	body := bytes.NewBufferString(`{"modelAlias":"down-route","input":"hello"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/gateway/llm/invoke", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadGateway {
		t.Fatalf("expected 502, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Success bool `json:"success"`
		Error   struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.Success || payload.Error.Code != "llm_unavailable" {
		t.Fatalf("expected llm_unavailable error, got %+v", payload)
	}
	if logs := st.ListRequestLogs(); len(logs) != initialLogs+1 || logs[0].Consumer != "down-route" || logs[0].Status != "Failed" || logs[0].Result != "502" {
		t.Fatalf("expected failed request log, got %+v", logs)
	}
	if usage := st.ListUsage(); len(usage) != initialUsage {
		t.Fatalf("expected failed invocation not to create usage, got %+v", usage)
	}
}

func TestRequestLogsCanBeFiltered(t *testing.T) {
	st := store.NewSeedStore()
	mux := http.NewServeMux()
	Register(mux, st)

	req := httptest.NewRequest(http.MethodGet, "/api/gateway/request-logs?q=chat&consumer=customer-service-agent&status=success&limit=1", nil)
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Success bool               `json:"success"`
		Data    []store.RequestLog `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !payload.Success || len(payload.Data) != 1 {
		t.Fatalf("expected one filtered request log, got %+v", payload)
	}
	if payload.Data[0].Consumer != "customer-service-agent" || payload.Data[0].Status != "Success" {
		t.Fatalf("unexpected request log: %+v", payload.Data[0])
	}
}

func TestRequestLogsCanBeExported(t *testing.T) {
	st := store.NewSeedStore()
	mux := http.NewServeMux()
	Register(mux, st)

	req := httptest.NewRequest(http.MethodGet, "/api/gateway/request-logs/export?q=chat&limit=1", nil)
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if contentType := rec.Header().Get("Content-Type"); !strings.Contains(contentType, "text/csv") {
		t.Fatalf("expected csv response, got %q", contentType)
	}
	body := rec.Body.String()
	if !strings.Contains(body, "id,request,consumer,latency,result,status,createdAt") {
		t.Fatalf("expected request log csv header, got %q", body)
	}
	if !strings.Contains(body, "customer-service-agent") || !strings.Contains(body, "POST /llm/chat") {
		t.Fatalf("expected filtered request log content, got %q", body)
	}
}

func TestRequestLogsCanBePurgedByRetention(t *testing.T) {
	st := store.NewSeedStore()
	initialLogs := len(st.ListRequestLogs())
	if initialLogs == 0 {
		t.Fatal("seed store should contain request logs")
	}

	mux := http.NewServeMux()
	Register(mux, st)

	body := bytes.NewBufferString(`{"olderThanDays":0}`)
	req := httptest.NewRequest(http.MethodPost, "/api/gateway/request-logs/retention/purge", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Success bool `json:"success"`
		Data    struct {
			Deleted       int `json:"deleted"`
			Retained      int `json:"retained"`
			OlderThanDays int `json:"olderThanDays"`
		} `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !payload.Success || payload.Data.Deleted != initialLogs || payload.Data.Retained != 0 || payload.Data.OlderThanDays != 0 {
		t.Fatalf("unexpected purge response: %+v", payload)
	}
	if logs := st.ListRequestLogs(); len(logs) != 0 {
		t.Fatalf("expected request logs to be purged, got %+v", logs)
	}
}

func TestProxyGatewayRetriesAndFallsBack(t *testing.T) {
	st := store.NewSeedStore()
	initialLogs := len(st.ListRequestLogs())
	mux := http.NewServeMux()
	Register(mux, st)

	primaryHits := 0
	primary := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		primaryHits++
		http.Error(w, "temporary outage", http.StatusBadGateway)
	}))
	defer primary.Close()

	fallback := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/proxy" {
			t.Errorf("expected proxied path, got %s", r.URL.Path)
		}
		if r.Header.Get("X-Request-Role") != "test" {
			t.Errorf("expected forwarded request header")
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer fallback.Close()

	body := bytes.NewBufferString(`{"route":"/api/v1/proxy","method":"POST","upstream":"` + primary.URL + `","fallbackUpstream":"` + fallback.URL + `","retries":1,"timeoutMs":1000,"headers":{"X-Request-Role":"test"},"body":"{\"hello\":\"world\"}"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/gateway/proxy", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Success bool `json:"success"`
		Data    struct {
			Route      string `json:"route"`
			Upstream   string `json:"upstream"`
			StatusCode int    `json:"statusCode"`
			Attempts   int    `json:"attempts"`
			Fallback   bool   `json:"fallback"`
			Body       string `json:"body"`
		} `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !payload.Success || payload.Data.Route != "/api/v1/proxy" || payload.Data.Upstream != fallback.URL {
		t.Fatalf("unexpected proxy payload: %+v", payload)
	}
	if payload.Data.StatusCode != http.StatusOK || payload.Data.Attempts != 3 || !payload.Data.Fallback {
		t.Fatalf("expected retry and fallback success, got %+v", payload.Data)
	}
	if primaryHits != 2 {
		t.Fatalf("expected primary to be tried twice, got %d", primaryHits)
	}
	if !strings.Contains(payload.Data.Body, `"ok":true`) {
		t.Fatalf("expected fallback response body, got %q", payload.Data.Body)
	}
	logs := st.ListRequestLogs()
	if len(logs) != initialLogs+1 || logs[0].Request != "POST /api/v1/proxy" || logs[0].Status != "Fallback" {
		t.Fatalf("expected fallback request log, got %+v", logs)
	}
}

func TestProxyGatewayResolvesPublishedRoute(t *testing.T) {
	st := store.NewSeedStore()
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("expected GET, got %s", r.Method)
		}
		if r.URL.Path != "/api/v1/configured/ping" || r.URL.RawQuery != "trace=1" {
			t.Errorf("expected configured route path and query, got %s?%s", r.URL.Path, r.URL.RawQuery)
		}
		w.WriteHeader(http.StatusAccepted)
		_, _ = w.Write([]byte(`accepted`))
	}))
	defer upstream.Close()

	draft := st.CreateRoute("/api/v1/configured/**", upstream.URL, "100/min")
	if _, ok := st.PublishRoute(draft.ID); !ok {
		t.Fatalf("expected route to publish")
	}
	initialLogs := len(st.ListRequestLogs())
	mux := http.NewServeMux()
	Register(mux, st)

	body := bytes.NewBufferString(`{"route":"/api/v1/configured/ping?trace=1","method":"GET","timeoutMs":1000}`)
	req := httptest.NewRequest(http.MethodPost, "/api/gateway/proxy", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Success bool `json:"success"`
		Data    struct {
			Upstream   string `json:"upstream"`
			StatusCode int    `json:"statusCode"`
			Attempts   int    `json:"attempts"`
			Fallback   bool   `json:"fallback"`
			Body       string `json:"body"`
		} `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !payload.Success || payload.Data.Upstream != upstream.URL || payload.Data.StatusCode != http.StatusAccepted {
		t.Fatalf("unexpected configured proxy payload: %+v", payload)
	}
	if payload.Data.Attempts != 1 || payload.Data.Fallback {
		t.Fatalf("expected single primary attempt, got %+v", payload.Data)
	}
	if payload.Data.Body != "accepted" {
		t.Fatalf("expected upstream body, got %q", payload.Data.Body)
	}
	logs := st.ListRequestLogs()
	if len(logs) != initialLogs+1 || logs[0].Request != "GET /api/v1/configured/ping?trace=1" || logs[0].Status != "Success" {
		t.Fatalf("expected resolved route request log, got %+v", logs)
	}
}

func TestProxyGatewayUsesRoundRobinRouteUpstreams(t *testing.T) {
	st := store.NewSeedStore()
	firstUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`first`))
	}))
	defer firstUpstream.Close()
	secondUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`second`))
	}))
	defer secondUpstream.Close()

	draft := st.CreateRoute("/api/v1/balanced/**", firstUpstream.URL+","+secondUpstream.URL, "100/min")
	if _, ok := st.PublishRoute(draft.ID); !ok {
		t.Fatalf("expected route to publish")
	}
	mux := http.NewServeMux()
	Register(mux, st)

	proxyOnce := func() struct {
		Success bool `json:"success"`
		Data    struct {
			Upstream           string   `json:"upstream"`
			Strategy           string   `json:"strategy"`
			CandidateUpstreams []string `json:"candidateUpstreams"`
			StatusCode         int      `json:"statusCode"`
			Attempts           int      `json:"attempts"`
		} `json:"data"`
	} {
		body := bytes.NewBufferString(`{"route":"/api/v1/balanced/ping","method":"GET","strategy":"round_robin","timeoutMs":1000}`)
		req := httptest.NewRequest(http.MethodPost, "/api/gateway/proxy", body)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
		}
		var payload struct {
			Success bool `json:"success"`
			Data    struct {
				Upstream           string   `json:"upstream"`
				Strategy           string   `json:"strategy"`
				CandidateUpstreams []string `json:"candidateUpstreams"`
				StatusCode         int      `json:"statusCode"`
				Attempts           int      `json:"attempts"`
			} `json:"data"`
		}
		if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
			t.Fatalf("decode response: %v", err)
		}
		return payload
	}

	first := proxyOnce()
	second := proxyOnce()

	if !first.Success || !second.Success || first.Data.StatusCode != http.StatusOK || second.Data.StatusCode != http.StatusOK {
		t.Fatalf("expected successful round robin responses, got %+v and %+v", first, second)
	}
	if first.Data.Strategy != "round_robin" || second.Data.Strategy != "round_robin" {
		t.Fatalf("expected round_robin strategy, got %+v and %+v", first.Data, second.Data)
	}
	if len(first.Data.CandidateUpstreams) != 2 || len(second.Data.CandidateUpstreams) != 2 {
		t.Fatalf("expected two candidate upstreams, got %+v and %+v", first.Data, second.Data)
	}
	if first.Data.Upstream == second.Data.Upstream {
		t.Fatalf("expected consecutive round robin requests to use different upstreams, got %s", first.Data.Upstream)
	}
	if first.Data.Attempts != 1 || second.Data.Attempts != 1 {
		t.Fatalf("expected single attempt per healthy upstream, got %+v and %+v", first.Data, second.Data)
	}
}

func TestProxyGatewayFallsBackAcrossExplicitUpstreams(t *testing.T) {
	st := store.NewSeedStore()
	primary := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "temporary outage", http.StatusBadGateway)
	}))
	defer primary.Close()
	secondary := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`secondary`))
	}))
	defer secondary.Close()
	mux := http.NewServeMux()
	Register(mux, st)

	body := bytes.NewBufferString(`{"route":"/api/v1/explicit","method":"GET","upstreams":["` + primary.URL + `","` + secondary.URL + `"],"strategy":"ordered","timeoutMs":1000}`)
	req := httptest.NewRequest(http.MethodPost, "/api/gateway/proxy", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var payload struct {
		Success bool `json:"success"`
		Data    struct {
			Upstream           string   `json:"upstream"`
			Strategy           string   `json:"strategy"`
			CandidateUpstreams []string `json:"candidateUpstreams"`
			StatusCode         int      `json:"statusCode"`
			Attempts           int      `json:"attempts"`
			Fallback           bool     `json:"fallback"`
			Body               string   `json:"body"`
		} `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !payload.Success || payload.Data.Upstream != secondary.URL || payload.Data.StatusCode != http.StatusOK {
		t.Fatalf("unexpected explicit upstream payload: %+v", payload)
	}
	if payload.Data.Strategy != "ordered" || len(payload.Data.CandidateUpstreams) != 2 {
		t.Fatalf("expected ordered candidates, got %+v", payload.Data)
	}
	if payload.Data.Attempts != 2 || !payload.Data.Fallback || payload.Data.Body != "secondary" {
		t.Fatalf("expected fallback across explicit upstreams, got %+v", payload.Data)
	}
}

func TestProxyGatewayStreamsUpstreamResponse(t *testing.T) {
	st := store.NewSeedStore()
	initialLogs := len(st.ListRequestLogs())
	mux := http.NewServeMux()
	Register(mux, st)

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("expected GET, got %s", r.Method)
		}
		if r.URL.Path != "/api/v1/events" {
			t.Errorf("expected stream route path, got %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("X-Upstream-Trace", "stream-test")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("event: delta\n"))
		_, _ = w.Write([]byte("data: first\n\n"))
		if flusher, ok := w.(http.Flusher); ok {
			flusher.Flush()
		}
		_, _ = w.Write([]byte("event: done\n"))
		_, _ = w.Write([]byte("data: ok\n\n"))
	}))
	defer upstream.Close()

	body := bytes.NewBufferString(`{"route":"/api/v1/events","method":"GET","upstream":"` + upstream.URL + `","stream":true,"timeoutMs":1000}`)
	req := httptest.NewRequest(http.MethodPost, "/api/gateway/proxy", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Header().Get("Content-Type"), "text/event-stream") {
		t.Fatalf("expected text/event-stream content type, got %q", rec.Header().Get("Content-Type"))
	}
	if rec.Header().Get("X-Upstream-Trace") != "stream-test" {
		t.Fatalf("expected upstream trace header to be forwarded")
	}
	bodyText := rec.Body.String()
	for _, expected := range []string{"event: delta", "data: first", "event: done", "data: ok"} {
		if !strings.Contains(bodyText, expected) {
			t.Fatalf("expected stream body to contain %q, got %q", expected, bodyText)
		}
	}

	logs := st.ListRequestLogs()
	if len(logs) != initialLogs+1 || logs[0].Request != "GET /api/v1/events" || logs[0].Status != "Success" || logs[0].Result != "200" {
		t.Fatalf("expected successful stream request log, got %+v", logs)
	}
}

func TestProxyGatewayEnforcesPublishedRouteLimit(t *testing.T) {
	st := store.NewSeedStore()
	hits := 0
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits++
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`ok`))
	}))
	defer upstream.Close()

	draft := st.CreateRoute("/api/v1/limited/**", upstream.URL, "1/min")
	if _, ok := st.PublishRoute(draft.ID); !ok {
		t.Fatalf("expected route to publish")
	}
	initialLogs := len(st.ListRequestLogs())
	mux := http.NewServeMux()
	Register(mux, st)

	proxyOnce := func() *httptest.ResponseRecorder {
		body := bytes.NewBufferString(`{"route":"/api/v1/limited/ping","method":"GET","timeoutMs":1000}`)
		req := httptest.NewRequest(http.MethodPost, "/api/gateway/proxy", body)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		return rec
	}

	first := proxyOnce()
	if first.Code != http.StatusOK {
		t.Fatalf("expected first request to pass, got %d: %s", first.Code, first.Body.String())
	}

	second := proxyOnce()
	if second.Code != http.StatusTooManyRequests {
		t.Fatalf("expected second request to be rate limited, got %d: %s", second.Code, second.Body.String())
	}
	if second.Header().Get("Retry-After") == "" {
		t.Fatalf("expected Retry-After header")
	}
	if hits != 1 {
		t.Fatalf("expected only one upstream hit, got %d", hits)
	}

	logs := st.ListRequestLogs()
	if len(logs) != initialLogs+2 {
		t.Fatalf("expected two proxy logs, got %+v", logs)
	}
	if logs[0].Status != "RateLimited" || logs[0].Result != "429" {
		t.Fatalf("expected latest request log to be rate limited, got %+v", logs[0])
	}
	if logs[1].Status != "Success" || logs[1].Result != "200" {
		t.Fatalf("expected first request log to be successful, got %+v", logs[1])
	}
}

func TestProxyGatewayUsesInjectedRouteLimiter(t *testing.T) {
	st := store.NewSeedStore()
	hits := 0
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits++
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`ok`))
	}))
	defer upstream.Close()

	draft := st.CreateRoute("/api/v1/injected/**", upstream.URL, "100/min")
	if _, ok := st.PublishRoute(draft.ID); !ok {
		t.Fatalf("expected route to publish")
	}

	limiter := &recordingRouteLimiter{
		decision: RateLimitDecision{Allowed: false, RetryAfter: 2 * time.Second},
	}
	mux := http.NewServeMux()
	RegisterWithRepositoriesAndOptions(mux, st, NewMemoryRepositories(st), Options{RateLimiter: limiter})

	body := bytes.NewBufferString(`{"route":"/api/v1/injected/ping","method":"GET","timeoutMs":1000}`)
	req := httptest.NewRequest(http.MethodPost, "/api/gateway/proxy", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("expected injected limiter to deny request, got %d: %s", rec.Code, rec.Body.String())
	}
	if rec.Header().Get("Retry-After") != "2" {
		t.Fatalf("expected Retry-After 2, got %q", rec.Header().Get("Retry-After"))
	}
	if limiter.calls != 1 || limiter.routePattern != "/api/v1/injected/**" || limiter.limitValue != "100/min" {
		t.Fatalf("expected limiter to receive published route metadata, got %+v", limiter)
	}
	if hits != 0 {
		t.Fatalf("expected denied request not to hit upstream, got %d hits", hits)
	}
}

func TestProxyGatewayOpensCircuitAfterFailures(t *testing.T) {
	st := store.NewSeedStore()
	hits := 0
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits++
		http.Error(w, "temporary outage", http.StatusBadGateway)
	}))
	defer upstream.Close()

	draft := st.CreateRoute("/api/v1/circuit/**", upstream.URL, "100/min")
	if _, ok := st.PublishRoute(draft.ID); !ok {
		t.Fatalf("expected route to publish")
	}

	now := time.Date(2026, 6, 27, 10, 0, 0, 0, time.UTC)
	breaker := newMemoryRouteCircuitBreakerWithClock(RouteCircuitBreakerConfig{
		FailureThreshold: 1,
		Cooldown:         time.Minute,
	}, func() time.Time {
		return now
	})
	initialLogs := len(st.ListRequestLogs())
	mux := http.NewServeMux()
	RegisterWithRepositoriesAndOptions(mux, st, NewMemoryRepositories(st), Options{CircuitBreaker: breaker})

	proxyOnce := func() *httptest.ResponseRecorder {
		body := bytes.NewBufferString(`{"route":"/api/v1/circuit/ping","method":"GET","timeoutMs":1000}`)
		req := httptest.NewRequest(http.MethodPost, "/api/gateway/proxy", body)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		return rec
	}

	first := proxyOnce()
	if first.Code != http.StatusBadGateway {
		t.Fatalf("expected first request to fail through upstream, got %d: %s", first.Code, first.Body.String())
	}

	second := proxyOnce()
	if second.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected second request to be denied by circuit breaker, got %d: %s", second.Code, second.Body.String())
	}
	if second.Header().Get("Retry-After") != "60" {
		t.Fatalf("expected Retry-After 60, got %q", second.Header().Get("Retry-After"))
	}
	if !strings.Contains(second.Body.String(), "upstream_circuit_open") {
		t.Fatalf("expected circuit open response body, got %s", second.Body.String())
	}
	if hits != 1 {
		t.Fatalf("expected circuit-open request not to hit upstream, got %d hits", hits)
	}

	logs := st.ListRequestLogs()
	if len(logs) != initialLogs+2 {
		t.Fatalf("expected two proxy logs, got %+v", logs)
	}
	if logs[0].Status != "CircuitOpen" || logs[0].Result != "503" {
		t.Fatalf("expected latest request log to be circuit-open, got %+v", logs[0])
	}
	if logs[1].Status != "Failed" || logs[1].Result != "502" {
		t.Fatalf("expected first request log to be upstream failure, got %+v", logs[1])
	}
}

func TestRedisRouteLimiterFallsBackWhenRedisUnavailable(t *testing.T) {
	fallback := &recordingRouteLimiter{
		decision: RateLimitDecision{Allowed: false, RetryAfter: 3 * time.Second},
	}
	limiter, err := NewRedisRouteLimiter(RedisRouteLimiterConfig{
		Addr:     "127.0.0.1:0",
		Timeout:  10 * time.Millisecond,
		Fallback: fallback,
	})
	if err != nil {
		t.Fatalf("create redis limiter: %v", err)
	}
	defer limiter.Close()

	decision := limiter.Allow(context.Background(), "/api/v1/redis/**", "1/min")

	if decision.Allowed || decision.RetryAfter != 3*time.Second {
		t.Fatalf("expected fallback decision, got %+v", decision)
	}
	if fallback.calls != 1 || fallback.routePattern != "/api/v1/redis/**" || fallback.limitValue != "1/min" {
		t.Fatalf("expected fallback limiter to be called with route metadata, got %+v", fallback)
	}
}

func TestRouteCircuitBreakerAllowsAfterCooldown(t *testing.T) {
	now := time.Date(2026, 6, 27, 10, 0, 0, 0, time.UTC)
	breaker := newMemoryRouteCircuitBreakerWithClock(RouteCircuitBreakerConfig{
		FailureThreshold: 1,
		Cooldown:         time.Minute,
	}, func() time.Time {
		return now
	})
	key := "/api/v1/circuit/** -> http://upstream"

	if decision := breaker.Allow(key); !decision.Allowed {
		t.Fatalf("expected initial request to be allowed, got %+v", decision)
	}
	breaker.Record(key, true)

	denied := breaker.Allow(key)
	if denied.Allowed || denied.RetryAfter != time.Minute {
		t.Fatalf("expected open circuit for one minute, got %+v", denied)
	}

	now = now.Add(time.Minute + time.Second)
	if decision := breaker.Allow(key); !decision.Allowed {
		t.Fatalf("expected request to be allowed after cooldown, got %+v", decision)
	}
	breaker.Record(key, true)
	if decision := breaker.Allow(key); decision.Allowed {
		t.Fatalf("expected failed half-open probe to reopen circuit, got %+v", decision)
	}

	now = now.Add(time.Minute + time.Second)
	if decision := breaker.Allow(key); !decision.Allowed {
		t.Fatalf("expected second probe after cooldown to be allowed, got %+v", decision)
	}
	breaker.Record(key, false)
	if decision := breaker.Allow(key); !decision.Allowed {
		t.Fatalf("expected successful probe to reset circuit, got %+v", decision)
	}
}

func TestCreateModelRouteAddsDraftAlias(t *testing.T) {
	st := store.NewSeedStore()
	mux := http.NewServeMux()
	Register(mux, st)

	body := bytes.NewBufferString(`{
		"alias":"vision-default",
		"scenario":"AIGC",
		"primary":"gpt-4.1-mini",
		"fallback":"local-vision"
	}`)
	req := httptest.NewRequest(http.MethodPost, "/api/gateway/model-routes", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Success bool             `json:"success"`
		Data    store.ModelRoute `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !payload.Success || payload.Data.Alias != "vision-default" || payload.Data.Status != "Draft" {
		t.Fatalf("expected draft model route, got %+v", payload)
	}

	publishBody := bytes.NewBufferString(`{"id":"` + payload.Data.ID + `"}`)
	publishReq := httptest.NewRequest(http.MethodPost, "/api/gateway/model-routes/publish", publishBody)
	publishReq.Header.Set("Content-Type", "application/json")
	publishRec := httptest.NewRecorder()

	mux.ServeHTTP(publishRec, publishReq)

	if publishRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", publishRec.Code, publishRec.Body.String())
	}

	var published struct {
		Success bool             `json:"success"`
		Data    store.ModelRoute `json:"data"`
	}
	if err := json.NewDecoder(publishRec.Body).Decode(&published); err != nil {
		t.Fatalf("decode publish response: %v", err)
	}
	if !published.Success || published.Data.Status != "Active" || published.Data.Alias != "vision-default" {
		t.Fatalf("expected published model route, got %+v", published)
	}
}

func TestCreateSkillBindingAddsDraftSkill(t *testing.T) {
	st := store.NewSeedStore()
	mux := http.NewServeMux()
	Register(mux, st)

	body := bytes.NewBufferString(`{
		"name":"summarize-ticket",
		"protocol":"HTTP",
		"route":"/api/v1/skills/summarize",
		"timeout":"6s",
		"schemaVersion":"0.2"
	}`)
	req := httptest.NewRequest(http.MethodPost, "/api/gateway/skills", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Success bool               `json:"success"`
		Data    store.SkillBinding `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !payload.Success || payload.Data.Name != "summarize-ticket" || payload.Data.Status != "Draft" || payload.Data.SchemaVersion != "0.2" {
		t.Fatalf("expected draft skill binding, got %+v", payload)
	}

	publishBody := bytes.NewBufferString(`{"id":"` + payload.Data.ID + `"}`)
	publishReq := httptest.NewRequest(http.MethodPost, "/api/gateway/skills/publish", publishBody)
	publishReq.Header.Set("Content-Type", "application/json")
	publishRec := httptest.NewRecorder()

	mux.ServeHTTP(publishRec, publishReq)

	if publishRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", publishRec.Code, publishRec.Body.String())
	}

	var published struct {
		Success bool               `json:"success"`
		Data    store.SkillBinding `json:"data"`
	}
	if err := json.NewDecoder(publishRec.Body).Decode(&published); err != nil {
		t.Fatalf("decode publish response: %v", err)
	}
	if !published.Success || published.Data.Status != "Published" || published.Data.Name != "summarize-ticket" || published.Data.SchemaVersion != "0.2" {
		t.Fatalf("expected published skill binding, got %+v", published)
	}
}

func TestInvokeSkillUsesPublishedBinding(t *testing.T) {
	st := store.NewSeedStore()
	initialLogs := len(st.ListRequestLogs())
	initialUsage := len(st.ListUsage())
	mux := http.NewServeMux()
	Register(mux, st)

	body := bytes.NewBufferString(`{"name":"search-knowledge","input":{"query":"退款政策"}}`)
	req := httptest.NewRequest(http.MethodPost, "/api/gateway/skills/invoke", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Success bool `json:"success"`
		Data    struct {
			Name     string `json:"name"`
			Protocol string `json:"protocol"`
			Route    string `json:"route"`
			Output   struct {
				Summary   string   `json:"summary"`
				InputKeys []string `json:"inputKeys"`
			} `json:"output"`
			Usage struct {
				SkillCalls int `json:"skillCalls"`
			} `json:"usage"`
		} `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !payload.Success || payload.Data.Name != "search-knowledge" || payload.Data.Protocol != "MCP" {
		t.Fatalf("unexpected payload: %+v", payload)
	}
	if payload.Data.Route != "/api/v1/skills/search" || !strings.Contains(payload.Data.Output.Summary, "search-knowledge") {
		t.Fatalf("expected skill output, got %+v", payload.Data)
	}
	if len(payload.Data.Output.InputKeys) != 1 || payload.Data.Output.InputKeys[0] != "query" || payload.Data.Usage.SkillCalls != 1 {
		t.Fatalf("expected skill usage and input keys, got %+v", payload.Data)
	}
	if logs := st.ListRequestLogs(); len(logs) != initialLogs+1 || logs[0].Consumer != "search-knowledge" || logs[0].Status != "Success" || logs[0].Result != "200" {
		t.Fatalf("expected skill request log to be appended, got %+v", logs)
	}
	if usage := st.ListUsage(); len(usage) != initialUsage+1 || usage[0].Project != "search-knowledge" || usage[0].Tokens != "0" || usage[0].SkillCalls != "1" {
		t.Fatalf("expected skill usage record to be appended, got %+v", usage)
	}
}

func TestInvokeSkillCallsHTTPBinding(t *testing.T) {
	st := store.NewSeedStore()
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("expected POST, got %s", r.Method)
		}
		if r.Header.Get("Content-Type") != "application/json" || r.Header.Get("Accept") != "application/json" {
			t.Fatalf("expected json headers, got content-type=%q accept=%q", r.Header.Get("Content-Type"), r.Header.Get("Accept"))
		}
		if r.Header.Get("X-Anjing-Skill-Name") != "search-knowledge" || r.Header.Get("X-Anjing-Skill-Schema") != "0.1" {
			t.Fatalf("expected skill headers, got name=%q schema=%q", r.Header.Get("X-Anjing-Skill-Name"), r.Header.Get("X-Anjing-Skill-Schema"))
		}
		if r.Header.Get("X-Anjing-Skill-Call-ID") == "" {
			t.Fatalf("expected call id header")
		}

		var req struct {
			ID    string         `json:"id"`
			Name  string         `json:"name"`
			Input map[string]any `json:"input"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode upstream request: %v", err)
		}
		if req.ID == "" || req.Name != "search-knowledge" || req.Input["query"] != "退款政策" {
			t.Fatalf("unexpected upstream request: %+v", req)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"output":{"summary":"HTTP skill handled query","provider":"http-adapter"}}`))
	}))
	defer upstream.Close()

	skill := st.CreateSkillBinding("search-knowledge", "HTTP", upstream.URL+"/skills/search", "1s", "0.1")
	if _, ok := st.PublishSkillBinding(skill.ID); !ok {
		t.Fatalf("expected skill binding to publish")
	}
	initialLogs := len(st.ListRequestLogs())
	initialUsage := len(st.ListUsage())
	mux := http.NewServeMux()
	Register(mux, st)

	body := bytes.NewBufferString(`{"name":"search-knowledge","input":{"query":"退款政策"}}`)
	req := httptest.NewRequest(http.MethodPost, "/api/gateway/skills/invoke", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Success bool `json:"success"`
		Data    struct {
			Name     string         `json:"name"`
			Protocol string         `json:"protocol"`
			Route    string         `json:"route"`
			Output   map[string]any `json:"output"`
			Usage    struct {
				SkillCalls int `json:"skillCalls"`
			} `json:"usage"`
		} `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !payload.Success || payload.Data.Protocol != "HTTP" || payload.Data.Route != upstream.URL+"/skills/search" {
		t.Fatalf("unexpected payload: %+v", payload)
	}
	if payload.Data.Output["summary"] != "HTTP skill handled query" || payload.Data.Output["provider"] != "http-adapter" || payload.Data.Usage.SkillCalls != 1 {
		t.Fatalf("expected HTTP adapter output and usage, got %+v", payload.Data)
	}
	if logs := st.ListRequestLogs(); len(logs) != initialLogs+1 || logs[0].Consumer != "search-knowledge" || logs[0].Status != "Success" || logs[0].Result != "200" {
		t.Fatalf("expected skill request log to be appended, got %+v", logs)
	}
	if usage := st.ListUsage(); len(usage) != initialUsage+1 || usage[0].Project != "search-knowledge" || usage[0].SkillCalls != "1" {
		t.Fatalf("expected skill usage record to be appended, got %+v", usage)
	}
}

func TestInvokeSkillRejectsInvalidInputSchema(t *testing.T) {
	st := store.NewSeedStore()
	initialLogs := len(st.ListRequestLogs())
	initialUsage := len(st.ListUsage())
	mux := http.NewServeMux()
	Register(mux, st)

	body := bytes.NewBufferString(`{"name":"search-knowledge","input":{"text":"退款政策"}}`)
	req := httptest.NewRequest(http.MethodPost, "/api/gateway/skills/invoke", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Success bool `json:"success"`
		Error   struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.Success || payload.Error.Code != "bad_request" || !strings.Contains(payload.Error.Message, "input.query") {
		t.Fatalf("expected schema validation error, got %+v", payload)
	}
	if logs := st.ListRequestLogs(); len(logs) != initialLogs {
		t.Fatalf("expected invalid skill input not to append logs, got %+v", logs)
	}
	if usage := st.ListUsage(); len(usage) != initialUsage {
		t.Fatalf("expected invalid skill input not to append usage, got %+v", usage)
	}
}

func TestInvokeSkillRejectsDraftBinding(t *testing.T) {
	st := store.NewSeedStore()
	mux := http.NewServeMux()
	Register(mux, st)

	body := bytes.NewBufferString(`{"name":"send-message","input":{"text":"hello"}}`)
	req := httptest.NewRequest(http.MethodPost, "/api/gateway/skills/invoke", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestInvokeSkillRecordsFailedInvocation(t *testing.T) {
	st := store.NewSeedStore()
	skill := st.CreateSkillBinding("fail-skill", "HTTP", "/api/v1/skills/fail", "8s")
	if _, ok := st.PublishSkillBinding(skill.ID); !ok {
		t.Fatalf("expected skill binding to publish")
	}
	initialLogs := len(st.ListRequestLogs())
	initialUsage := len(st.ListUsage())
	mux := http.NewServeMux()
	Register(mux, st)

	body := bytes.NewBufferString(`{"name":"fail-skill","input":{"text":"hello"}}`)
	req := httptest.NewRequest(http.MethodPost, "/api/gateway/skills/invoke", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadGateway {
		t.Fatalf("expected 502, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Success bool `json:"success"`
		Error   struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.Success || payload.Error.Code != "skill_unavailable" {
		t.Fatalf("expected skill_unavailable error, got %+v", payload)
	}
	if logs := st.ListRequestLogs(); len(logs) != initialLogs+1 || logs[0].Consumer != "fail-skill" || logs[0].Status != "Failed" || logs[0].Result != "502" {
		t.Fatalf("expected failed skill request log, got %+v", logs)
	}
	if usage := st.ListUsage(); len(usage) != initialUsage {
		t.Fatalf("expected failed skill invocation not to create usage, got %+v", usage)
	}
}

func TestInvokeLLMRejectsUnknownModelRoute(t *testing.T) {
	st := store.NewSeedStore()
	mux := http.NewServeMux()
	Register(mux, st)

	body := bytes.NewBufferString(`{"modelAlias":"missing-model","input":"hello"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/gateway/llm/invoke", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", rec.Code, rec.Body.String())
	}
}
