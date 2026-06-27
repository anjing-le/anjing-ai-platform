package gateway

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/httpjson"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
)

type llmInvokeRequest struct {
	ModelAlias  string  `json:"modelAlias"`
	Input       string  `json:"input"`
	Temperature float64 `json:"temperature,omitempty"`
}

type llmUsage struct {
	InputTokens  int `json:"inputTokens"`
	OutputTokens int `json:"outputTokens"`
	TotalTokens  int `json:"totalTokens"`
}

type llmInvokeResponse struct {
	ID           string   `json:"id"`
	ModelAlias   string   `json:"modelAlias"`
	Provider     string   `json:"provider"`
	Model        string   `json:"model"`
	Fallback     string   `json:"fallback"`
	UsedFallback bool     `json:"usedFallback"`
	Content      string   `json:"content"`
	FinishReason string   `json:"finishReason"`
	Usage        llmUsage `json:"usage"`
}

type llmStreamMeta struct {
	ID           string `json:"id"`
	ModelAlias   string `json:"modelAlias"`
	Provider     string `json:"provider"`
	Model        string `json:"model"`
	Fallback     string `json:"fallback"`
	UsedFallback bool   `json:"usedFallback"`
}

type llmStreamDelta struct {
	Delta string `json:"delta"`
}

type llmStreamDone struct {
	FinishReason string   `json:"finishReason"`
	Usage        llmUsage `json:"usage"`
}

type llmProviderRequest struct {
	ID          string
	ModelAlias  string
	Input       string
	Temperature float64
}

type llmProviderResponse struct {
	Provider     string
	Content      string
	FinishReason string
	OutputTokens int
}

type llmProviderAdapter interface {
	Invoke(ctx context.Context, route store.ModelRoute, model string, req llmProviderRequest) (llmProviderResponse, error)
}

type mockLLMAdapter struct{}

func llmInvokeHandler(modelRoutes ModelRouteRepository, recorder InvocationRecorder) http.HandlerFunc {
	adapter := mockLLMAdapter{}

	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodPost) {
			return
		}

		var req llmInvokeRequest
		if err := httpjson.Decode(r, &req); err != nil {
			httpjson.BadRequest(w, err.Error())
			return
		}
		if err := normalizeLLMInvokeRequest(&req); err != nil {
			httpjson.BadRequest(w, err.Error())
			return
		}

		route, ok, err := findActiveModelRoute(r.Context(), modelRoutes, req.ModelAlias)
		if err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		if !ok {
			httpjson.NotFound(w, "model route not found")
			return
		}

		result, record, err := executeLLMInvocation(r.Context(), route, req, adapter)
		if record.ID != "" && recorder != nil {
			if recordErr := recorder.RecordLLMInvocation(r.Context(), record); recordErr != nil {
				httpjson.Fail(w, http.StatusInternalServerError, "internal_error", recordErr.Error())
				return
			}
		}
		if err != nil {
			httpjson.Fail(w, http.StatusBadGateway, "llm_unavailable", err.Error())
			return
		}

		httpjson.OK(w, result)
	}
}

func llmStreamHandler(modelRoutes ModelRouteRepository, recorder InvocationRecorder) http.HandlerFunc {
	adapter := mockLLMAdapter{}

	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodPost) {
			return
		}

		var req llmInvokeRequest
		if err := httpjson.Decode(r, &req); err != nil {
			httpjson.BadRequest(w, err.Error())
			return
		}
		if err := normalizeLLMInvokeRequest(&req); err != nil {
			httpjson.BadRequest(w, err.Error())
			return
		}

		route, ok, err := findActiveModelRoute(r.Context(), modelRoutes, req.ModelAlias)
		if err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		if !ok {
			httpjson.NotFound(w, "model route not found")
			return
		}

		result, record, err := executeLLMInvocation(r.Context(), route, req, adapter)
		if record.ID != "" && recorder != nil {
			if recordErr := recorder.RecordLLMInvocation(r.Context(), record); recordErr != nil {
				httpjson.Fail(w, http.StatusInternalServerError, "internal_error", recordErr.Error())
				return
			}
		}
		if err != nil {
			httpjson.Fail(w, http.StatusBadGateway, "llm_unavailable", err.Error())
			return
		}

		w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("X-Accel-Buffering", "no")
		flusher, canFlush := w.(http.Flusher)

		events := []struct {
			Name    string
			Payload any
		}{
			{
				Name: "meta",
				Payload: llmStreamMeta{
					ID:           result.ID,
					ModelAlias:   result.ModelAlias,
					Provider:     result.Provider,
					Model:        result.Model,
					Fallback:     result.Fallback,
					UsedFallback: result.UsedFallback,
				},
			},
		}
		for _, chunk := range streamTextChunks(result.Content, 24) {
			events = append(events, struct {
				Name    string
				Payload any
			}{
				Name:    "delta",
				Payload: llmStreamDelta{Delta: chunk},
			})
		}
		events = append(events, struct {
			Name    string
			Payload any
		}{
			Name: "done",
			Payload: llmStreamDone{
				FinishReason: result.FinishReason,
				Usage:        result.Usage,
			},
		})

		for _, event := range events {
			if err := writeSSEEvent(w, event.Name, event.Payload); err != nil {
				return
			}
			if canFlush {
				flusher.Flush()
			}
		}
	}
}

