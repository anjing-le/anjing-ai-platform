package billing

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
)

func TestCreateAndActivatePlan(t *testing.T) {
	st := store.NewSeedStore()
	mux := http.NewServeMux()
	Register(mux, st)

	body := bytes.NewBufferString(`{"name":"Scale","rps":"900","tokenPerDay":"8M"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/billing/plans", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	var created struct {
		Success bool              `json:"success"`
		Data    store.BillingPlan `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&created); err != nil {
		t.Fatalf("decode create response: %v", err)
	}
	if !created.Success || created.Data.Status != "Draft" {
		t.Fatalf("expected draft plan, got %+v", created)
	}

	activateBody := bytes.NewBufferString(`{"id":"` + created.Data.ID + `"}`)
	activateReq := httptest.NewRequest(http.MethodPost, "/api/billing/plans/activate", activateBody)
	activateReq.Header.Set("Content-Type", "application/json")
	activateRec := httptest.NewRecorder()

	mux.ServeHTTP(activateRec, activateReq)

	if activateRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", activateRec.Code, activateRec.Body.String())
	}

	var activated struct {
		Success bool              `json:"success"`
		Data    store.BillingPlan `json:"data"`
	}
	if err := json.NewDecoder(activateRec.Body).Decode(&activated); err != nil {
		t.Fatalf("decode activate response: %v", err)
	}
	if !activated.Success || activated.Data.Status != "Active" {
		t.Fatalf("expected active plan, got %+v", activated)
	}
}

func TestResolveBudgetAlert(t *testing.T) {
	st := store.NewSeedStore()
	alerts := st.ListBudgetAlerts()
	if len(alerts) == 0 {
		t.Fatal("seed store should contain budget alerts")
	}

	mux := http.NewServeMux()
	Register(mux, st)

	body := bytes.NewBufferString(`{"id":"` + alerts[0].ID + `"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/billing/budget-alerts/resolve", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Success bool              `json:"success"`
		Data    store.BudgetAlert `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !payload.Success || payload.Data.Status != "Resolved" {
		t.Fatalf("expected resolved alert, got %+v", payload)
	}
}
