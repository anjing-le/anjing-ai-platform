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
	if logs := st.ListRequestLogs(); len(logs) < 3 {
		t.Fatalf("expected request log to be appended, got %d logs", len(logs))
	}
}
