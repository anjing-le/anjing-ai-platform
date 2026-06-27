package gateway

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
)

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
		"timeout":"6s"
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
	if !payload.Success || payload.Data.Name != "summarize-ticket" || payload.Data.Status != "Draft" {
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
	if !published.Success || published.Data.Status != "Published" || published.Data.Name != "summarize-ticket" {
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
