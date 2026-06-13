package service

import (
	"bytes"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRequestLogIncludesResponseStatus(t *testing.T) {
	var log bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&log, nil))
	handler := requestLog(logger, "test-service", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/demo", nil)
	req.Header.Set("X-Request-ID", "req-test")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d", http.StatusCreated, rec.Code)
	}
	if rec.Header().Get("X-Request-ID") != "req-test" {
		t.Fatalf("expected request id header to be preserved")
	}

	output := log.String()
	for _, want := range []string{
		`"service":"test-service"`,
		`"method":"POST"`,
		`"path":"/api/demo"`,
		`"status":201`,
		`"request_id":"req-test"`,
	} {
		if !strings.Contains(output, want) {
			t.Fatalf("expected log to contain %s, got %s", want, output)
		}
	}
}

func TestRequestLogDefaultsToOKWhenHandlerWritesBody(t *testing.T) {
	var log bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&log, nil))
	handler := requestLog(logger, "test-service", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("ok"))
	}))

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}
	if !strings.Contains(log.String(), `"status":200`) {
		t.Fatalf("expected log to contain default status 200, got %s", log.String())
	}
	if rec.Header().Get("X-Request-ID") == "" {
		t.Fatalf("expected generated request id header")
	}
}
