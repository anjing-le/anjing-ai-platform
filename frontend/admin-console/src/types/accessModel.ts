export type PlatformRoleId =
  | 'admin'
  | 'user'
  | 'developer'
  | 'operator'

export interface PlatformRole {
  id: PlatformRoleId
  name: string
  label: string
  purpose: string
}

export interface ConsoleEntry {
  id: string
  name: string
  title: string
  route: string
  summary: string
  status: 'planned' | 'designing' | 'ready'
  roles: PlatformRoleId[]
}
