export interface AdminMetric {
  label: string
  value: string
  note: string
}

export interface AdminTable {
  eyebrow: string
  title: string
  columns: string[]
  rows: string[][]
}

export interface AdminPanelItem {
  label: string
  value: string
  note: string
}

export interface AdminPanel {
  eyebrow: string
  title: string
  items: AdminPanelItem[]
}

export interface AdminPageDefinition {
  id: string
  layout: 'dashboard' | 'management'
  eyebrow: string
  title: string
  description: string
  primaryAction: string
  tabs: string[]
  metrics: AdminMetric[]
  primaryTable: AdminTable
  secondaryTable?: AdminTable
  panels: AdminPanel[]
}
