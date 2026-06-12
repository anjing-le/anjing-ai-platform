package gateway

import (
	"net/http"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/httpjson"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
)

func Register(mux *http.ServeMux, st *store.Store) {
	RegisterWithRoutes(mux, st, NewMemoryRouteRepository(st))
}

func RegisterWithRoutes(mux *http.ServeMux, st *store.Store, routes RouteRepository) {
	mux.HandleFunc("/api/gateway/healthz", func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodGet) {
			return
		}
		httpjson.OK(w, map[string]string{"service": "gateway-api", "status": "ok"})
	})
	mux.HandleFunc("/api/gateway/routes", routesHandler(routes))
	mux.HandleFunc("/api/gateway/model-routes", listHandler(st.ListModelRoutes))
	mux.HandleFunc("/api/gateway/skills", listHandler(st.ListSkills))
	mux.HandleFunc("/api/gateway/request-logs", listHandler(st.ListRequestLogs))
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

func listHandler[T any](list func() []T) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodGet) {
			return
		}
		httpjson.OK(w, list())
	}
}
