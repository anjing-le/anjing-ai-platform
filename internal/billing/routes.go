package billing

import (
	"net/http"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/httpjson"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
)

func Register(mux *http.ServeMux, st *store.Store) {
	mux.HandleFunc("/api/billing/healthz", func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodGet) {
			return
		}
		httpjson.OK(w, map[string]string{"service": "billing-service", "status": "ok"})
	})
	mux.HandleFunc("/api/billing/plans", plansHandler(st))
	mux.HandleFunc("/api/billing/usage", listHandler(st.ListUsage))
	mux.HandleFunc("/api/billing/budget-alerts", listHandler(st.ListBudgetAlerts))
}

func plansHandler(st *store.Store) http.HandlerFunc {
	type createPlanRequest struct {
		Name        string `json:"name"`
		RPS         string `json:"rps"`
		TokenPerDay string `json:"tokenPerDay"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			httpjson.OK(w, st.ListPlans())
		case http.MethodPost:
			var req createPlanRequest
			if err := httpjson.Decode(r, &req); err != nil {
				httpjson.BadRequest(w, err.Error())
				return
			}
			if req.Name == "" {
				httpjson.BadRequest(w, "name is required")
				return
			}
			if req.RPS == "" {
				req.RPS = "100"
			}
			if req.TokenPerDay == "" {
				req.TokenPerDay = "1M"
			}
			httpjson.Created(w, st.CreatePlan(req.Name, req.RPS, req.TokenPerDay))
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
