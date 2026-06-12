package control

import (
	"net/http"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/httpjson"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
)

func Register(mux *http.ServeMux, st *store.Store) {
	RegisterWithUsers(mux, st, NewMemoryUserRepository(st))
}

func RegisterWithUsers(mux *http.ServeMux, st *store.Store, users UserRepository) {
	mux.HandleFunc("/api/control/healthz", func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodGet) {
			return
		}
		httpjson.OK(w, map[string]string{"service": "control-api", "status": "ok"})
	})
	mux.HandleFunc("/api/control/users", usersHandler(users))
	mux.HandleFunc("/api/control/roles", listHandler(st.ListRoles))
	mux.HandleFunc("/api/control/api-keys", listHandler(st.ListAPIKeys))
	mux.HandleFunc("/api/control/credentials", listHandler(st.ListCredentials))
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

func listHandler[T any](list func() []T) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodGet) {
			return
		}
		httpjson.OK(w, list())
	}
}
