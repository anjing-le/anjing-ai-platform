package ops

import (
	"fmt"
	"net/http"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/httpjson"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
)

func Register(mux *http.ServeMux, st *store.Store) {
	RegisterWithTodos(mux, st, NewMemoryTodoRepository(st))
}

func RegisterWithTodos(mux *http.ServeMux, st *store.Store, todos TodoRepository) {
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
		dashboard, err := dashboardWithTodos(r, st, todos)
		if err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		httpjson.OK(w, dashboard)
	})
	mux.HandleFunc("/api/ops/todos", todosHandler(todos))
	mux.HandleFunc("/api/ops/todos/resolve", resolveTodoHandler(todos))
	mux.HandleFunc("/api/ops/service-health", listHandler(st.ListHealth))
	mux.HandleFunc("/api/ops/audit-events", listHandler(st.ListAudit))
}

func dashboardWithTodos(r *http.Request, st *store.Store, todos TodoRepository) (store.OpsDashboard, error) {
	dashboard := st.Dashboard()
	items, err := todos.ListTodos(r.Context())
	if err != nil {
		return store.OpsDashboard{}, err
	}

	pending := 0
	for _, item := range items {
		if item.Status != "Resolved" {
			pending++
		}
	}

	dashboard.Todos = items
	if len(dashboard.Metrics) >= 3 {
		dashboard.Metrics[2] = store.Metric{Label: "待处理", Value: fmt.Sprintf("%d", pending), Note: "告警 / 审批 / 预算"}
	}

	return dashboard, nil
}

func todosHandler(todos TodoRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodGet) {
			return
		}
		items, err := todos.ListTodos(r.Context())
		if err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		httpjson.OK(w, items)
	}
}

func resolveTodoHandler(todos TodoRepository) http.HandlerFunc {
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
		todo, ok, err := todos.ResolveTodo(r.Context(), req.ID)
		if err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
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
