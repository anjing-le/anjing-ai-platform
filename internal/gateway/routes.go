package gateway

import (
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

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
	mux.HandleFunc("/api/gateway/skills", skillsHandler(repos.Skills))
	mux.HandleFunc("/api/gateway/request-logs", requestLogsHandler(repos.RequestLogs))
	mux.HandleFunc("/api/gateway/llm/invoke", llmInvokeHandler(repos.ModelRoutes))
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

func skillsHandler(skills SkillRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodGet) {
			return
		}
		items, err := skills.ListSkills(r.Context())
		if err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		httpjson.OK(w, items)
	}
}

func requestLogsHandler(requestLogs RequestLogRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodGet) {
			return
		}
		items, err := requestLogs.ListRequestLogs(r.Context())
		if err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		httpjson.OK(w, items)
	}
}

func llmInvokeHandler(modelRoutes ModelRouteRepository) http.HandlerFunc {
	type invokeRequest struct {
		ModelAlias  string  `json:"modelAlias"`
		Input       string  `json:"input"`
		Temperature float64 `json:"temperature,omitempty"`
	}

	type usage struct {
		InputTokens  int `json:"inputTokens"`
		OutputTokens int `json:"outputTokens"`
		TotalTokens  int `json:"totalTokens"`
	}

	type invokeResponse struct {
		ID           string `json:"id"`
		ModelAlias   string `json:"modelAlias"`
		Provider     string `json:"provider"`
		Model        string `json:"model"`
		Fallback     string `json:"fallback"`
		Content      string `json:"content"`
		FinishReason string `json:"finishReason"`
		Usage        usage  `json:"usage"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodPost) {
			return
		}

		var req invokeRequest
		if err := httpjson.Decode(r, &req); err != nil {
			httpjson.BadRequest(w, err.Error())
			return
		}
		if req.Input == "" {
			httpjson.BadRequest(w, "input is required")
			return
		}
		if req.ModelAlias == "" {
			req.ModelAlias = "chat-default"
		}

		route, ok, err := findModelRoute(r, modelRoutes, req.ModelAlias)
		if err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		if !ok {
			httpjson.NotFound(w, "model route not found")
			return
		}

		inputTokens := estimateTokens(req.Input)
		outputTokens := estimateTokens(route.Primary) + 12
		httpjson.OK(w, invokeResponse{
			ID:           "llm_" + time.Now().UTC().Format("20060102150405.000000000"),
			ModelAlias:   route.Alias,
			Provider:     providerForModel(route.Primary),
			Model:        route.Primary,
			Fallback:     route.Fallback,
			Content:      mockCompletion(route, req.Input),
			FinishReason: "stop",
			Usage: usage{
				InputTokens:  inputTokens,
				OutputTokens: outputTokens,
				TotalTokens:  inputTokens + outputTokens,
			},
		})
	}
}

func findModelRoute(r *http.Request, modelRoutes ModelRouteRepository, alias string) (store.ModelRoute, bool, error) {
	items, err := modelRoutes.ListModelRoutes(r.Context())
	if err != nil {
		return store.ModelRoute{}, false, err
	}
	for _, item := range items {
		if item.Alias == alias {
			return item, true, nil
		}
	}
	return store.ModelRoute{}, false, nil
}

func mockCompletion(route store.ModelRoute, input string) string {
	trimmed := strings.TrimSpace(input)
	if utf8.RuneCountInString(trimmed) > 80 {
		trimmed = string([]rune(trimmed)[:80]) + "..."
	}
	return "Mock response routed by " + route.Alias + " through " + route.Primary + ": " + trimmed
}

func estimateTokens(value string) int {
	count := utf8.RuneCountInString(strings.TrimSpace(value))
	if count == 0 {
		return 0
	}
	return count/4 + 1
}

func providerForModel(model string) string {
	normalized := strings.ToLower(model)
	if strings.Contains(normalized, "gpt") || strings.Contains(normalized, "openai") {
		return "mock-openai"
	}
	if strings.Contains(normalized, "claude") {
		return "mock-anthropic"
	}
	return "mock-local"
}
