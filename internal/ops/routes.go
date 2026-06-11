package ops

import (
	"net/http"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/httpjson"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
)

func Register(mux *http.ServeMux, st *store.Store) {
	mux.HandleFunc("/api/ops/healthz", func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodGet) {
			return
		}
		httpjson.OK(w, map[string]string{"service": "ops-api", "status": "ok"})
	})
	mux.HandleFunc("/api/ops/dashboard", func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodGet) {
			return
		}
		httpjson.OK(w, st.Dashboard())
	})
	mux.HandleFunc("/api/ops/todos", listHandler(st.ListTodos))
	mux.HandleFunc("/api/ops/todos/resolve", resolveTodoHandler(st))
	mux.HandleFunc("/api/ops/service-health", listHandler(st.ListHealth))
	mux.HandleFunc("/api/ops/audit-events", listHandler(st.ListAudit))
}

func resolveTodoHandler(st *store.Store) http.HandlerFunc {
	type resolveTodoRequest struct {
		ID string `json:"id"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodPost) {
			return
		}
		var req resolveTodoRequest
		if err := httpjson.Decode(r, &req); err != nil {
			httpjson.BadRequest(w, err.Error())
			return
		}
		if req.ID == "" {
			httpjson.BadRequest(w, "id is required")
			return
		}
		todo, ok := st.ResolveTodo(req.ID)
		if !ok {
			httpjson.NotFound(w, "todo not found")
			return
		}
		httpjson.OK(w, todo)
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
