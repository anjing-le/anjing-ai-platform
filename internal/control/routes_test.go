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

	activateBody := bytes.NewBufferString(`{"id":"` + created.Data.ID + `"}`)
	activateReq := httptest.NewRequest(http.MethodPost, "/api/control/applications/activate", activateBody)
	activateReq.Header.Set("Content-Type", "application/json")
	activateRec := httptest.NewRecorder()
	mux.ServeHTTP(activateRec, activateReq)

	if activateRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", activateRec.Code, activateRec.Body.String())
	}

	var activated struct {
		Success bool              `json:"success"`
		Data    store.Application `json:"data"`
	}
	if err := json.Unmarshal(activateRec.Body.Bytes(), &activated); err != nil {
		t.Fatalf("decode activate response: %v", err)
	}
	if !activated.Success || activated.Data.Status != "Active" {
		t.Fatalf("expected activated application, got %+v", activated)
	}

	rotateBody := bytes.NewBufferString(`{"id":"` + created.Data.ID + `"}`)
	rotateReq := httptest.NewRequest(http.MethodPost, "/api/control/applications/rotate-key", rotateBody)
	rotateReq.Header.Set("Content-Type", "application/json")
	rotateRec := httptest.NewRecorder()
	mux.ServeHTTP(rotateRec, rotateReq)

	if rotateRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rotateRec.Code, rotateRec.Body.String())
	}

	var rotated struct {
		Success bool              `json:"success"`
		Data    store.Application `json:"data"`
	}
	if err := json.Unmarshal(rotateRec.Body.Bytes(), &rotated); err != nil {
		t.Fatalf("decode rotate response: %v", err)
	}
	if !rotated.Success || rotated.Data.APIKey == created.Data.APIKey {
		t.Fatalf("expected rotated api key, got %+v", rotated)
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
	if listed.Data[0].Status != "Active" || listed.Data[0].APIKey != rotated.Data.APIKey {
		t.Fatalf("expected listed application to be active with rotated key, got %+v", listed.Data[0])
	}
}
