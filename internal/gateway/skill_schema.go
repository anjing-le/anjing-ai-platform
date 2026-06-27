package gateway

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
)

type skillInputType string

const (
	skillInputString  skillInputType = "string"
	skillInputNumber  skillInputType = "number"
	skillInputBoolean skillInputType = "boolean"
	skillInputObject  skillInputType = "object"
	skillInputArray   skillInputType = "array"
)

type skillInputRule struct {
	Required map[string]skillInputType
	Optional map[string]skillInputType
}

type skillSchemaLoadError struct {
	err error
}

func (err skillSchemaLoadError) Error() string {
	return err.err.Error()
}

func (err skillSchemaLoadError) Unwrap() error {
	return err.err
}

func validateSkillInput(ctx context.Context, schemas SkillSchemaRepository, skill store.SkillBinding, input map[string]any) error {
	if schemas == nil {
		return nil
	}

	version := normalizedSkillSchemaVersion(skill.SchemaVersion)
	schema, ok, err := schemas.FindSkillSchema(ctx, skill.Name, version)
	if err != nil {
		return skillSchemaLoadError{err: fmt.Errorf("load skill schema %s %s: %w", skill.Name, version, err)}
	}
	if !ok {
		return nil
	}
	rule, err := skillInputRuleFromSchema(schema)
	if err != nil {
		return err
	}
	if input == nil {
		input = map[string]any{}
	}

	for field, expected := range rule.Required {
		value, exists := input[field]
		if !exists {
			return fmt.Errorf("input.%s is required by %s schema %s", field, skill.Name, skill.SchemaVersion)
		}
		if err := validateSkillInputValue(field, value, expected, true); err != nil {
			return err
		}
	}

	for field, expected := range rule.Optional {
		value, exists := input[field]
		if !exists {
			continue
		}
		if err := validateSkillInputValue(field, value, expected, false); err != nil {
			return err
		}
	}

	return nil
}

func normalizedSkillSchemaVersion(version string) string {
	version = strings.TrimSpace(version)
	if version == "" {
		return "0.1"
	}
	return version
}

func skillInputRuleFromSchema(schema store.SkillSchema) (skillInputRule, error) {
	required := make(map[string]skillInputType, len(schema.RequiredFields))
	for _, field := range schema.RequiredFields {
		name := strings.TrimSpace(field.Name)
		if name == "" {
			continue
		}
		inputType, ok := skillInputTypeFromString(field.Type)
		if !ok {
			return skillInputRule{}, fmt.Errorf("skill schema %s %s field %s uses unsupported type %s", schema.SkillName, schema.Version, name, field.Type)
		}
		required[name] = inputType
	}

	optional := make(map[string]skillInputType, len(schema.OptionalFields))
	for _, field := range schema.OptionalFields {
		name := strings.TrimSpace(field.Name)
		if name == "" {
			continue
		}
		inputType, ok := skillInputTypeFromString(field.Type)
		if !ok {
			return skillInputRule{}, fmt.Errorf("skill schema %s %s field %s uses unsupported type %s", schema.SkillName, schema.Version, name, field.Type)
		}
		optional[name] = inputType
	}

	return skillInputRule{Required: required, Optional: optional}, nil
}

func skillInputTypeFromString(value string) (skillInputType, bool) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "string":
		return skillInputString, true
	case "number":
		return skillInputNumber, true
	case "boolean":
		return skillInputBoolean, true
	case "object":
		return skillInputObject, true
	case "array":
		return skillInputArray, true
	default:
		return "", false
	}
}

func validateSkillInputValue(field string, value any, expected skillInputType, required bool) error {
	switch expected {
	case skillInputString:
		text, ok := value.(string)
		if !ok {
			return fmt.Errorf("input.%s must be a string", field)
		}
		if required && strings.TrimSpace(text) == "" {
			return fmt.Errorf("input.%s must not be empty", field)
		}
	case skillInputNumber:
		switch value.(type) {
		case float64, float32, int, int64, int32, json.Number:
		default:
			return fmt.Errorf("input.%s must be a number", field)
		}
	case skillInputBoolean:
		if _, ok := value.(bool); !ok {
			return fmt.Errorf("input.%s must be a boolean", field)
		}
	case skillInputObject:
		if _, ok := value.(map[string]any); !ok {
			return fmt.Errorf("input.%s must be an object", field)
		}
	case skillInputArray:
		if _, ok := value.([]any); !ok {
			return fmt.Errorf("input.%s must be an array", field)
		}
	default:
		return fmt.Errorf("input.%s has unsupported schema type %s", field, expected)
	}

	return nil
}
