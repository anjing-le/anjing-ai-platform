package access

import (
	"os"
	"reflect"
	"regexp"
	"sort"
	"strings"
	"testing"
)

type openAPIOperation struct {
	Method string
	Path   string
	Roles  []Role
}

func TestOpenAPIRolesMatchAccessPolicy(t *testing.T) {
	operations := parseOpenAPIRoles(t)
	if len(operations) == 0 {
		t.Fatal("expected OpenAPI operations with x-anjing-roles")
	}

	roles := []Role{RoleAdministrator, RoleUser, RoleDeveloper, RoleOperator}
	for _, operation := range operations {
		var allowed []Role
		for _, role := range roles {
			if Allowed(role, operation.Method, operation.Path) {
				allowed = append(allowed, role)
			}
		}
		sortRoles(allowed)
		sortRoles(operation.Roles)

		if !reflect.DeepEqual(allowed, operation.Roles) {
			t.Fatalf("%s %s role mismatch: OpenAPI=%v backend=%v", operation.Method, operation.Path, operation.Roles, allowed)
		}
	}
}

func parseOpenAPIRoles(t *testing.T) []openAPIOperation {
	t.Helper()

	content, err := os.ReadFile("../../../contracts/openapi/platform-api.yaml")
	if err != nil {
		t.Fatalf("read OpenAPI contract: %v", err)
	}

	pathPattern := regexp.MustCompile(`^  (/(?:api/[^:]+|healthz)):$`)
	methodPattern := regexp.MustCompile(`^    (get|post|put|patch|delete|options):$`)
	rolesPattern := regexp.MustCompile(`^      x-anjing-roles: \[([^\]]*)\]$`)

	var operations []openAPIOperation
	currentPath := ""
	currentMethod := ""

	for _, line := range strings.Split(string(content), "\n") {
		if match := pathPattern.FindStringSubmatch(line); match != nil {
			currentPath = match[1]
			currentMethod = ""
			continue
		}

		if match := methodPattern.FindStringSubmatch(line); match != nil {
			currentMethod = strings.ToUpper(match[1])
			continue
		}

		if match := rolesPattern.FindStringSubmatch(line); match != nil && currentPath != "" && currentMethod != "" {
			operations = append(operations, openAPIOperation{
				Method: currentMethod,
				Path:   currentPath,
				Roles:  parseRoles(match[1]),
			})
		}
	}

	return operations
}

func parseRoles(raw string) []Role {
	if strings.TrimSpace(raw) == "" {
		return nil
	}

	var roles []Role
	for _, item := range strings.Split(raw, ",") {
		roles = append(roles, Role(strings.TrimSpace(item)))
	}
	sortRoles(roles)
	return roles
}

func sortRoles(roles []Role) {
	sort.Slice(roles, func(left, right int) bool {
		return roleRank(roles[left]) < roleRank(roles[right])
	})
}

func roleRank(role Role) int {
	switch role {
	case RoleAdministrator:
		return 0
	case RoleUser:
		return 1
	case RoleDeveloper:
		return 2
	case RoleOperator:
		return 3
	default:
		return 99
	}
}
