package ops

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
)

func TestResolveTodo(t *testing.T) {
	st := store.NewSeedStore()
	todos := st.ListTodos()
	if len(todos) == 0 {
		t.Fatal("seed store should contain todos")
	}

	mux := http.NewServeMux()
	Register(mux, st)

	body := bytes.NewBufferString(`{"id":"` + todos[0].ID + `"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/ops/todos/resolve", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Success bool          `json:"success"`
		Data    store.OpsTodo `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !payload.Success || payload.Data.Status != "Resolved" {
		t.Fatalf("unexpected payload: %+v", payload)
	}
}

func TestDashboardPendingMetricFollowsResolvedTodos(t *testing.T) {
	st := store.NewSeedStore()
	todos := st.ListTodos()
	if len(todos) == 0 {
		t.Fatal("seed store should contain todos")
	}

	mux := http.NewServeMux()
	Register(mux, st)

	before := requestDashboard(t, mux)
	beforePending := metricValue(t, before.Data.Metrics, "待处理")
	if beforePending != "3" {
		t.Fatalf("expected 3 pending todos before resolve, got %s", beforePending)
	}

	body := bytes.NewBufferString(`{"id":"` + todos[0].ID + `"}`)
	resolveReq := httptest.NewRequest(http.MethodPost, "/api/ops/todos/resolve", body)
	resolveReq.Header.Set("Content-Type", "application/json")
	resolveRec := httptest.NewRecorder()
	mux.ServeHTTP(resolveRec, resolveReq)

	if resolveRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resolveRec.Code, resolveRec.Body.String())
	}

	after := requestDashboard(t, mux)
	afterPending := metricValue(t, after.Data.Metrics, "待处理")
	if afterPending != "2" {
		t.Fatalf("expected 2 pending todos after resolve, got %s", afterPending)
	}
	if len(after.Data.Todos) != len(todos) || after.Data.Todos[0].Status != "Resolved" {
		t.Fatalf("expected dashboard todos to include resolved item, got %+v", after.Data.Todos)
	}
}

func TestPlatformSnapshotIncludesConsoleData(t *testing.T) {
	st := store.NewSeedStore()
	mux := http.NewServeMux()
	Register(mux, st)

	req := httptest.NewRequest(http.MethodGet, "/api/ops/platform-snapshot", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Success bool                   `json:"success"`
		Data    store.PlatformSnapshot `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode snapshot response: %v", err)
	}
	if !payload.Success {
		t.Fatalf("expected successful snapshot response, got %+v", payload)
	}
	if len(payload.Data.Users) == 0 || len(payload.Data.Routes) == 0 || len(payload.Data.Plans) == 0 {
		t.Fatalf("expected snapshot to include users, routes and plans: %+v", payload.Data)
	}
	if metricValue(t, payload.Data.Dashboard.Metrics, "待处理") != "3" {
		t.Fatalf("expected pending metric to be included in snapshot")
	}
}

func TestAuditEventsCanBeFiltered(t *testing.T) {
	st := store.NewSeedStore()
	mux := http.NewServeMux()
	Register(mux, st)

	req := httptest.NewRequest(http.MethodGet, "/api/ops/audit-events?q=skill&module=%E7%BD%91%E5%85%B3%E4%B8%8E%E6%A8%A1%E5%9E%8B&status=success&limit=1", nil)
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Success bool               `json:"success"`
		Data    []store.AuditEvent `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !payload.Success || len(payload.Data) != 1 {
		t.Fatalf("expected one filtered audit event, got %+v", payload)
	}
	if payload.Data[0].Module != "网关与模型" || payload.Data[0].Status != "Success" {
		t.Fatalf("unexpected audit event: %+v", payload.Data[0])
	}
}

func TestAuditEventsCanBeExported(t *testing.T) {
	st := store.NewSeedStore()
	mux := http.NewServeMux()
	Register(mux, st)

	req := httptest.NewRequest(http.MethodGet, "/api/ops/audit-events/export?q=skill&limit=1", nil)
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if contentType := rec.Header().Get("Content-Type"); !strings.Contains(contentType, "text/csv") {
		t.Fatalf("expected csv response, got %q", contentType)
	}
	body := rec.Body.String()
	if !strings.Contains(body, "id,time,module,action,object,status,requestId") {
		t.Fatalf("expected audit csv header, got %q", body)
	}
	if !strings.Contains(body, "skill") || !strings.Contains(body, "Success") {
		t.Fatalf("expected filtered audit content, got %q", body)
	}
}

func TestAuditEventsCanBePurgedByRetention(t *testing.T) {
	st := store.NewSeedStore()
	initialEvents := len(st.ListAudit())
	if initialEvents == 0 {
		t.Fatal("seed store should contain audit events")
	}

	mux := http.NewServeMux()
	Register(mux, st)

	body := bytes.NewBufferString(`{"olderThanDays":0}`)
	req := httptest.NewRequest(http.MethodPost, "/api/ops/audit-events/retention/purge", body)
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
	if !payload.Success || payload.Data.Deleted != initialEvents || payload.Data.Retained != 0 || payload.Data.OlderThanDays != 0 {
		t.Fatalf("unexpected purge response: %+v", payload)
	}
	if events := st.ListAudit(); len(events) != 0 {
		t.Fatalf("expected audit events to be purged, got %+v", events)
	}
}

func requestDashboard(t *testing.T, mux *http.ServeMux) struct {
	Success bool               `json:"success"`
	Data    store.OpsDashboard `json:"data"`
} {
	t.Helper()

	req := httptest.NewRequest(http.MethodGet, "/api/ops/dashboard", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Success bool               `json:"success"`
		Data    store.OpsDashboard `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode dashboard response: %v", err)
	}
	if !payload.Success {
		t.Fatalf("expected successful dashboard response, got %+v", payload)
	}
	return payload
}

func metricValue(t *testing.T, metrics []store.Metric, label string) string {
	t.Helper()

	for _, metric := range metrics {
		if metric.Label == label {
			return metric.Value
		}
	}
	t.Fatalf("metric %q not found in %+v", label, metrics)
	return ""
}
