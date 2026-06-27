package gateway

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/httpjson"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
)

type skillInvokeRequest struct {
	Name  string         `json:"name"`
	Input map[string]any `json:"input,omitempty"`
}

type skillUsage struct {
	SkillCalls int `json:"skillCalls"`
}

type skillInvokeResponse struct {
	ID       string         `json:"id"`
	Name     string         `json:"name"`
	Protocol string         `json:"protocol"`
	Route    string         `json:"route"`
	Output   map[string]any `json:"output"`
	Usage    skillUsage     `json:"usage"`
}

type skillAdapterRequest struct {
	ID    string
	Input map[string]any
}

type skillAdapterResponse struct {
	Output map[string]any
}

type skillAdapter interface {
	Invoke(ctx context.Context, skill store.SkillBinding, req skillAdapterRequest) (skillAdapterResponse, error)
}

type mockSkillAdapter struct{}

func skillInvokeHandler(skills SkillRepository, recorder InvocationRecorder) http.HandlerFunc {
	adapter := mockSkillAdapter{}

	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodPost) {
			return
		}

		var req skillInvokeRequest
		if err := httpjson.Decode(r, &req); err != nil {
			httpjson.BadRequest(w, err.Error())
			return
		}
		req.Name = strings.TrimSpace(req.Name)
		if req.Name == "" {
			httpjson.BadRequest(w, "name is required")
			return
		}
		if req.Input == nil {
			req.Input = map[string]any{}
		}

		skill, ok, err := findPublishedSkill(r.Context(), skills, req.Name)
		if err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		if !ok {
			httpjson.NotFound(w, "published skill binding not found")
			return
		}
		if err := validateSkillInput(skill, req.Input); err != nil {
			httpjson.BadRequest(w, err.Error())
			return
		}

		result, record, err := executeSkillInvocation(r.Context(), skill, req, adapter)
		if record.ID != "" && recorder != nil {
			if recordErr := recorder.RecordSkillInvocation(r.Context(), record); recordErr != nil {
				httpjson.Fail(w, http.StatusInternalServerError, "internal_error", recordErr.Error())
				return
			}
		}
		if err != nil {
			httpjson.Fail(w, http.StatusBadGateway, "skill_unavailable", err.Error())
			return
		}

		httpjson.OK(w, result)
	}
}

func executeSkillInvocation(ctx context.Context, skill store.SkillBinding, req skillInvokeRequest, adapter skillAdapter) (skillInvokeResponse, SkillInvocationInput, error) {
	id := nextID("skill_call")
	record := SkillInvocationInput{
		ID:         id,
		Name:       skill.Name,
		Protocol:   skill.Protocol,
		Route:      skill.Route,
		SkillCalls: 0,
		Result:     "502",
		Status:     "Failed",
	}

	adapterReq := skillAdapterRequest{ID: id, Input: req.Input}
	adapterResp, err := adapter.Invoke(ctx, skill, adapterReq)
	if err != nil {
		return skillInvokeResponse{}, record, fmt.Errorf("skill adapter failed: %w", err)
	}
	if adapterResp.Output == nil {
		adapterResp.Output = map[string]any{}
	}

	record.SkillCalls = 1
	record.Result = "200"
	record.Status = "Success"
	return skillInvokeResponse{
		ID:       id,
		Name:     skill.Name,
		Protocol: skill.Protocol,
		Route:    skill.Route,
		Output:   adapterResp.Output,
		Usage:    skillUsage{SkillCalls: 1},
	}, record, nil
}

func findPublishedSkill(ctx context.Context, skills SkillRepository, name string) (store.SkillBinding, bool, error) {
	items, err := skills.ListSkills(ctx)
	if err != nil {
		return store.SkillBinding{}, false, err
	}
	for _, item := range items {
		if item.Name == name && item.Status == "Published" {
			return item, true, nil
		}
	}
	return store.SkillBinding{}, false, nil
}

func (mockSkillAdapter) Invoke(ctx context.Context, skill store.SkillBinding, req skillAdapterRequest) (skillAdapterResponse, error) {
	select {
	case <-ctx.Done():
		return skillAdapterResponse{}, ctx.Err()
	default:
	}

	if mockSkillUnavailable(skill) {
		return skillAdapterResponse{}, errors.New("mock skill provider unavailable")
	}

	return skillAdapterResponse{
		Output: map[string]any{
			"summary":   fmt.Sprintf("Mock skill %s handled %s through %s", skill.Name, skill.Route, skill.Protocol),
			"inputKeys": skillInputKeys(req.Input),
			"protocol":  skill.Protocol,
		},
	}, nil
}

func mockSkillUnavailable(skill store.SkillBinding) bool {
	target := strings.ToLower(skill.Name + " " + skill.Route)
	return strings.Contains(target, "unavailable") ||
		strings.Contains(target, "fail") ||
		strings.Contains(target, "timeout")
}

func skillInputKeys(input map[string]any) []string {
	keys := make([]string, 0, len(input))
	for key := range input {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}
