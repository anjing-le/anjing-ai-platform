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

func TestListInvoiceSummaries(t *testing.T) {
	st := store.NewSeedStore()
	mux := http.NewServeMux()
	Register(mux, st)

	req := httptest.NewRequest(http.MethodGet, "/api/billing/invoices", nil)
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Success bool                          `json:"success"`
		Data    []store.BillingInvoiceSummary `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !payload.Success {
		t.Fatalf("expected success response, got %+v", payload)
	}

	var aigc store.BillingInvoiceSummary
	for _, item := range payload.Data {
		if item.Project == "aigc-lab" {
			aigc = item
			break
		}
	}

	if aigc.Project == "" {
		t.Fatalf("expected aigc-lab invoice summary in %+v", payload.Data)
	}
	if aigc.Status != "Warning" || aigc.Budget != "$360/day" || aigc.Cost != "$312" || aigc.Utilization != "87%" {
		t.Fatalf("unexpected aigc invoice summary: %+v", aigc)
	}
}

func TestRecordUsageEventIsIdempotent(t *testing.T) {
	st := store.NewSeedStore()
	initialUsageCount := len(st.ListUsage())
	mux := http.NewServeMux()
	Register(mux, st)

	body := bytes.NewBufferString(`{"eventId":"usage_evt_route","project":"customer-service-agent","tokens":"1280","skillCalls":"2","cost":"$0.0026"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/billing/usage-events", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	var created struct {
		Success bool              `json:"success"`
		Data    store.UsageRecord `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&created); err != nil {
		t.Fatalf("decode create response: %v", err)
	}
	if !created.Success || created.Data.ID != "usage_evt_route" || created.Data.Status != "Normal" {
		t.Fatalf("expected created usage event, got %+v", created)
	}

	retryBody := bytes.NewBufferString(`{"eventId":"usage_evt_route","project":"customer-service-agent","tokens":"9999","skillCalls":"9","cost":"$9.9999"}`)
	retryReq := httptest.NewRequest(http.MethodPost, "/api/billing/usage-events", retryBody)
	retryReq.Header.Set("Content-Type", "application/json")
	retryRec := httptest.NewRecorder()

	mux.ServeHTTP(retryRec, retryReq)

	if retryRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", retryRec.Code, retryRec.Body.String())
	}

	var retried struct {
		Success bool              `json:"success"`
		Data    store.UsageRecord `json:"data"`
	}
	if err := json.NewDecoder(retryRec.Body).Decode(&retried); err != nil {
		t.Fatalf("decode retry response: %v", err)
	}
	if !retried.Success || retried.Data.Tokens != "1280" || retried.Data.SkillCalls != "2" {
		t.Fatalf("expected original usage event on retry, got %+v", retried)
	}
	if got := len(st.ListUsage()); got != initialUsageCount+1 {
		t.Fatalf("expected one new usage record, got %d records from initial %d", got, initialUsageCount)
	}
}

func TestRecordUsageEventRefreshesBudgetAlert(t *testing.T) {
	st := store.NewSeedStore()
	mux := http.NewServeMux()
	Register(mux, st)

	body := bytes.NewBufferString(`{"eventId":"usage_evt_budget_warning","project":"customer-service-agent","tokens":"1000","skillCalls":"1","cost":"$50"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/billing/usage-events", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	alert := budgetAlertForProject(t, st.ListBudgetAlerts(), "customer-service-agent")
	if alert.Current != "$291" || alert.Status != "Warning" {
		t.Fatalf("expected refreshed warning budget alert, got %+v", alert)
	}

	retryBody := bytes.NewBufferString(`{"eventId":"usage_evt_budget_warning","project":"customer-service-agent","tokens":"1000","skillCalls":"1","cost":"$500"}`)
	retryReq := httptest.NewRequest(http.MethodPost, "/api/billing/usage-events", retryBody)
	retryReq.Header.Set("Content-Type", "application/json")
	retryRec := httptest.NewRecorder()

	mux.ServeHTTP(retryRec, retryReq)

	if retryRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", retryRec.Code, retryRec.Body.String())
	}

	alert = budgetAlertForProject(t, st.ListBudgetAlerts(), "customer-service-agent")
	if alert.Current != "$291" || alert.Status != "Warning" {
		t.Fatalf("expected idempotent retry to keep budget alert unchanged, got %+v", alert)
	}
}

func budgetAlertForProject(t *testing.T, alerts []store.BudgetAlert, project string) store.BudgetAlert {
	t.Helper()
	for _, alert := range alerts {
		if alert.Project == project {
			return alert
		}
	}
	t.Fatalf("expected budget alert for project %q in %+v", project, alerts)
	return store.BudgetAlert{}
}
