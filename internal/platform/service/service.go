package service

import (
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/access"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/httpjson"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
)

type RegisterFunc func(mux *http.ServeMux, st *store.Store)

func NewMux(serviceName string, st *store.Store, registers ...RegisterFunc) *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodGet) {
			return
		}
		httpjson.OK(w, map[string]any{
			"service": serviceName,
			"status":  "ok",
			"time":    time.Now().UTC().Format(time.RFC3339),
		})
	})

	for _, register := range registers {
		register(mux, st)
	}

	return mux
}

func Listen(addr, serviceName string, handler http.Handler) error {
	return ListenWithLogger(NewLogger(), addr, serviceName, handler)
}

func ListenWithLogger(logger *slog.Logger, addr, serviceName string, handler http.Handler) error {
	logger.Info("service starting", "service", serviceName, "addr", addr)
	return http.ListenAndServe(addr, WithMiddleware(logger, serviceName, handler))
}

func NewLogger() *slog.Logger {
	return slog.New(slog.NewJSONHandler(os.Stdout, nil))
}

func Fatal(logger *slog.Logger, message string, err error) {
	logger.Error(message, "error", err)
	os.Exit(1)
}

func WithMiddleware(logger *slog.Logger, serviceName string, next http.Handler) http.Handler {
	return cors(requestLog(logger, serviceName, access.Middleware(access.LoadConfig(), next)))
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-API-Key, X-Request-ID")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func requestLog(logger *slog.Logger, serviceName string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		requestID := r.Header.Get("X-Request-ID")
		if requestID == "" {
			requestID = time.Now().UTC().Format("20060102150405.000000000")
		}
		w.Header().Set("X-Request-ID", requestID)
		next.ServeHTTP(w, r)
		logger.Info("request handled",
			"service", serviceName,
			"method", r.Method,
			"path", r.URL.Path,
			"request_id", requestID,
			"duration_ms", time.Since(start).Milliseconds(),
		)
	})
}
