package control

import (
	"context"
	"net/http"
	"strings"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/access"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/httpjson"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/session"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
)

func authLoginHandler(users UserRepository, sessions *session.Manager) http.HandlerFunc {
	type loginRequest struct {
		Email string `json:"email"`
		Role  string `json:"role,omitempty"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodPost) {
			return
		}

		var req loginRequest
		if err := httpjson.Decode(r, &req); err != nil {
			httpjson.BadRequest(w, err.Error())
			return
		}

		principal, err := loginPrincipal(r.Context(), users, req.Email, req.Role)
		if err != nil {
			httpjson.Fail(w, http.StatusUnauthorized, "unauthorized", err.Error())
			return
		}

		created, err := sessions.Create(principal.Subject, principal.Role)
		if err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}

		httpjson.OK(w, created)
	}
}

func authSessionHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodGet) {
			return
		}

		principal, ok := access.PrincipalFromContext(r.Context())
		if !ok {
			httpjson.Fail(w, http.StatusUnauthorized, "unauthorized", "missing session")
			return
		}

		httpjson.OK(w, map[string]any{
			"authenticated": true,
			"principal":     principal,
		})
	}
}

func authLogoutHandler(sessions *session.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodPost) {
			return
		}

		token := access.BearerToken(r.Header.Get("Authorization"))
		if token == "" {
			httpjson.Fail(w, http.StatusUnauthorized, "unauthorized", "missing session")
			return
		}

		httpjson.OK(w, map[string]bool{"revoked": sessions.Revoke(token)})
	}
}

func loginPrincipal(ctx context.Context, users UserRepository, email string, role string) (access.Principal, error) {
	email = strings.TrimSpace(email)
	if email == "" {
		return access.Principal{}, errLogin("email is required")
	}

	items, err := users.ListUsers(ctx)
	if err != nil {
		return access.Principal{}, err
	}

	for _, user := range items {
		if strings.EqualFold(user.Email, email) {
			return principalFromUser(user)
		}
	}

	parsedRole, ok := parseAccessRole(role)
	if !ok {
		return access.Principal{}, errLogin("login identity is not active")
	}

	return access.Principal{
		Subject: email,
		Role:    parsedRole,
		Method:  "passwordless",
	}, nil
}

func principalFromUser(user store.User) (access.Principal, error) {
	if user.Status != "Active" {
		return access.Principal{}, errLogin("login identity is not active")
	}

	role, ok := parseAccessRole(user.Role)
	if !ok {
		return access.Principal{}, errLogin("login role is invalid")
	}

	return access.Principal{
		Subject: user.Email,
		Role:    role,
		Method:  "passwordless",
	}, nil
}

func parseAccessRole(role string) (access.Role, bool) {
	switch access.Role(strings.TrimSpace(role)) {
	case access.RoleAdministrator:
		return access.RoleAdministrator, true
	case access.RoleUser:
		return access.RoleUser, true
	case access.RoleDeveloper:
		return access.RoleDeveloper, true
	case access.RoleOperator:
		return access.RoleOperator, true
	default:
		return "", false
	}
}

type errLogin string

func (err errLogin) Error() string {
	return string(err)
}
