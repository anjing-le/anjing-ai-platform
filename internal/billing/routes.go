package billing

import (
	"net/http"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/httpjson"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
)

func Register(mux *http.ServeMux, st *store.Store) {
	RegisterWithRepositories(mux, st, NewMemoryRepositories(st))
}

func RegisterWithPlans(mux *http.ServeMux, st *store.Store, plans PlanRepository) {
	repos := NewMemoryRepositories(st)
	repos.Plans = plans
	RegisterWithRepositories(mux, st, repos)
}

func RegisterWithRepositories(mux *http.ServeMux, st *store.Store, repos Repositories) {
	mux.HandleFunc("/api/billing/healthz", func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodGet) {
			return
		}
		httpjson.OK(w, map[string]string{"service": "billing-service", "status": "ok"})
	})
	mux.HandleFunc("/api/billing/plans", plansHandler(repos.Plans))
	mux.HandleFunc("/api/billing/usage", usageHandler(repos.Usage))
	mux.HandleFunc("/api/billing/budget-alerts", budgetAlertsHandler(repos.BudgetAlerts))
}

func plansHandler(plans PlanRepository) http.HandlerFunc {
	type createPlanRequest struct {
		Name        string `json:"name"`
		RPS         string `json:"rps"`
		TokenPerDay string `json:"tokenPerDay"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			items, err := plans.ListPlans(r.Context())
			if err != nil {
				httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
				return
			}
			httpjson.OK(w, items)
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
			plan, err := plans.CreatePlan(r.Context(), CreatePlanInput{
				Name:        req.Name,
				RPS:         req.RPS,
				TokenPerDay: req.TokenPerDay,
			})
			if err != nil {
				httpjson.BadRequest(w, err.Error())
				return
			}
			httpjson.Created(w, plan)
		default:
			httpjson.MethodNotAllowed(w)
		}
	}
}

func usageHandler(usage UsageRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodGet) {
			return
		}
		items, err := usage.ListUsage(r.Context())
		if err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		httpjson.OK(w, items)
	}
}

func budgetAlertsHandler(alerts BudgetAlertRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodGet) {
			return
		}
		items, err := alerts.ListBudgetAlerts(r.Context())
		if err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		httpjson.OK(w, items)
	}
}
