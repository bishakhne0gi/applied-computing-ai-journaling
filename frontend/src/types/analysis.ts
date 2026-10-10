// Mirrors backend/app/api/schemas/analyses.py.
export type MistakeKind = 'error' | 'suggestion' | 'vocab_help'
export type Category =
  | 'verb_conjugation'
  | 'verb_tense'
  | 'gender_agreement'
  | 'number_agreement'
  | 'article'
  | 'preposition'
  | 'word_order'
  | 'spelling'
  | 'vocabulary'
  | 'punctuation'
  | 'other'
export type AnalysisStatus = 'pending' | 'succeeded' | 'failed'
export type FailureCode = 'provider_timeout' | 'invalid_output' | 'provider_error'

export interface MistakeOut {
  id: string
  kind: MistakeKind
  category: Category
  original: string
  correction: string
  explanation: string
  start: number | null
  end: number | null
}

export interface AnalysisOut {
  id: string
  entry_id: string
  status: AnalysisStatus
  input_text: string
  corrected_text: string | null
  feedback_summary: string | null
  model: string | null
  prompt_version: string
  error_code: FailureCode | null
  latency_ms: number | null
  created_at: string
  completed_at: string | null
  mistakes: MistakeOut[]
}
