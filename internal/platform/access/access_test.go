package access

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestEnforcedModeRequiresCredential(t *testing.T) {
	handler := Middleware(testConfig(), okHandler())

	req := httptest.NewRequest(http.MethodGet, "/api/ops/dashboard", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestAdministratorCanAccessEveryAPI(t *testing.T) {
	handler := Middleware(testConfig(), okHandler())

	req := httptest.NewRequest(http.MethodPost, "/api/billing/plans", nil)
	req.Header.Set("Authorization", "Bearer admin-test-token")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestDeveloperCanConfigureGatewayButCannotChangeBillingPlans(t *testing.T) {
	handler := Middleware(testConfig(), okHandler())

	allowed := httptest.NewRequest(http.MethodPost, "/api/gateway/routes", nil)
	allowed.Header.Set("Authorization", "Bearer developer-test-token")
	allowedRec := httptest.NewRecorder()
	handler.ServeHTTP(allowedRec, allowed)
	if allowedRec.Code != http.StatusOK {
		t.Fatalf("expected gateway write to be allowed, got %d", allowedRec.Code)
	}

	denied := httptest.NewRequest(http.MethodPost, "/api/billing/plans", nil)
	denied.Header.Set("Authorization", "Bearer developer-test-token")
	deniedRec := httptest.NewRecorder()
	handler.ServeHTTP(deniedRec, denied)
	if deniedRec.Code != http.StatusForbidden {
		t.Fatalf("expected billing write to be forbidden, got %d", deniedRec.Code)
	}
}

func TestOperatorCanHandleOpsButCannotReadGatewayConfig(t *testing.T) {
	handler := Middleware(testConfig(), okHandler())

	allowed := httptest.NewRequest(http.MethodPost, "/api/ops/todos/resolve", nil)
	allowed.Header.Set("Authorization", "Bearer operator-test-token")
	allowedRec := httptest.NewRecorder()
	handler.ServeHTTP(allowedRec, allowed)
	if allowedRec.Code != http.StatusOK {
		t.Fatalf("expected ops write to be allowed, got %d", allowedRec.Code)
	}

	denied := httptest.NewRequest(http.MethodGet, "/api/gateway/routes", nil)
	denied.Header.Set("Authorization", "Bearer operator-test-token")
	deniedRec := httptest.NewRecorder()
	handler.ServeHTTP(deniedRec, denied)
	if deniedRec.Code != http.StatusForbidden {
		t.Fatalf("expected gateway config to be forbidden, got %d", deniedRec.Code)
	}
}

func TestAPIKeyUsesUserRoleBoundary(t *testing.T) {
	handler := Middleware(testConfig(), okHandler())

	allowed := httptest.NewRequest(http.MethodPost, "/api/gateway/llm/invoke", nil)
	allowed.Header.Set("X-API-Key", "customer-test-key")
	allowedRec := httptest.NewRecorder()
	handler.ServeHTTP(allowedRec, allowed)
	if allowedRec.Code != http.StatusOK {
		t.Fatalf("expected llm invoke to be allowed, got %d", allowedRec.Code)
	}

	denied := httptest.NewRequest(http.MethodPost, "/api/ops/todos/resolve", nil)
	denied.Header.Set("X-API-Key", "customer-test-key")
	deniedRec := httptest.NewRecorder()
	handler.ServeHTTP(deniedRec, denied)
	if deniedRec.Code != http.StatusForbidden {
		t.Fatalf("expected ops write to be forbidden, got %d", deniedRec.Code)
	}
}

func testConfig() Config {
	return Config{
		Mode: ModeEnforced,
		BearerToken: map[string]Principal{
			"admin-test-token": {
				Subject: "admin",
				Role:    RoleAdministrator,
				Method:  "bearer",
			},
			"developer-test-token": {
				Subject: "developer",
				Role:    RoleDeveloper,
				Method:  "bearer",
			},
			"operator-test-token": {
				Subject: "operator",
				Role:    RoleOperator,
				Method:  "bearer",
			},
		},
		APIKey: map[string]Principal{
			"customer-test-key": {
				Subject: "customer",
				Role:    RoleUser,
				Method:  "api_key",
			},
		},
	}
}

func okHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
}
