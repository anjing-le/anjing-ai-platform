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

	updateAllowed := httptest.NewRequest(http.MethodPost, "/api/gateway/routes/update", nil)
	updateAllowed.Header.Set("Authorization", "Bearer developer-test-token")
	updateAllowedRec := httptest.NewRecorder()
	handler.ServeHTTP(updateAllowedRec, updateAllowed)
	if updateAllowedRec.Code != http.StatusOK {
		t.Fatalf("expected gateway route update to be allowed, got %d", updateAllowedRec.Code)
	}

	publishAllowed := httptest.NewRequest(http.MethodPost, "/api/gateway/routes/publish", nil)
	publishAllowed.Header.Set("Authorization", "Bearer developer-test-token")
	publishAllowedRec := httptest.NewRecorder()
	handler.ServeHTTP(publishAllowedRec, publishAllowed)
	if publishAllowedRec.Code != http.StatusOK {
		t.Fatalf("expected gateway publish to be allowed, got %d", publishAllowedRec.Code)
	}

	healthCheckAllowed := httptest.NewRequest(http.MethodPost, "/api/gateway/routes/health-check", nil)
	healthCheckAllowed.Header.Set("Authorization", "Bearer developer-test-token")
	healthCheckAllowedRec := httptest.NewRecorder()
	handler.ServeHTTP(healthCheckAllowedRec, healthCheckAllowed)
	if healthCheckAllowedRec.Code != http.StatusOK {
		t.Fatalf("expected gateway route health check to be allowed, got %d", healthCheckAllowedRec.Code)
	}

	preflightAllowed := httptest.NewRequest(http.MethodPost, "/api/gateway/routes/preflight", nil)
	preflightAllowed.Header.Set("Authorization", "Bearer developer-test-token")
	preflightAllowedRec := httptest.NewRecorder()
	handler.ServeHTTP(preflightAllowedRec, preflightAllowed)
	if preflightAllowedRec.Code != http.StatusOK {
		t.Fatalf("expected gateway route preflight to be allowed, got %d", preflightAllowedRec.Code)
	}

	modelRouteAllowed := httptest.NewRequest(http.MethodPost, "/api/gateway/model-routes", nil)
	modelRouteAllowed.Header.Set("Authorization", "Bearer developer-test-token")
	modelRouteAllowedRec := httptest.NewRecorder()
	handler.ServeHTTP(modelRouteAllowedRec, modelRouteAllowed)
	if modelRouteAllowedRec.Code != http.StatusOK {
		t.Fatalf("expected model route write to be allowed, got %d", modelRouteAllowedRec.Code)
	}

	modelRouteUpdateAllowed := httptest.NewRequest(http.MethodPost, "/api/gateway/model-routes/update", nil)
	modelRouteUpdateAllowed.Header.Set("Authorization", "Bearer developer-test-token")
	modelRouteUpdateAllowedRec := httptest.NewRecorder()
	handler.ServeHTTP(modelRouteUpdateAllowedRec, modelRouteUpdateAllowed)
	if modelRouteUpdateAllowedRec.Code != http.StatusOK {
		t.Fatalf("expected model route update to be allowed, got %d", modelRouteUpdateAllowedRec.Code)
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

	skillUpdateAllowed := httptest.NewRequest(http.MethodPost, "/api/gateway/skills/update", nil)
	skillUpdateAllowed.Header.Set("Authorization", "Bearer developer-test-token")
	skillUpdateAllowedRec := httptest.NewRecorder()
	handler.ServeHTTP(skillUpdateAllowedRec, skillUpdateAllowed)
	if skillUpdateAllowedRec.Code != http.StatusOK {
		t.Fatalf("expected skill binding update to be allowed, got %d", skillUpdateAllowedRec.Code)
	}

	skillPublishAllowed := httptest.NewRequest(http.MethodPost, "/api/gateway/skills/publish", nil)
	skillPublishAllowed.Header.Set("Authorization", "Bearer developer-test-token")
	skillPublishAllowedRec := httptest.NewRecorder()
	handler.ServeHTTP(skillPublishAllowedRec, skillPublishAllowed)
	if skillPublishAllowedRec.Code != http.StatusOK {
		t.Fatalf("expected skill binding publish to be allowed, got %d", skillPublishAllowedRec.Code)
	}

	skillInvokeAllowed := httptest.NewRequest(http.MethodPost, "/api/gateway/skills/invoke", nil)
	skillInvokeAllowed.Header.Set("Authorization", "Bearer developer-test-token")
	skillInvokeAllowedRec := httptest.NewRecorder()
	handler.ServeHTTP(skillInvokeAllowedRec, skillInvokeAllowed)
	if skillInvokeAllowedRec.Code != http.StatusOK {
		t.Fatalf("expected skill invocation to be allowed, got %d", skillInvokeAllowedRec.Code)
	}

	skillSchemaAllowed := httptest.NewRequest(http.MethodGet, "/api/gateway/skill-schemas", nil)
	skillSchemaAllowed.Header.Set("Authorization", "Bearer developer-test-token")
	skillSchemaAllowedRec := httptest.NewRecorder()
	handler.ServeHTTP(skillSchemaAllowedRec, skillSchemaAllowed)
	if skillSchemaAllowedRec.Code != http.StatusOK {
		t.Fatalf("expected skill schema registry to be allowed, got %d", skillSchemaAllowedRec.Code)
	}

	skillSchemaUpdateAllowed := httptest.NewRequest(http.MethodPost, "/api/gateway/skill-schemas/update", nil)
	skillSchemaUpdateAllowed.Header.Set("Authorization", "Bearer developer-test-token")
	skillSchemaUpdateAllowedRec := httptest.NewRecorder()
	handler.ServeHTTP(skillSchemaUpdateAllowedRec, skillSchemaUpdateAllowed)
	if skillSchemaUpdateAllowedRec.Code != http.StatusOK {
		t.Fatalf("expected skill schema update to be allowed, got %d", skillSchemaUpdateAllowedRec.Code)
	}

	skillSchemaPublishAllowed := httptest.NewRequest(http.MethodPost, "/api/gateway/skill-schemas/publish", nil)
	skillSchemaPublishAllowed.Header.Set("Authorization", "Bearer developer-test-token")
	skillSchemaPublishAllowedRec := httptest.NewRecorder()
	handler.ServeHTTP(skillSchemaPublishAllowedRec, skillSchemaPublishAllowed)
	if skillSchemaPublishAllowedRec.Code != http.StatusOK {
		t.Fatalf("expected skill schema publish to be allowed, got %d", skillSchemaPublishAllowedRec.Code)
	}

	proxyAllowed := httptest.NewRequest(http.MethodPost, "/api/gateway/proxy", nil)
	proxyAllowed.Header.Set("Authorization", "Bearer developer-test-token")
	proxyAllowedRec := httptest.NewRecorder()
	handler.ServeHTTP(proxyAllowedRec, proxyAllowed)
	if proxyAllowedRec.Code != http.StatusOK {
		t.Fatalf("expected gateway proxy to be allowed, got %d", proxyAllowedRec.Code)
	}

	usageEventAllowed := httptest.NewRequest(http.MethodPost, "/api/billing/usage-events", nil)
	usageEventAllowed.Header.Set("Authorization", "Bearer developer-test-token")
	usageEventAllowedRec := httptest.NewRecorder()
	handler.ServeHTTP(usageEventAllowedRec, usageEventAllowed)
	if usageEventAllowedRec.Code != http.StatusOK {
		t.Fatalf("expected usage event write to be allowed, got %d", usageEventAllowedRec.Code)
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

func TestUserAndDeveloperCanManageApplications(t *testing.T) {
	handler := Middleware(testConfig(), okHandler())

	applicationWrites := []struct {
		name  string
		token string
		path  string
	}{
		{name: "user create", token: "user-test-token", path: "/api/control/applications"},
		{name: "user activate", token: "user-test-token", path: "/api/control/applications/activate"},
		{name: "user rotate key", token: "user-test-token", path: "/api/control/applications/rotate-key"},
		{name: "developer create", token: "developer-test-token", path: "/api/control/applications"},
		{name: "developer activate", token: "developer-test-token", path: "/api/control/applications/activate"},
		{name: "developer rotate key", token: "developer-test-token", path: "/api/control/applications/rotate-key"},
	}

	for _, item := range applicationWrites {
		req := httptest.NewRequest(http.MethodPost, item.path, nil)
		req.Header.Set("Authorization", "Bearer "+item.token)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("expected %s to be allowed, got %d", item.name, rec.Code)
		}
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

	auditRetentionAllowed := httptest.NewRequest(http.MethodPost, "/api/ops/audit-events/retention/purge", nil)
	auditRetentionAllowed.Header.Set("Authorization", "Bearer operator-test-token")
	auditRetentionAllowedRec := httptest.NewRecorder()
	handler.ServeHTTP(auditRetentionAllowedRec, auditRetentionAllowed)
	if auditRetentionAllowedRec.Code != http.StatusOK {
		t.Fatalf("expected audit retention purge to be allowed, got %d", auditRetentionAllowedRec.Code)
	}

	requestLogRetentionAllowed := httptest.NewRequest(http.MethodPost, "/api/gateway/request-logs/retention/purge", nil)
	requestLogRetentionAllowed.Header.Set("Authorization", "Bearer operator-test-token")
	requestLogRetentionAllowedRec := httptest.NewRecorder()
	handler.ServeHTTP(requestLogRetentionAllowedRec, requestLogRetentionAllowed)
	if requestLogRetentionAllowedRec.Code != http.StatusOK {
		t.Fatalf("expected request log retention purge to be allowed, got %d", requestLogRetentionAllowedRec.Code)
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

	updateDenied := httptest.NewRequest(http.MethodPost, "/api/gateway/routes/update", nil)
	updateDenied.Header.Set("Authorization", "Bearer operator-test-token")
	updateDeniedRec := httptest.NewRecorder()
	handler.ServeHTTP(updateDeniedRec, updateDenied)
	if updateDeniedRec.Code != http.StatusForbidden {
		t.Fatalf("expected gateway route update to be forbidden for operator, got %d", updateDeniedRec.Code)
	}

	healthCheckDenied := httptest.NewRequest(http.MethodPost, "/api/gateway/routes/health-check", nil)
	healthCheckDenied.Header.Set("Authorization", "Bearer operator-test-token")
	healthCheckDeniedRec := httptest.NewRecorder()
	handler.ServeHTTP(healthCheckDeniedRec, healthCheckDenied)
	if healthCheckDeniedRec.Code != http.StatusForbidden {
		t.Fatalf("expected gateway route health check to be forbidden for operator, got %d", healthCheckDeniedRec.Code)
	}

	preflightDenied := httptest.NewRequest(http.MethodPost, "/api/gateway/routes/preflight", nil)
	preflightDenied.Header.Set("Authorization", "Bearer operator-test-token")
	preflightDeniedRec := httptest.NewRecorder()
	handler.ServeHTTP(preflightDeniedRec, preflightDenied)
	if preflightDeniedRec.Code != http.StatusForbidden {
		t.Fatalf("expected gateway route preflight to be forbidden for operator, got %d", preflightDeniedRec.Code)
	}

	modelRouteDenied := httptest.NewRequest(http.MethodPost, "/api/gateway/model-routes", nil)
	modelRouteDenied.Header.Set("Authorization", "Bearer operator-test-token")
	modelRouteDeniedRec := httptest.NewRecorder()
	handler.ServeHTTP(modelRouteDeniedRec, modelRouteDenied)
	if modelRouteDeniedRec.Code != http.StatusForbidden {
		t.Fatalf("expected model route write to be forbidden for operator, got %d", modelRouteDeniedRec.Code)
	}

	modelRouteUpdateDenied := httptest.NewRequest(http.MethodPost, "/api/gateway/model-routes/update", nil)
	modelRouteUpdateDenied.Header.Set("Authorization", "Bearer operator-test-token")
	modelRouteUpdateDeniedRec := httptest.NewRecorder()
	handler.ServeHTTP(modelRouteUpdateDeniedRec, modelRouteUpdateDenied)
	if modelRouteUpdateDeniedRec.Code != http.StatusForbidden {
		t.Fatalf("expected model route update to be forbidden for operator, got %d", modelRouteUpdateDeniedRec.Code)
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

	skillUpdateDenied := httptest.NewRequest(http.MethodPost, "/api/gateway/skills/update", nil)
	skillUpdateDenied.Header.Set("Authorization", "Bearer operator-test-token")
	skillUpdateDeniedRec := httptest.NewRecorder()
	handler.ServeHTTP(skillUpdateDeniedRec, skillUpdateDenied)
	if skillUpdateDeniedRec.Code != http.StatusForbidden {
		t.Fatalf("expected skill binding update to be forbidden for operator, got %d", skillUpdateDeniedRec.Code)
	}

	skillPublishDenied := httptest.NewRequest(http.MethodPost, "/api/gateway/skills/publish", nil)
	skillPublishDenied.Header.Set("Authorization", "Bearer operator-test-token")
	skillPublishDeniedRec := httptest.NewRecorder()
	handler.ServeHTTP(skillPublishDeniedRec, skillPublishDenied)
	if skillPublishDeniedRec.Code != http.StatusForbidden {
		t.Fatalf("expected skill binding publish to be forbidden for operator, got %d", skillPublishDeniedRec.Code)
	}

	skillSchemaDenied := httptest.NewRequest(http.MethodGet, "/api/gateway/skill-schemas", nil)
	skillSchemaDenied.Header.Set("Authorization", "Bearer operator-test-token")
	skillSchemaDeniedRec := httptest.NewRecorder()
	handler.ServeHTTP(skillSchemaDeniedRec, skillSchemaDenied)
	if skillSchemaDeniedRec.Code != http.StatusForbidden {
		t.Fatalf("expected skill schema registry to be forbidden for operator, got %d", skillSchemaDeniedRec.Code)
	}

	skillSchemaUpdateDenied := httptest.NewRequest(http.MethodPost, "/api/gateway/skill-schemas/update", nil)
	skillSchemaUpdateDenied.Header.Set("Authorization", "Bearer operator-test-token")
	skillSchemaUpdateDeniedRec := httptest.NewRecorder()
	handler.ServeHTTP(skillSchemaUpdateDeniedRec, skillSchemaUpdateDenied)
	if skillSchemaUpdateDeniedRec.Code != http.StatusForbidden {
		t.Fatalf("expected skill schema update to be forbidden for operator, got %d", skillSchemaUpdateDeniedRec.Code)
	}

	skillSchemaPublishDenied := httptest.NewRequest(http.MethodPost, "/api/gateway/skill-schemas/publish", nil)
	skillSchemaPublishDenied.Header.Set("Authorization", "Bearer operator-test-token")
	skillSchemaPublishDeniedRec := httptest.NewRecorder()
	handler.ServeHTTP(skillSchemaPublishDeniedRec, skillSchemaPublishDenied)
	if skillSchemaPublishDeniedRec.Code != http.StatusForbidden {
		t.Fatalf("expected skill schema publish to be forbidden for operator, got %d", skillSchemaPublishDeniedRec.Code)
	}

	proxyDenied := httptest.NewRequest(http.MethodPost, "/api/gateway/proxy", nil)
	proxyDenied.Header.Set("Authorization", "Bearer operator-test-token")
	proxyDeniedRec := httptest.NewRecorder()
	handler.ServeHTTP(proxyDeniedRec, proxyDenied)
	if proxyDeniedRec.Code != http.StatusForbidden {
		t.Fatalf("expected gateway proxy to be forbidden for operator, got %d", proxyDeniedRec.Code)
	}

	llmStreamDenied := httptest.NewRequest(http.MethodPost, "/api/gateway/llm/stream", nil)
	llmStreamDenied.Header.Set("Authorization", "Bearer operator-test-token")
	llmStreamDeniedRec := httptest.NewRecorder()
	handler.ServeHTTP(llmStreamDeniedRec, llmStreamDenied)
	if llmStreamDeniedRec.Code != http.StatusForbidden {
		t.Fatalf("expected llm stream to be forbidden for operator, got %d", llmStreamDeniedRec.Code)
	}

	skillInvokeDenied := httptest.NewRequest(http.MethodPost, "/api/gateway/skills/invoke", nil)
	skillInvokeDenied.Header.Set("Authorization", "Bearer operator-test-token")
	skillInvokeDeniedRec := httptest.NewRecorder()
	handler.ServeHTTP(skillInvokeDeniedRec, skillInvokeDenied)
	if skillInvokeDeniedRec.Code != http.StatusForbidden {
		t.Fatalf("expected skill invocation to be forbidden for operator, got %d", skillInvokeDeniedRec.Code)
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

	for _, path := range []string{"/api/gateway/llm/invoke", "/api/gateway/llm/stream", "/api/gateway/skills/invoke", "/api/gateway/proxy"} {
		allowed := httptest.NewRequest(http.MethodPost, path, nil)
		allowed.Header.Set("X-API-Key", "customer-test-key")
		allowedRec := httptest.NewRecorder()
		handler.ServeHTTP(allowedRec, allowed)
		if allowedRec.Code != http.StatusOK {
			t.Fatalf("expected %s to be allowed, got %d", path, allowedRec.Code)
		}
	}

	denied := httptest.NewRequest(http.MethodPost, "/api/ops/todos/resolve", nil)
	denied.Header.Set("X-API-Key", "customer-test-key")
	deniedRec := httptest.NewRecorder()
	handler.ServeHTTP(deniedRec, denied)
	if deniedRec.Code != http.StatusForbidden {
		t.Fatalf("expected ops write to be forbidden, got %d", deniedRec.Code)
	}
}

func TestSessionTokenUsesRoleBoundary(t *testing.T) {
	cfg := testConfig()
	cfg.Session = func(token string) (Principal, bool) {
		if token != "session-test-token" {
			return Principal{}, false
		}
		return Principal{
			Subject: "dev-api@anjing.ai",
			Role:    RoleDeveloper,
			Method:  "session",
		}, true
	}
	handler := Middleware(cfg, okHandler())

	allowed := httptest.NewRequest(http.MethodPost, "/api/gateway/routes", nil)
	allowed.Header.Set("Authorization", "Bearer session-test-token")
	allowedRec := httptest.NewRecorder()
	handler.ServeHTTP(allowedRec, allowed)
	if allowedRec.Code != http.StatusOK {
		t.Fatalf("expected session gateway write to be allowed, got %d", allowedRec.Code)
	}

	denied := httptest.NewRequest(http.MethodPost, "/api/billing/plans", nil)
	denied.Header.Set("Authorization", "Bearer session-test-token")
	deniedRec := httptest.NewRecorder()
	handler.ServeHTTP(deniedRec, denied)
	if deniedRec.Code != http.StatusForbidden {
		t.Fatalf("expected session billing write to be forbidden, got %d", deniedRec.Code)
	}
}

func TestLoginPathIsPublicInEnforcedMode(t *testing.T) {
	handler := Middleware(testConfig(), okHandler())

	req := httptest.NewRequest(http.MethodPost, "/api/control/auth/login", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected public login path, got %d", rec.Code)
	}
}

func TestOAuthPathsArePublicInEnforcedMode(t *testing.T) {
	handler := Middleware(testConfig(), okHandler())

	paths := []struct {
		method string
		path   string
	}{
		{method: http.MethodGet, path: "/api/control/auth/oauth/providers"},
		{method: http.MethodPost, path: "/api/control/auth/oauth/start"},
		{method: http.MethodGet, path: "/api/control/auth/oauth/callback"},
	}

	for _, item := range paths {
		req := httptest.NewRequest(item.method, item.path, nil)
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected public oauth path %s %s, got %d", item.method, item.path, rec.Code)
		}
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
