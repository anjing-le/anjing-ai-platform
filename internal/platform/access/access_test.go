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

	publishAllowed := httptest.NewRequest(http.MethodPost, "/api/gateway/routes/publish", nil)
	publishAllowed.Header.Set("Authorization", "Bearer developer-test-token")
	publishAllowedRec := httptest.NewRecorder()
	handler.ServeHTTP(publishAllowedRec, publishAllowed)
	if publishAllowedRec.Code != http.StatusOK {
		t.Fatalf("expected gateway publish to be allowed, got %d", publishAllowedRec.Code)
	}

	modelRouteAllowed := httptest.NewRequest(http.MethodPost, "/api/gateway/model-routes", nil)
	modelRouteAllowed.Header.Set("Authorization", "Bearer developer-test-token")
	modelRouteAllowedRec := httptest.NewRecorder()
	handler.ServeHTTP(modelRouteAllowedRec, modelRouteAllowed)
	if modelRouteAllowedRec.Code != http.StatusOK {
		t.Fatalf("expected model route write to be allowed, got %d", modelRouteAllowedRec.Code)
	}

	modelRoutePublishAllowed := httptest.NewRequest(http.MethodPost, "/api/gateway/model-routes/publish", nil)
	modelRoutePublishAllowed.Header.Set("Authorization", "Bearer developer-test-token")
	modelRoutePublishAllowedRec := httptest.NewRecorder()
	handler.ServeHTTP(modelRoutePublishAllowedRec, modelRoutePublishAllowed)
	if modelRoutePublishAllowedRec.Code != http.StatusOK {
		t.Fatalf("expected model route publish to be allowed, got %d", modelRoutePublishAllowedRec.Code)
	}

	skillAllowed := httptest.NewRequest(http.MethodPost, "/api/gateway/skills", nil)
	skillAllowed.Header.Set("Authorization", "Bearer developer-test-token")
	skillAllowedRec := httptest.NewRecorder()
	handler.ServeHTTP(skillAllowedRec, skillAllowed)
	if skillAllowedRec.Code != http.StatusOK {
		t.Fatalf("expected skill binding write to be allowed, got %d", skillAllowedRec.Code)
	}

	skillPublishAllowed := httptest.NewRequest(http.MethodPost, "/api/gateway/skills/publish", nil)
	skillPublishAllowed.Header.Set("Authorization", "Bearer developer-test-token")
	skillPublishAllowedRec := httptest.NewRecorder()
	handler.ServeHTTP(skillPublishAllowedRec, skillPublishAllowed)
	if skillPublishAllowedRec.Code != http.StatusOK {
		t.Fatalf("expected skill binding publish to be allowed, got %d", skillPublishAllowedRec.Code)
	}

	denied := httptest.NewRequest(http.MethodPost, "/api/billing/plans", nil)
	denied.Header.Set("Authorization", "Bearer developer-test-token")
	deniedRec := httptest.NewRecorder()
	handler.ServeHTTP(deniedRec, denied)
	if deniedRec.Code != http.StatusForbidden {
		t.Fatalf("expected billing write to be forbidden, got %d", deniedRec.Code)
	}

	activateDenied := httptest.NewRequest(http.MethodPost, "/api/billing/plans/activate", nil)
	activateDenied.Header.Set("Authorization", "Bearer developer-test-token")
	activateDeniedRec := httptest.NewRecorder()
	handler.ServeHTTP(activateDeniedRec, activateDenied)
	if activateDeniedRec.Code != http.StatusForbidden {
		t.Fatalf("expected billing activation to be forbidden, got %d", activateDeniedRec.Code)
	}

	budgetResolveDenied := httptest.NewRequest(http.MethodPost, "/api/billing/budget-alerts/resolve", nil)
	budgetResolveDenied.Header.Set("Authorization", "Bearer developer-test-token")
	budgetResolveDeniedRec := httptest.NewRecorder()
	handler.ServeHTTP(budgetResolveDeniedRec, budgetResolveDenied)
	if budgetResolveDeniedRec.Code != http.StatusForbidden {
		t.Fatalf("expected budget alert resolve to be forbidden, got %d", budgetResolveDeniedRec.Code)
	}
}

