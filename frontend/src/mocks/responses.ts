import { HttpResponse } from 'msw'
import type { LanguageOut } from '@/types/language'
import { MAX_ENTRY_CHARS } from '@/utils/constants'
import { codePointLength } from '@/utils/text'

export const LANGUAGES: LanguageOut[] = [
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
]

export function problem(status: number, title: string, detail: string, extra: object = {}): Response {
  return HttpResponse.json(
    { type: 'about:blank', title, status, detail, request_id: 'mock-request', ...extra },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  )
}

export const notFound = () => problem(404, 'Not Found', 'Entry not found')

export const invalid = () =>
  problem(422, 'Unprocessable Content', 'Request validation failed', {
    errors: [{ loc: ['body', 'text'], msg: `Text must be between 1 and ${MAX_ENTRY_CHARS} characters`, type: 'value_error' }],
  })

const field = (body: unknown, name: string): unknown =>
  typeof body === 'object' && body !== null && name in body ? (body as Record<string, unknown>)[name] : undefined

// Mirrors the backend: trimmed, NFC, \n line endings, 1–5000 code points.
export function cleanText(body: unknown): string | null {
  const raw = field(body, 'text')
  if (typeof raw !== 'string') return null
  const text = raw.trim().normalize('NFC').replace(/\r\n?/gu, '\n')
  const length = codePointLength(text)
  return length >= 1 && length <= MAX_ENTRY_CHARS ? text : null
}

export function cleanLanguage(body: unknown): string | null {
  const raw = field(body, 'language')
  return LANGUAGES.some((language) => language.code === raw) ? String(raw) : null
}
