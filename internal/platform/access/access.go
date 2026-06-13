package access

import (
	"context"
	"net/http"
	"os"
	"strings"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/httpjson"
)

type Role string

const (
	RoleAdministrator Role = "Administrator"
	RoleUser          Role = "User"
	RoleDeveloper     Role = "Developer"
	RoleOperator      Role = "Operator"
)

type Principal struct {
	Subject string `json:"subject"`
	Role    Role   `json:"role"`
	Method  string `json:"method"`
}

type contextKey string

const principalKey contextKey = "access.principal"

type Mode string

const (
	ModePermissive Mode = "permissive"
	ModeEnforced   Mode = "enforced"
)

type Config struct {
	Mode        Mode
	BearerToken map[string]Principal
	APIKey      map[string]Principal
}

func LoadConfig() Config {
	mode := Mode(strings.ToLower(env("ANJING_AUTH_MODE", string(ModePermissive))))
	if mode != ModeEnforced {
		mode = ModePermissive
	}

	return Config{
		Mode: mode,
		BearerToken: map[string]Principal{
			env("ANJING_ADMIN_TOKEN", "dev-admin-token"): {
				Subject: "admin-console",
				Role:    RoleAdministrator,
				Method:  "bearer",
			},
			env("ANJING_USER_TOKEN", "dev-user-token"): {
				Subject: "self-service-console",
				Role:    RoleUser,
				Method:  "bearer",
			},
			env("ANJING_DEVELOPER_TOKEN", "dev-developer-token"): {
				Subject: "developer-console",
				Role:    RoleDeveloper,
				Method:  "bearer",
			},
			env("ANJING_OPERATOR_TOKEN", "dev-operator-token"): {
				Subject: "operator-console",
				Role:    RoleOperator,
				Method:  "bearer",
			},
		},
		APIKey: map[string]Principal{
			env("ANJING_CUSTOMER_API_KEY", "ak_live_customer"): {
				Subject: "customer-service-agent",
				Role:    RoleUser,
				Method:  "api_key",
			},
			env("ANJING_KNOWLEDGE_API_KEY", "ak_live_knowledge"): {
				Subject: "knowledge-rag",
				Role:    RoleUser,
				Method:  "api_key",
			},
		},
	}
}

func Middleware(cfg Config, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/api/") || isHealthPath(r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}

		principal, ok := authenticate(cfg, r)
		if !ok {
			if cfg.Mode == ModePermissive {
				principal = Principal{
					Subject: "dev-permissive",
					Role:    RoleAdministrator,
					Method:  "permissive",
				}
			} else {
				httpjson.Fail(w, http.StatusUnauthorized, "unauthorized", "missing or invalid credential")
				return
			}
		}

		if !Allowed(principal.Role, r.Method, r.URL.Path) {
			httpjson.Fail(w, http.StatusForbidden, "forbidden", "role is not allowed to access this resource")
			return
		}

		ctx := context.WithValue(r.Context(), principalKey, principal)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func PrincipalFromContext(ctx context.Context) (Principal, bool) {
	principal, ok := ctx.Value(principalKey).(Principal)
	return principal, ok
}

func Allowed(role Role, method, path string) bool {
	if method == http.MethodOptions || isHealthPath(path) {
		return true
	}
	if role == RoleAdministrator {
		return true
	}

	switch role {
	case RoleUser:
		return allowUser(method, path)
	case RoleDeveloper:
		return allowDeveloper(method, path)
	case RoleOperator:
		return allowOperator(method, path)
	default:
		return false
	}
}

func authenticate(cfg Config, r *http.Request) (Principal, bool) {
	if token := bearerToken(r.Header.Get("Authorization")); token != "" {
		if principal, ok := cfg.BearerToken[token]; ok {
			return principal, true
		}
	}

	if key := r.Header.Get("X-API-Key"); key != "" {
		if principal, ok := cfg.APIKey[key]; ok {
			return principal, true
		}
	}

	return Principal{}, false
}

func allowUser(method, path string) bool {
	if method == http.MethodGet {
		return path == "/api/ops/dashboard" ||
			path == "/api/control/applications" ||
			strings.HasPrefix(path, "/api/billing/")
	}

	if method == http.MethodPost {
		return path == "/api/control/applications" ||
			path == "/api/control/applications/activate" ||
			path == "/api/control/applications/rotate-key" ||
			path == "/api/gateway/llm/invoke"
	}

	return false
}

func allowDeveloper(method, path string) bool {
	if method == http.MethodGet {
		return strings.HasPrefix(path, "/api/ops/") ||
			strings.HasPrefix(path, "/api/gateway/") ||
			path == "/api/control/applications" ||
			path == "/api/control/roles" ||
			path == "/api/control/api-keys" ||
			path == "/api/control/credentials" ||
			strings.HasPrefix(path, "/api/billing/")
	}

	if method == http.MethodPost {
		return path == "/api/control/applications" ||
			path == "/api/control/applications/activate" ||
			path == "/api/control/applications/rotate-key" ||
			path == "/api/gateway/routes" ||
			path == "/api/gateway/routes/publish" ||
			path == "/api/gateway/model-routes" ||
			path == "/api/gateway/model-routes/publish" ||
			path == "/api/gateway/skills" ||
			path == "/api/gateway/llm/invoke"
	}

	return false
}

func allowOperator(method, path string) bool {
	if method == http.MethodGet {
		return strings.HasPrefix(path, "/api/ops/") ||
			path == "/api/gateway/request-logs" ||
			strings.HasPrefix(path, "/api/billing/")
	}

	if method == http.MethodPost {
		return path == "/api/ops/todos/resolve" ||
			path == "/api/billing/budget-alerts/resolve"
	}

	return false
}

func bearerToken(header string) string {
	const prefix = "Bearer "
	if !strings.HasPrefix(header, prefix) {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(header, prefix))
}

func isHealthPath(path string) bool {
	return path == "/healthz" || strings.HasSuffix(path, "/healthz")
}

func env(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}