func TestUserAndDeveloperCanCreateApplications(t *testing.T) {
	handler := Middleware(testConfig(), okHandler())

	userReq := httptest.NewRequest(http.MethodPost, "/api/control/applications", nil)
	userReq.Header.Set("Authorization", "Bearer user-test-token")
	userRec := httptest.NewRecorder()
	handler.ServeHTTP(userRec, userReq)
	if userRec.Code != http.StatusOK {
		t.Fatalf("expected user self-service application create to be allowed, got %d", userRec.Code)
	}

	developerReq := httptest.NewRequest(http.MethodPost, "/api/control/applications", nil)
	developerReq.Header.Set("Authorization", "Bearer developer-test-token")
	developerRec := httptest.NewRecorder()
	handler.ServeHTTP(developerRec, developerReq)
	if developerRec.Code != http.StatusOK {
		t.Fatalf("expected developer application create to be allowed, got %d", developerRec.Code)
	}

	activateReq := httptest.NewRequest(http.MethodPost, "/api/control/applications/activate", nil)
	activateReq.Header.Set("Authorization", "Bearer developer-test-token")
	activateRec := httptest.NewRecorder()
	handler.ServeHTTP(activateRec, activateReq)
	if activateRec.Code != http.StatusOK {
		t.Fatalf("expected developer application activation to be allowed, got %d", activateRec.Code)
	}

	rotateReq := httptest.NewRequest(http.MethodPost, "/api/control/applications/rotate-key", nil)
	rotateReq.Header.Set("Authorization", "Bearer developer-test-token")
	rotateRec := httptest.NewRecorder()
	handler.ServeHTTP(rotateRec, rotateReq)
	if rotateRec.Code != http.StatusOK {
		t.Fatalf("expected developer application key rotation to be allowed, got %d", rotateRec.Code)
	}

	credentialRotateDenied := httptest.NewRequest(http.MethodPost, "/api/control/credentials/rotate", nil)
	credentialRotateDenied.Header.Set("Authorization", "Bearer developer-test-token")
	credentialRotateDeniedRec := httptest.NewRecorder()
	handler.ServeHTTP(credentialRotateDeniedRec, credentialRotateDenied)
	if credentialRotateDeniedRec.Code != http.StatusForbidden {
		t.Fatalf("expected credential rotation to be forbidden for developer, got %d", credentialRotateDeniedRec.Code)
	}

	keyRevokeDenied := httptest.NewRequest(http.MethodPost, "/api/control/api-keys/revoke", nil)
	keyRevokeDenied.Header.Set("Authorization", "Bearer developer-test-token")
	keyRevokeDeniedRec := httptest.NewRecorder()
	handler.ServeHTTP(keyRevokeDeniedRec, keyRevokeDenied)
	if keyRevokeDeniedRec.Code != http.StatusForbidden {
		t.Fatalf("expected api key revoke to be forbidden for developer, got %d", keyRevokeDeniedRec.Code)
	}

	userActivateDenied := httptest.NewRequest(http.MethodPost, "/api/control/users/activate", nil)
	userActivateDenied.Header.Set("Authorization", "Bearer developer-test-token")
	userActivateDeniedRec := httptest.NewRecorder()
	handler.ServeHTTP(userActivateDeniedRec, userActivateDenied)
	if userActivateDeniedRec.Code != http.StatusForbidden {
		t.Fatalf("expected user activation to be forbidden for developer, got %d", userActivateDeniedRec.Code)
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

	budgetAllowed := httptest.NewRequest(http.MethodPost, "/api/billing/budget-alerts/resolve", nil)
	budgetAllowed.Header.Set("Authorization", "Bearer operator-test-token")
	budgetAllowedRec := httptest.NewRecorder()
	handler.ServeHTTP(budgetAllowedRec, budgetAllowed)
	if budgetAllowedRec.Code != http.StatusOK {
		t.Fatalf("expected budget alert handling to be allowed, got %d", budgetAllowedRec.Code)
	}

	denied := httptest.NewRequest(http.MethodGet, "/api/gateway/routes", nil)
	denied.Header.Set("Authorization", "Bearer operator-test-token")
	deniedRec := httptest.NewRecorder()
	handler.ServeHTTP(deniedRec, denied)
	if deniedRec.Code != http.StatusForbidden {
		t.Fatalf("expected gateway config to be forbidden, got %d", deniedRec.Code)
	}

	publishDenied := httptest.NewRequest(http.MethodPost, "/api/gateway/routes/publish", nil)
	publishDenied.Header.Set("Authorization", "Bearer operator-test-token")
	publishDeniedRec := httptest.NewRecorder()
	handler.ServeHTTP(publishDeniedRec, publishDenied)
	if publishDeniedRec.Code != http.StatusForbidden {
		t.Fatalf("expected gateway publish to be forbidden for operator, got %d", publishDeniedRec.Code)
	}

	modelRouteDenied := httptest.NewRequest(http.MethodPost, "/api/gateway/model-routes", nil)
	modelRouteDenied.Header.Set("Authorization", "Bearer operator-test-token")
	modelRouteDeniedRec := httptest.NewRecorder()
	handler.ServeHTTP(modelRouteDeniedRec, modelRouteDenied)
	if modelRouteDeniedRec.Code != http.StatusForbidden {
		t.Fatalf("expected model route write to be forbidden for operator, got %d", modelRouteDeniedRec.Code)
	}

	modelRoutePublishDenied := httptest.NewRequest(http.MethodPost, "/api/gateway/model-routes/publish", nil)
	modelRoutePublishDenied.Header.Set("Authorization", "Bearer operator-test-token")
	modelRoutePublishDeniedRec := httptest.NewRecorder()
	handler.ServeHTTP(modelRoutePublishDeniedRec, modelRoutePublishDenied)
	if modelRoutePublishDeniedRec.Code != http.StatusForbidden {
		t.Fatalf("expected model route publish to be forbidden for operator, got %d", modelRoutePublishDeniedRec.Code)
	}

	skillDenied := httptest.NewRequest(http.MethodPost, "/api/gateway/skills", nil)
	skillDenied.Header.Set("Authorization", "Bearer operator-test-token")
	skillDeniedRec := httptest.NewRecorder()
	handler.ServeHTTP(skillDeniedRec, skillDenied)
	if skillDeniedRec.Code != http.StatusForbidden {
		t.Fatalf("expected skill binding write to be forbidden for operator, got %d", skillDeniedRec.Code)
	}

	skillPublishDenied := httptest.NewRequest(http.MethodPost, "/api/gateway/skills/publish", nil)
	skillPublishDenied.Header.Set("Authorization", "Bearer operator-test-token")
	skillPublishDeniedRec := httptest.NewRecorder()
	handler.ServeHTTP(skillPublishDeniedRec, skillPublishDenied)
	if skillPublishDeniedRec.Code != http.StatusForbidden {
		t.Fatalf("expected skill binding publish to be forbidden for operator, got %d", skillPublishDeniedRec.Code)
	}

	appDenied := httptest.NewRequest(http.MethodGet, "/api/control/applications", nil)
	appDenied.Header.Set("Authorization", "Bearer operator-test-token")
	appDeniedRec := httptest.NewRecorder()
	handler.ServeHTTP(appDeniedRec, appDenied)
	if appDeniedRec.Code != http.StatusForbidden {
		t.Fatalf("expected application config to be forbidden for operator, got %d", appDeniedRec.Code)
	}

	appActivateDenied := httptest.NewRequest(http.MethodPost, "/api/control/applications/activate", nil)
	appActivateDenied.Header.Set("Authorization", "Bearer operator-test-token")
	appActivateDeniedRec := httptest.NewRecorder()
	handler.ServeHTTP(appActivateDeniedRec, appActivateDenied)
	if appActivateDeniedRec.Code != http.StatusForbidden {
		t.Fatalf("expected application activation to be forbidden for operator, got %d", appActivateDeniedRec.Code)
	}

	appRotateDenied := httptest.NewRequest(http.MethodPost, "/api/control/applications/rotate-key", nil)
	appRotateDenied.Header.Set("Authorization", "Bearer operator-test-token")
	appRotateDeniedRec := httptest.NewRecorder()
	handler.ServeHTTP(appRotateDeniedRec, appRotateDenied)
	if appRotateDeniedRec.Code != http.StatusForbidden {
		t.Fatalf("expected application key rotation to be forbidden for operator, got %d", appRotateDeniedRec.Code)
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
			"user-test-token": {
				Subject: "user",
				Role:    RoleUser,
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
