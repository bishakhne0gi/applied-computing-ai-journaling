import type { AnalysisOut, MistakeOut } from '@/types/analysis'

const CREATED_AT = '2026-10-09T18:00:00.000Z'
let sequence = 0

export function nextId(prefix: string): string {
  sequence += 1
  return `${prefix}-${sequence}`
}

export function buildMistake(overrides: Partial<MistakeOut> = {}): MistakeOut {
  return {
    id: nextId('mistake'),
    kind: 'error',
    category: 'verb_conjugation',
    original: 'yo es',
    correction: 'yo soy',
    explanation: 'With «yo», «ser» is conjugated «soy».',
    start: 5,
    end: 10,
    ...overrides,
  }
}

export function buildAnalysis(overrides: Partial<AnalysisOut> = {}): AnalysisOut {
  return {
    id: nextId('analysis'),
    entry_id: 'entry-test',
    status: 'succeeded',
    input_text: 'Ayer yo es feliz.',
    corrected_text: 'Ayer yo soy feliz.',
    feedback_summary: 'Good effort! 1 thing to look at.',
    model: 'mock',
    prompt_version: 'v1',
    error_code: null,
    latency_ms: 850,
    created_at: CREATED_AT,
    completed_at: CREATED_AT,
    mistakes: [buildMistake()],
    ...overrides,
  }
}
