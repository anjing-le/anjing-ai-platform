export interface AdminMetric {
  label: string
  value: string
  note: string
}

export interface AdminRecord {
  name: string
  type: string
  owner: string
  status: string
}

export interface AdminPageDefinition {
  id: string
  eyebrow: string
  title: string
  description: string
  primaryAction: string
  secondaryAction: string
  metrics: AdminMetric[]
  focusItems: string[]
  records: AdminRecord[]
}

