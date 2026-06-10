export type PlatformLayer = 'entry' | 'identity' | 'ai' | 'governance' | 'shared'

export interface PlatformModule {
  id: string
  name: string
  title: string
  layer: PlatformLayer
  summary: string
  role: string
  responsibilities: string[]
  source: string
  accent: string
}

