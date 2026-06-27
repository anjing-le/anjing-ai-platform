package gateway

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/httpjson"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
)

func Register(mux *http.ServeMux, st *store.Store) {
	RegisterWithRepositories(mux, st, NewMemoryRepositories(st))
}

func RegisterWithRoutes(mux *http.ServeMux, st *store.Store, routes RouteRepository) {
	repos := NewMemoryRepositories(st)
	repos.Routes = routes
	RegisterWithRepositories(mux, st, repos)
}

func RegisterWithRepositories(mux *http.ServeMux, st *store.Store, repos Repositories) {
	mux.HandleFunc("/api/gateway/healthz", func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodGet) {
			return
		}
		httpjson.OK(w, map[string]string{"service": "gateway-api", "status": "ok"})
	})
	mux.HandleFunc("/api/gateway/routes", routesHandler(repos.Routes))
	mux.HandleFunc("/api/gateway/routes/publish", publishRouteHandler(repos.Routes))
	mux.HandleFunc("/api/gateway/model-routes", modelRoutesHandler(repos.ModelRoutes))
	mux.HandleFunc("/api/gateway/model-routes/publish", publishModelRouteHandler(repos.ModelRoutes))
	mux.HandleFunc("/api/gateway/skills", skillsHandler(repos.Skills))
	mux.HandleFunc("/api/gateway/skills/publish", publishSkillBindingHandler(repos.Skills))
	mux.HandleFunc("/api/gateway/request-logs", requestLogsHandler(repos.RequestLogs))
	mux.HandleFunc("/api/gateway/proxy", proxyHandler(repos.Routes, repos.ProxyRequests))
	mux.HandleFunc("/api/gateway/llm/invoke", llmInvokeHandler(repos.ModelRoutes, repos.Invocations))
}

func routesHandler(routes RouteRepository) http.HandlerFunc {
	type createRouteRequest struct {
		Route    string `json:"route"`
		Upstream string `json:"upstream"`
		Limit    string `json:"limit"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			items, err := routes.ListRoutes(r.Context())
			if err != nil {
				httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
				return
			}
			httpjson.OK(w, items)
		case http.MethodPost:
			var req createRouteRequest
			if err := httpjson.Decode(r, &req); err != nil {
				httpjson.BadRequest(w, err.Error())
				return
			}
			if req.Route == "" {
				httpjson.BadRequest(w, "route is required")
				return
			}
			if req.Upstream == "" {
				req.Upstream = "gateway-api"
			}
			if req.Limit == "" {
				req.Limit = "600/min"
			}
			route, err := routes.CreateRoute(r.Context(), CreateRouteInput{
				Route:    req.Route,
				Upstream: req.Upstream,
				Limit:    req.Limit,
			})
			if err != nil {
				httpjson.BadRequest(w, err.Error())
				return
			}
			httpjson.Created(w, route)
		default:
			httpjson.MethodNotAllowed(w)
		}
	}
}

func publishRouteHandler(routes RouteRepository) http.HandlerFunc {
	type publishRouteRequest struct {
		ID string `json:"id"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodPost) {
			return
		}

		var req publishRouteRequest
		if err := httpjson.Decode(r, &req); err != nil {
			httpjson.BadRequest(w, err.Error())
			return
		}
		if req.ID == "" {
			httpjson.BadRequest(w, "id is required")
			return
		}

		route, ok, err := routes.PublishRoute(r.Context(), req.ID)
		if err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		if !ok {
			httpjson.NotFound(w, "route not found")
			return
		}

		httpjson.OK(w, route)
	}
}

