import type { MistakeOut } from './analysis'

// Mirrors backend/app/api/schemas/check.py. Offsets are code points into `analyzed_text` (normalised, trimmed).
export interface CheckRequest {
  language: string
  text: string
}

export type HintOut = Omit<MistakeOut, 'id'>

export interface CheckOut {
  analyzed_text: string
  hints: HintOut[]
}
