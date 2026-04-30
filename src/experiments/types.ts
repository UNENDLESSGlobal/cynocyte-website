import type { ComponentType } from 'react'

export type Category =
  | 'Hand Tracking'
  | 'Face & Mouth'
  | 'Body Pose'
  | 'Music & Audio'
  | 'Eye Tracking'
  | 'WebGL & 3D'
  | 'Spatial AI'
  | 'Biometric'
  | 'Games'

export interface Control {
  gesture: string
  action: string
}

export interface ExperimentConfig {
  id: string
  number: number
  title: string
  tagline: string
  description: string
  category: Category
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
  requires: ('camera' | 'microphone')[]
  howItWorks: string
  expectedOutcome: string
  controls: Control[]
  techUsed: string[]
  Component?: ComponentType | null
}

export const CATEGORY_COLORS: Record<Category, string> = {
  'Hand Tracking': '#6C63FF',
  'Face & Mouth': '#EC4899',
  'Body Pose': '#F59E0B',
  'Music & Audio': '#10B981',
  'Eye Tracking': '#3B82F6',
  'WebGL & 3D': '#8B5CF6',
  'Spatial AI': '#EF4444',
  'Biometric': '#06B6D4',
  'Games': '#F97316',
}

export const CATEGORY_BG: Record<Category, string> = {
  'Hand Tracking': 'rgba(108, 99, 255, 0.12)',
  'Face & Mouth': 'rgba(236, 72, 153, 0.12)',
  'Body Pose': 'rgba(245, 158, 11, 0.12)',
  'Music & Audio': 'rgba(16, 185, 129, 0.12)',
  'Eye Tracking': 'rgba(59, 130, 246, 0.12)',
  'WebGL & 3D': 'rgba(139, 92, 246, 0.12)',
  'Spatial AI': 'rgba(239, 68, 68, 0.12)',
  'Biometric': 'rgba(6, 182, 212, 0.12)',
  'Games': 'rgba(249, 115, 22, 0.12)',
}