func modelRoutesHandler(modelRoutes ModelRouteRepository) http.HandlerFunc {
	type createModelRouteRequest struct {
		Alias    string `json:"alias"`
		Scenario string `json:"scenario"`
		Primary  string `json:"primary"`
		Fallback string `json:"fallback"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			items, err := modelRoutes.ListModelRoutes(r.Context())
			if err != nil {
				httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
				return
			}
			httpjson.OK(w, items)
		case http.MethodPost:
			var req createModelRouteRequest
			if err := httpjson.Decode(r, &req); err != nil {
				httpjson.BadRequest(w, err.Error())
				return
			}
			if req.Alias == "" {
				httpjson.BadRequest(w, "alias is required")
				return
			}
			if req.Primary == "" {
				httpjson.BadRequest(w, "primary is required")
				return
			}
			if req.Scenario == "" {
				req.Scenario = "General"
			}
			if req.Fallback == "" {
				req.Fallback = "local-fallback"
			}
			route, err := modelRoutes.CreateModelRoute(r.Context(), CreateModelRouteInput{
				Alias:    req.Alias,
				Scenario: req.Scenario,
				Primary:  req.Primary,
				Fallback: req.Fallback,
			})
			if err != nil {
				httpjson.BadRequest(w, err.Error())
				return
			}
			httpjson.Created(w, route)
		default:
			httpjson.MethodNotAllowed(w)
		}
	}
}

func publishModelRouteHandler(modelRoutes ModelRouteRepository) http.HandlerFunc {
	type publishModelRouteRequest struct {
		ID string `json:"id"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodPost) {
			return
		}

		var req publishModelRouteRequest
		if err := httpjson.Decode(r, &req); err != nil {
			httpjson.BadRequest(w, err.Error())
			return
		}
		if req.ID == "" {
			httpjson.BadRequest(w, "id is required")
			return
		}

		route, ok, err := modelRoutes.PublishModelRoute(r.Context(), req.ID)
		if err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		if !ok {
			httpjson.NotFound(w, "model route not found")
			return
		}

		httpjson.OK(w, route)
	}
}

func skillsHandler(skills SkillRepository) http.HandlerFunc {
	type createSkillBindingRequest struct {
		Name     string `json:"name"`
		Protocol string `json:"protocol"`
		Route    string `json:"route"`
		Timeout  string `json:"timeout"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			items, err := skills.ListSkills(r.Context())
			if err != nil {
				httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
				return
			}
			httpjson.OK(w, items)
		case http.MethodPost:
			var req createSkillBindingRequest
			if err := httpjson.Decode(r, &req); err != nil {
				httpjson.BadRequest(w, err.Error())
				return
			}
			if req.Name == "" {
				httpjson.BadRequest(w, "name is required")
				return
			}
			if req.Route == "" {
				httpjson.BadRequest(w, "route is required")
				return
			}
			if req.Protocol == "" {
				req.Protocol = "HTTP"
			}
			if req.Timeout == "" {
				req.Timeout = "8s"
			}
			skill, err := skills.CreateSkillBinding(r.Context(), CreateSkillBindingInput{
				Name:     req.Name,
				Protocol: req.Protocol,
				Route:    req.Route,
				Timeout:  req.Timeout,
			})
			if err != nil {
				httpjson.BadRequest(w, err.Error())
				return
			}
			httpjson.Created(w, skill)
		default:
			httpjson.MethodNotAllowed(w)
		}
	}
}

func publishSkillBindingHandler(skills SkillRepository) http.HandlerFunc {
	type publishSkillBindingRequest struct {
		ID string `json:"id"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodPost) {
			return
		}

		var req publishSkillBindingRequest
		if err := httpjson.Decode(r, &req); err != nil {
			httpjson.BadRequest(w, err.Error())
			return
		}
		if req.ID == "" {
			httpjson.BadRequest(w, "id is required")
			return
		}

		skill, ok, err := skills.PublishSkillBinding(r.Context(), req.ID)
		if err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		if !ok {
			httpjson.NotFound(w, "skill binding not found")
			return
		}

		httpjson.OK(w, skill)
	}
}

func requestLogsHandler(requestLogs RequestLogRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodGet) {
			return
		}
		items, err := requestLogs.QueryRequestLogs(r.Context(), requestLogQueryFromRequest(r))
		if err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		httpjson.OK(w, items)
	}
}

func requestLogQueryFromRequest(r *http.Request) RequestLogQuery {
	values := r.URL.Query()
	return RequestLogQuery{
		Q:        strings.TrimSpace(values.Get("q")),
		Consumer: strings.TrimSpace(values.Get("consumer")),
		Status:   strings.TrimSpace(values.Get("status")),
		Limit:    parseListLimit(values.Get("limit")),
	}
}

func parseListLimit(value string) int {
	limit, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil || limit <= 0 {
		return 0
	}
	if limit > 500 {
		return 500
	}
	return limit
}
