package control

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/access"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/session"
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

func TestUserCanBeInvitedAndActivated(t *testing.T) {
	st := store.NewSeedStore()
	mux := http.NewServeMux()
	Register(mux, st)

	body := bytes.NewBufferString(`{"email":"new.dev@anjing.ai","org":"Engineering","role":"Developer"}`)
	createReq := httptest.NewRequest(http.MethodPost, "/api/control/users", body)
	createReq.Header.Set("Content-Type", "application/json")
	createRec := httptest.NewRecorder()
	mux.ServeHTTP(createRec, createReq)

	if createRec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", createRec.Code, createRec.Body.String())
	}

	var created struct {
		Success bool       `json:"success"`
		Data    store.User `json:"data"`
	}
	if err := json.Unmarshal(createRec.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode create response: %v", err)
	}
	if !created.Success || created.Data.Status != "Invited" || created.Data.MFA != "Pending" {
		t.Fatalf("expected invited user, got %+v", created)
	}

	activateBody := bytes.NewBufferString(`{"id":"` + created.Data.ID + `"}`)
	activateReq := httptest.NewRequest(http.MethodPost, "/api/control/users/activate", activateBody)
	activateReq.Header.Set("Content-Type", "application/json")
	activateRec := httptest.NewRecorder()
	mux.ServeHTTP(activateRec, activateReq)

	if activateRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", activateRec.Code, activateRec.Body.String())
	}

	var activated struct {
		Success bool       `json:"success"`
		Data    store.User `json:"data"`
	}
	if err := json.Unmarshal(activateRec.Body.Bytes(), &activated); err != nil {
		t.Fatalf("decode activate response: %v", err)
	}
	if !activated.Success || activated.Data.Status != "Active" || activated.Data.MFA != "Enabled" {
		t.Fatalf("expected active user, got %+v", activated)
	}
}

func TestCredentialCanBeRotated(t *testing.T) {
	st := store.NewSeedStore()
	mux := http.NewServeMux()
	Register(mux, st)

	credentials := st.ListCredentials()
	if len(credentials) == 0 {
		t.Fatal("seed store should contain credentials")
	}

	body := bytes.NewBufferString(`{"id":"` + credentials[0].ID + `"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/control/credentials/rotate", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var rotated struct {
		Success bool             `json:"success"`
		Data    store.Credential `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &rotated); err != nil {
		t.Fatalf("decode rotate response: %v", err)
	}
	if !rotated.Success || rotated.Data.Ref == credentials[0].Ref || rotated.Data.Status != "Active" {
		t.Fatalf("expected rotated credential, got %+v", rotated)
	}
}

func TestAPIKeyCanBeRevoked(t *testing.T) {
	st := store.NewSeedStore()
	mux := http.NewServeMux()
	Register(mux, st)

	keys := st.ListAPIKeys()
	if len(keys) == 0 {
		t.Fatal("seed store should contain api keys")
	}

	body := bytes.NewBufferString(`{"id":"` + keys[0].ID + `"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/control/api-keys/revoke", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var revoked struct {
		Success bool         `json:"success"`
		Data    store.APIKey `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &revoked); err != nil {
		t.Fatalf("decode revoke response: %v", err)
	}
	if !revoked.Success || revoked.Data.Status != "Revoked" {
		t.Fatalf("expected revoked api key, got %+v", revoked)
	}
}

func TestAuthSessionLifecycle(t *testing.T) {
	st := store.NewSeedStore()
	sessions := session.NewManager("test-secret", time.Hour)
	mux := http.NewServeMux()
	RegisterWithOptions(mux, st, Options{Sessions: sessions})
	handler := access.Middleware(access.Config{
		Mode:        access.ModeEnforced,
		BearerToken: map[string]access.Principal{},
		APIKey:      map[string]access.Principal{},
		Session:     sessions.Principal,
	}, mux)

	loginReq := httptest.NewRequest(
		http.MethodPost,
		"/api/control/auth/login",
		bytes.NewBufferString(`{"email":"lin.chen@anjing.ai"}`),
	)
	loginReq.Header.Set("Content-Type", "application/json")
	loginRec := httptest.NewRecorder()
	handler.ServeHTTP(loginRec, loginReq)

	if loginRec.Code != http.StatusOK {
		t.Fatalf("expected login 200, got %d: %s", loginRec.Code, loginRec.Body.String())
	}

	var login struct {
		Success bool            `json:"success"`
		Data    session.Session `json:"data"`
	}
	if err := json.Unmarshal(loginRec.Body.Bytes(), &login); err != nil {
		t.Fatalf("decode login response: %v", err)
	}
	if !login.Success || login.Data.Token == "" || login.Data.Principal.Role != access.RoleAdministrator {
		t.Fatalf("unexpected login response: %+v", login)
	}

	sessionReq := httptest.NewRequest(http.MethodGet, "/api/control/auth/session", nil)
	sessionReq.Header.Set("Authorization", "Bearer "+login.Data.Token)
	sessionRec := httptest.NewRecorder()
	handler.ServeHTTP(sessionRec, sessionReq)

	if sessionRec.Code != http.StatusOK {
		t.Fatalf("expected session 200, got %d: %s", sessionRec.Code, sessionRec.Body.String())
	}

	var current struct {
		Success bool `json:"success"`
		Data    struct {
			Authenticated bool             `json:"authenticated"`
			Principal     access.Principal `json:"principal"`
		} `json:"data"`
	}
	if err := json.Unmarshal(sessionRec.Body.Bytes(), &current); err != nil {
		t.Fatalf("decode session response: %v", err)
	}
	if !current.Success || !current.Data.Authenticated || current.Data.Principal.Subject != "lin.chen@anjing.ai" {
		t.Fatalf("unexpected session response: %+v", current)
	}

	logoutReq := httptest.NewRequest(http.MethodPost, "/api/control/auth/logout", bytes.NewBufferString(`{}`))
	logoutReq.Header.Set("Authorization", "Bearer "+login.Data.Token)
	logoutRec := httptest.NewRecorder()
	handler.ServeHTTP(logoutRec, logoutReq)

	if logoutRec.Code != http.StatusOK {
		t.Fatalf("expected logout 200, got %d: %s", logoutRec.Code, logoutRec.Body.String())
	}

	expiredReq := httptest.NewRequest(http.MethodGet, "/api/control/auth/session", nil)
	expiredReq.Header.Set("Authorization", "Bearer "+login.Data.Token)
	expiredRec := httptest.NewRecorder()
	handler.ServeHTTP(expiredRec, expiredReq)

	if expiredRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected revoked session to return 401, got %d", expiredRec.Code)
	}
}