func normalizeLLMInvokeRequest(req *llmInvokeRequest) error {
	req.Input = strings.TrimSpace(req.Input)
	req.ModelAlias = strings.TrimSpace(req.ModelAlias)
	if req.Input == "" {
		return errors.New("input is required")
	}
	if req.ModelAlias == "" {
		req.ModelAlias = "chat-default"
	}
	if req.Temperature < 0 || req.Temperature > 2 {
		return errors.New("temperature must be between 0 and 2")
	}
	return nil
}

func executeLLMInvocation(ctx context.Context, route store.ModelRoute, req llmInvokeRequest, adapter llmProviderAdapter) (llmInvokeResponse, LLMInvocationInput, error) {
	id := nextID("llm")
	inputTokens := estimateTokens(req.Input)
	candidates := modelCandidates(route)
	record := LLMInvocationInput{
		ID:          id,
		ModelAlias:  route.Alias,
		Provider:    providerForModel(route.Primary),
		Model:       route.Primary,
		TotalTokens: 0,
		Result:      "502",
		Status:      "Failed",
	}
	if len(candidates) == 0 {
		return llmInvokeResponse{}, record, errors.New("model route has no candidate models")
	}

	providerReq := llmProviderRequest{
		ID:          id,
		ModelAlias:  route.Alias,
		Input:       req.Input,
		Temperature: req.Temperature,
	}
	var lastErr error
	for index, model := range candidates {
		providerResp, err := adapter.Invoke(ctx, route, model, providerReq)
		if err != nil {
			lastErr = err
			continue
		}

		provider := providerResp.Provider
		if provider == "" {
			provider = providerForModel(model)
		}
		outputTokens := providerResp.OutputTokens
		if outputTokens <= 0 {
			outputTokens = estimateTokens(providerResp.Content)
		}
		finishReason := providerResp.FinishReason
		if finishReason == "" {
			finishReason = "stop"
		}
		usedFallback := index > 0
		status := "Success"
		if usedFallback {
			status = "Fallback"
		}
		totalTokens := inputTokens + outputTokens

		record.Provider = provider
		record.Model = model
		record.TotalTokens = totalTokens
		record.Result = "200"
		record.Status = status

		return llmInvokeResponse{
			ID:           id,
			ModelAlias:   route.Alias,
			Provider:     provider,
			Model:        model,
			Fallback:     route.Fallback,
			UsedFallback: usedFallback,
			Content:      providerResp.Content,
			FinishReason: finishReason,
			Usage: llmUsage{
				InputTokens:  inputTokens,
				OutputTokens: outputTokens,
				TotalTokens:  totalTokens,
			},
		}, record, nil
	}

	if lastErr == nil {
		lastErr = errors.New("no provider candidate was attempted")
	}
	return llmInvokeResponse{}, record, fmt.Errorf("all provider candidates failed: %w", lastErr)
}

func (mockLLMAdapter) Invoke(ctx context.Context, route store.ModelRoute, model string, req llmProviderRequest) (llmProviderResponse, error) {
	select {
	case <-ctx.Done():
		return llmProviderResponse{}, ctx.Err()
	default:
	}

	if mockProviderUnavailable(model) {
		return llmProviderResponse{}, fmt.Errorf("mock provider unavailable for model %s", model)
	}

	content := mockCompletion(route, model, req.Input)
	return llmProviderResponse{
		Provider:     providerForModel(model),
		Content:      content,
		FinishReason: "stop",
		OutputTokens: estimateTokens(model) + 12,
	}, nil
}

func findActiveModelRoute(ctx context.Context, modelRoutes ModelRouteRepository, alias string) (store.ModelRoute, bool, error) {
	items, err := modelRoutes.ListModelRoutes(ctx)
	if err != nil {
		return store.ModelRoute{}, false, err
	}
	for _, item := range items {
		if item.Alias == alias && strings.EqualFold(item.Status, "Active") {
			return item, true, nil
		}
	}
	return store.ModelRoute{}, false, nil
}

func modelCandidates(route store.ModelRoute) []string {
	candidates := make([]string, 0, 2)
	primary := strings.TrimSpace(route.Primary)
	if primary != "" {
		candidates = append(candidates, primary)
	}
	fallback := strings.TrimSpace(route.Fallback)
	if fallback != "" && !strings.EqualFold(fallback, primary) {
		candidates = append(candidates, fallback)
	}
	return candidates
}

func mockProviderUnavailable(model string) bool {
	normalized := strings.ToLower(model)
	return strings.Contains(normalized, "unavailable") ||
		strings.Contains(normalized, "fail") ||
		strings.Contains(normalized, "timeout")
}

func mockCompletion(route store.ModelRoute, model string, input string) string {
	trimmed := strings.TrimSpace(input)
	if utf8.RuneCountInString(trimmed) > 80 {
		trimmed = string([]rune(trimmed)[:80]) + "..."
	}
	return "Mock response routed by " + route.Alias + " through " + model + ": " + trimmed
}

func streamTextChunks(value string, chunkSize int) []string {
	if chunkSize <= 0 {
		chunkSize = 24
	}
	runes := []rune(value)
	if len(runes) == 0 {
		return []string{""}
	}
	chunks := make([]string, 0, len(runes)/chunkSize+1)
	for start := 0; start < len(runes); start += chunkSize {
		end := start + chunkSize
		if end > len(runes) {
			end = len(runes)
		}
		chunks = append(chunks, string(runes[start:end]))
	}
	return chunks
}

func writeSSEEvent(w http.ResponseWriter, event string, payload any) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	if _, err := fmt.Fprintf(w, "event: %s\n", event); err != nil {
		return err
	}
	if _, err := fmt.Fprintf(w, "data: %s\n\n", data); err != nil {
		return err
	}
	return nil
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
