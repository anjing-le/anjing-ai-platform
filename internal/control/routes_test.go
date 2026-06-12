package control

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
)

func TestApplicationsCanBeCreatedAndListed(t *testing.T) {
	st := store.NewSeedStore()
	mux := http.NewServeMux()
	Register(mux, st)

	body := bytes.NewBufferString(`{
		"name":"agent-workbench",
		"owner":"owner@anjing.ai",
		"environment":"Sandbox",
		"defaultRoute":"/api/v1/llm/**",
		"plan":"Free"
	}`)
	createReq := httptest.NewRequest(http.MethodPost, "/api/control/applications", body)
	createReq.Header.Set("Content-Type", "application/json")
	createRec := httptest.NewRecorder()
	mux.ServeHTTP(createRec, createReq)

	if createRec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", createRec.Code, createRec.Body.String())
	}

	var created struct {
		Success bool              `json:"success"`
		Data    store.Application `json:"data"`
	}
	if err := json.Unmarshal(createRec.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode create response: %v", err)
	}
	if !created.Success || created.Data.Name != "agent-workbench" {
		t.Fatalf("unexpected create response: %+v", created)
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/control/applications", nil)
	listRec := httptest.NewRecorder()
	mux.ServeHTTP(listRec, listReq)

	if listRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", listRec.Code, listRec.Body.String())
	}

	var listed struct {
		Success bool                `json:"success"`
		Data    []store.Application `json:"data"`
	}
	if err := json.Unmarshal(listRec.Body.Bytes(), &listed); err != nil {
		t.Fatalf("decode list response: %v", err)
	}
	if !listed.Success || len(listed.Data) == 0 || listed.Data[0].Name != "agent-workbench" {
		t.Fatalf("expected newly created application first, got %+v", listed.Data)
	}
}
