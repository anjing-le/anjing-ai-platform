package snapshot_test

import (
	"context"
	"strings"
	"testing"

	"github.com/anjing-le/anjing-ai-platform/internal/billing"
	"github.com/anjing-le/anjing-ai-platform/internal/control"
	"github.com/anjing-le/anjing-ai-platform/internal/gateway"
	"github.com/anjing-le/anjing-ai-platform/internal/ops"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/snapshot"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/store"
)

func TestRepositoryLoadsConsoleSnapshotFromModuleRepositories(t *testing.T) {
	st := store.NewSeedStore()
	controlRepos := control.NewMemoryRepositories(st)
	gatewayRepos := gateway.NewMemoryRepositories(st)
	billingRepos := billing.NewMemoryRepositories(st)
	opsRepos := ops.NewMemoryRepositories(st)

	repo := snapshot.NewRepository(snapshot.Sources{
		Users:        controlRepos.Users,
		Applications: controlRepos.Applications,
		Roles:        controlRepos.Roles,
		APIKeys:      controlRepos.APIKeys,
		Credentials:  controlRepos.Credentials,
		Routes:       gatewayRepos.Routes,
		ModelRoutes:  gatewayRepos.ModelRoutes,
		Skills:       gatewayRepos.Skills,
		RequestLogs:  gatewayRepos.RequestLogs,
		Plans:        billingRepos.Plans,
		Usage:        billingRepos.Usage,
		BudgetAlerts: billingRepos.BudgetAlerts,
		Todos:        opsRepos.Todos,
		Health:       opsRepos.Health,
		Audit:        opsRepos.Audit,
	})

	item, err := repo.LoadSnapshot(context.Background())
	if err != nil {
		t.Fatalf("load snapshot: %v", err)
	}

	if len(item.Users) == 0 || len(item.Routes) == 0 || len(item.Plans) == 0 {
		t.Fatalf("expected users, routes and plans in snapshot: %+v", item)
	}
	if len(item.Dashboard.Todos) == 0 || len(item.Dashboard.Health) == 0 || len(item.Dashboard.Audit) == 0 {
		t.Fatalf("expected ops dashboard data in snapshot: %+v", item.Dashboard)
	}
	if metricValue(t, item.Dashboard.Metrics, "待处理") != "3" {
		t.Fatalf("expected pending metric to reflect unresolved todos")
	}
}

func TestRepositoryReturnsClearErrorWhenSourceIsMissing(t *testing.T) {
	repo := snapshot.NewRepository(snapshot.Sources{})

	_, err := repo.LoadSnapshot(context.Background())

	if err == nil {
		t.Fatal("expected missing source error")
	}
	if !strings.Contains(err.Error(), "snapshot source users is required") {
		t.Fatalf("expected clear missing source error, got %v", err)
	}
}

func metricValue(t *testing.T, metrics []store.Metric, label string) string {
	t.Helper()

	for _, metric := range metrics {
		if metric.Label == label {
			return metric.Value
		}
	}
	t.Fatalf("metric %q not found in %+v", label, metrics)
	return ""
}
