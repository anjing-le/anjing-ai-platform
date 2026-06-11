package ops

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
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
