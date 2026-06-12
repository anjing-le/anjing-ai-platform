package control

import (
	"net/http"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/httpjson"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
)

func Register(mux *http.ServeMux, st *store.Store) {
	RegisterWithRepositories(mux, st, NewMemoryRepositories(st))
}

func RegisterWithUsers(mux *http.ServeMux, st *store.Store, users UserRepository) {
	repos := NewMemoryRepositories(st)
	repos.Users = users
	RegisterWithRepositories(mux, st, repos)
}

func RegisterWithRepositories(mux *http.ServeMux, st *store.Store, repos Repositories) {
	mux.HandleFunc("/api/control/healthz", func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodGet) {
			return
		}
		httpjson.OK(w, map[string]string{"service": "control-api", "status": "ok"})
	})
	mux.HandleFunc("/api/control/users", usersHandler(repos.Users))
	mux.HandleFunc("/api/control/applications", applicationsHandler(repos.Applications))
	mux.HandleFunc("/api/control/applications/activate", activateApplicationHandler(repos.Applications))
	mux.HandleFunc("/api/control/roles", rolesHandler(repos.Roles))
	mux.HandleFunc("/api/control/api-keys", apiKeysHandler(repos.APIKeys))
	mux.HandleFunc("/api/control/credentials", credentialsHandler(repos.Credentials))
}

func usersHandler(users UserRepository) http.HandlerFunc {
	type createUserRequest struct {
		Email string `json:"email"`
		Org   string `json:"org"`
		Role  string `json:"role"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			items, err := users.ListUsers(r.Context())
			if err != nil {
				httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
				return
			}
			httpjson.OK(w, items)
		case http.MethodPost:
			var req createUserRequest
			if err := httpjson.Decode(r, &req); err != nil {
				httpjson.BadRequest(w, err.Error())
				return
			}
			if req.Email == "" {
				httpjson.BadRequest(w, "email is required")
				return
			}
			if req.Org == "" {
				req.Org = "Platform"
			}
			if req.Role == "" {
				req.Role = "User"
			}
			user, err := users.CreateUser(r.Context(), CreateUserInput{
				Email: req.Email,
				Org:   req.Org,
				Role:  req.Role,
			})
			if err != nil {
				httpjson.BadRequest(w, err.Error())
				return
			}
			httpjson.Created(w, user)
		default:
			httpjson.MethodNotAllowed(w)
		}
	}
}

func applicationsHandler(applications ApplicationRepository) http.HandlerFunc {
	type createApplicationRequest struct {
		Name         string `json:"name"`
		Owner        string `json:"owner"`
		Environment  string `json:"environment"`
		DefaultRoute string `json:"defaultRoute"`
		Plan         string `json:"plan"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			items, err := applications.ListApplications(r.Context())
			if err != nil {
				httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
				return
			}
			httpjson.OK(w, items)
		case http.MethodPost:
			var req createApplicationRequest
			if err := httpjson.Decode(r, &req); err != nil {
				httpjson.BadRequest(w, err.Error())
				return
			}
			if req.Name == "" {
				httpjson.BadRequest(w, "name is required")
				return
			}
			if req.Owner == "" {
				req.Owner = "self-service"
			}
			item, err := applications.CreateApplication(r.Context(), CreateApplicationInput{
				Name:         req.Name,
				Owner:        req.Owner,
				Environment:  req.Environment,
				DefaultRoute: req.DefaultRoute,
				Plan:         req.Plan,
			})
			if err != nil {
				httpjson.BadRequest(w, err.Error())
				return
			}
			httpjson.Created(w, item)
		default:
			httpjson.MethodNotAllowed(w)
		}
	}
}

func activateApplicationHandler(applications ApplicationRepository) http.HandlerFunc {
	type activateApplicationRequest struct {
		ID string `json:"id"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodPost) {
			return
		}

		var req activateApplicationRequest
		if err := httpjson.Decode(r, &req); err != nil {
			httpjson.BadRequest(w, err.Error())
			return
		}
		if req.ID == "" {
			httpjson.BadRequest(w, "id is required")
			return
		}

		item, ok, err := applications.ActivateApplication(r.Context(), req.ID)
		if err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		if !ok {
			httpjson.NotFound(w, "application not found")
			return
		}
		httpjson.OK(w, item)
	}
}

func rolesHandler(roles RoleRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodGet) {
			return
		}
		items, err := roles.ListRoles(r.Context())
		if err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		httpjson.OK(w, items)
	}
}

func apiKeysHandler(apiKeys APIKeyRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodGet) {
			return
		}
		items, err := apiKeys.ListAPIKeys(r.Context())
		if err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		httpjson.OK(w, items)
	}
}

func credentialsHandler(credentials CredentialRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodGet) {
			return
		}
		items, err := credentials.ListCredentials(r.Context())
		if err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		httpjson.OK(w, items)
	}
}

func listHandler[T any](list func() []T) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodGet) {
			return
		}
		httpjson.OK(w, list())
	}
}
