package ops

import (
	"fmt"
	"net/http"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/httpjson"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
)

func Register(mux *http.ServeMux, st *store.Store) {
	RegisterWithRepositories(mux, st, NewMemoryRepositories(st))
}

func RegisterWithTodos(mux *http.ServeMux, st *store.Store, todos TodoRepository) {
	repos := NewMemoryRepositories(st)
	repos.Todos = todos
	RegisterWithRepositories(mux, st, repos)
}

func RegisterWithRepositories(mux *http.ServeMux, st *store.Store, repos Repositories) {
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
		dashboard, err := dashboardWithRepositories(r, st, repos)
		if err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		httpjson.OK(w, dashboard)
	})
	mux.HandleFunc("/api/ops/platform-snapshot", func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodGet) {
			return
		}
		snapshot, err := repos.Snapshot.LoadSnapshot(r.Context())
		if err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		httpjson.OK(w, snapshot)
	})
	mux.HandleFunc("/api/ops/todos", todosHandler(repos.Todos))
	mux.HandleFunc("/api/ops/todos/resolve", resolveTodoHandler(repos.Todos))
	mux.HandleFunc("/api/ops/service-health", healthHandler(repos.Health))
	mux.HandleFunc("/api/ops/audit-events", auditHandler(repos.Audit))
}

func dashboardWithRepositories(r *http.Request, st *store.Store, repos Repositories) (store.OpsDashboard, error) {
	dashboard := st.Dashboard()
	todos, err := repos.Todos.ListTodos(r.Context())
	if err != nil {
		return store.OpsDashboard{}, err
	}
	health, err := repos.Health.ListHealth(r.Context())
	if err != nil {
		return store.OpsDashboard{}, err
	}
	audit, err := repos.Audit.ListAudit(r.Context())
	if err != nil {
		return store.OpsDashboard{}, err
	}

	pending := 0
	for _, item := range todos {
		if item.Status != "Resolved" {
			pending++
		}
	}

	dashboard.Todos = todos
	dashboard.Health = health
	dashboard.Audit = audit
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

func healthHandler(health HealthRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodGet) {
			return
		}
		items, err := health.ListHealth(r.Context())
		if err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		httpjson.OK(w, items)
	}
}

func auditHandler(audit AuditRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodGet) {
			return
		}
		items, err := audit.ListAudit(r.Context())
		if err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		httpjson.OK(w, items)
	}
}
