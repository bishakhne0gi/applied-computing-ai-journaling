import { HttpResponse } from 'msw'
import type { MistakeOut } from '@/types/analysis'
import type { CheckOut, HintOut } from '@/types/check'
import { analyzeText } from './analyzer'
import { cleanLanguage, cleanText, invalid, problem } from './responses'

const toHint = ({ kind, category, original, correction, explanation, start, end }: MistakeOut): HintOut => ({ kind, category, original, correction, explanation, start, end })

// The mock analyser's rules, with nothing stored — like the backend's /check.
export function checkText(text: string, language = 'es'): CheckOut {
  const analysis = analyzeText('live-check', text, undefined, language)
  return { analyzed_text: analysis.input_text, hints: analysis.mistakes.map(toHint) }
}

export function check(body: unknown, mode: string): Response {
  if (mode === 'check-unavailable') return problem(503, 'Service Unavailable', 'Live hints are unavailable right now')
  const language = cleanLanguage(body)
  const text = cleanText(body)
  if (!language || !text) return invalid()
  return HttpResponse.json(checkText(text, language))
}
