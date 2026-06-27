package session

import (
	"strings"
	"testing"
	"time"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/access"
)

func TestManagerCreatesValidSession(t *testing.T) {
	now := time.Date(2026, 6, 27, 12, 0, 0, 0, time.UTC)
	manager := NewManager("test-secret", time.Hour)
	manager.now = func() time.Time { return now }

	created, err := manager.Create("dev-api@anjing.ai", access.RoleDeveloper)
	if err != nil {
		t.Fatalf("create session: %v", err)
	}
	if !strings.HasPrefix(created.Token, tokenPrefix) {
		t.Fatalf("expected session token prefix, got %q", created.Token)
	}
	if created.Principal.Subject != "dev-api@anjing.ai" || created.Principal.Role != access.RoleDeveloper {
		t.Fatalf("unexpected principal: %+v", created.Principal)
	}

	principal, ok := manager.Principal(created.Token)
	if !ok {
		t.Fatal("expected token to validate")
	}
	if principal.Method != "session" || principal.Role != access.RoleDeveloper {
		t.Fatalf("unexpected principal from token: %+v", principal)
	}
}

func TestManagerPreservesSessionMethod(t *testing.T) {
	manager := NewManager("test-secret", time.Hour)

	created, err := manager.CreateWithMethod("oauth-user@anjing.ai", access.RoleUser, "oauth")
	if err != nil {
		t.Fatalf("create oauth session: %v", err)
	}
	if created.Principal.Method != "oauth" {
		t.Fatalf("expected created principal method oauth, got %+v", created.Principal)
	}

	principal, ok := manager.Principal(created.Token)
	if !ok {
		t.Fatal("expected oauth token to validate")
	}
	if principal.Method != "oauth" || principal.Subject != "oauth-user@anjing.ai" {
		t.Fatalf("unexpected oauth principal from token: %+v", principal)
	}
}

func TestManagerRejectsTamperedExpiredAndRevokedTokens(t *testing.T) {
	now := time.Date(2026, 6, 27, 12, 0, 0, 0, time.UTC)
	manager := NewManager("test-secret", time.Hour)
	manager.now = func() time.Time { return now }

	created, err := manager.Create("lin.chen@anjing.ai", access.RoleAdministrator)
	if err != nil {
		t.Fatalf("create session: %v", err)
	}

	if _, ok := manager.Principal(created.Token + "x"); ok {
		t.Fatal("expected tampered token to be rejected")
	}

	manager.now = func() time.Time { return now.Add(2 * time.Hour) }
	if _, ok := manager.Principal(created.Token); ok {
		t.Fatal("expected expired token to be rejected")
	}

	manager.now = func() time.Time { return now }
	if !manager.Revoke(created.Token) {
		t.Fatal("expected token to be revoked")
	}
	if _, ok := manager.Principal(created.Token); ok {
		t.Fatal("expected revoked token to be rejected")
	}
}
