package gateway

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
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
			ModelAlias string `json:"modelAlias"`
			Provider   string `json:"provider"`
			Model      string `json:"model"`
			Usage      struct {
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
	if payload.Data.Usage.TotalTokens <= 0 {
		t.Fatalf("expected token usage, got %+v", payload.Data.Usage)
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
