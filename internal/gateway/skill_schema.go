package gateway

import (
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

var skillInputRules = map[string]skillInputRule{
	"search-knowledge@0.1": {
		Required: map[string]skillInputType{
			"query": skillInputString,
		},
		Optional: map[string]skillInputType{
			"topK": skillInputNumber,
		},
	},
	"generate-image@0.2": {
		Required: map[string]skillInputType{
			"prompt": skillInputString,
		},
		Optional: map[string]skillInputType{
			"size":  skillInputString,
			"style": skillInputString,
		},
	},
}

func validateSkillInput(skill store.SkillBinding, input map[string]any) error {
	rule, ok := skillInputRuleFor(skill)
	if !ok {
		return nil
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

func skillInputRuleFor(skill store.SkillBinding) (skillInputRule, bool) {
	version := strings.TrimSpace(skill.SchemaVersion)
	if version == "" {
		version = "0.1"
	}
	rule, ok := skillInputRules[fmt.Sprintf("%s@%s", skill.Name, version)]
	return rule, ok
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
