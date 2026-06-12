import type { LucideIcon } from "lucide-react";

export type RoleId = "admin" | "user" | "developer" | "operator";

export type ConsoleRoute =
  | "home"
  | "overview"
  | "iam"
  | "gateway"
  | "quota"
  | "docs";

export type StatusTone = "good" | "watch" | "warn" | "neutral";

export interface RoleDefinition {
  id: RoleId;
  name: string;
  label: string;
  purpose: string;
}

export interface NavItem {
  id: ConsoleRoute;
  name: string;
  label: string;
  summary: string;
  roles: RoleId[];
  icon: LucideIcon;
  tags: string[];
}

export interface MetricItem {
  label: string;
  value: string;
  note: string;
  tone?: StatusTone;
}

export interface TableRow {
  id: string;
  cells: string[];
  status: string;
  tone: StatusTone;
}

export interface PanelItem {
  label: string;
  value: string;
  note: string;
}

export interface InfoPanel {
  eyebrow: string;
  title: string;
  items: PanelItem[];
}

export interface ModulePageDefinition {
  id: Exclude<ConsoleRoute, "home">;
  eyebrow: string;
  title: string;
  description: string;
  primaryAction: string;
  tabs: string[];
  metrics: MetricItem[];
  table: {
    eyebrow: string;
    title: string;
    columns: string[];
    rows: TableRow[];
  };
  panels: InfoPanel[];
}

export interface TodoItem {
  id: string;
  moduleId: ConsoleRoute;
  moduleLabel: string;
  title: string;
  status: string;
  owner: string;
  tone: StatusTone;
}
