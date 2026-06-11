package gateway

import (
	"net/http"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/httpjson"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
)

func Register(mux *http.ServeMux, st *store.Store) {
	mux.HandleFunc("/api/gateway/healthz", func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodGet) {
			return
		}
		httpjson.OK(w, map[string]string{"service": "gateway-api", "status": "ok"})
	})
	mux.HandleFunc("/api/gateway/routes", routesHandler(st))
	mux.HandleFunc("/api/gateway/model-routes", listHandler(st.ListModelRoutes))
	mux.HandleFunc("/api/gateway/skills", listHandler(st.ListSkills))
	mux.HandleFunc("/api/gateway/request-logs", listHandler(st.ListRequestLogs))
}

func routesHandler(st *store.Store) http.HandlerFunc {
	type createRouteRequest struct {
		Route    string `json:"route"`
		Upstream string `json:"upstream"`
		Limit    string `json:"limit"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			httpjson.OK(w, st.ListRoutes())
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
			httpjson.Created(w, st.CreateRoute(req.Route, req.Upstream, req.Limit))
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
