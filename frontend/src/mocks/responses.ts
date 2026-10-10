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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

export const invalidParam = (where: 'path' | 'query', name: string, msg: string) =>
  problem(422, 'Unprocessable Content', 'Request validation failed', {
    errors: [{ loc: [where, name], msg, type: 'value_error' }],
  })

export const badEntryId = (entryId: string): Response | null =>
  UUID.test(entryId) ? null : invalidParam('path', 'entry_id', 'Input should be a valid UUID')

export type ListQuery = { language: string | null; cursor: string | null; limit: number } | Response

// Mirrors the backend's Query(ge=1, le=50) and supported-language check.
export function parseListQuery(params: URLSearchParams): ListQuery {
  const rawLimit = params.get('limit') ?? '20'
  const limit = /^[+-]?\d+$/u.test(rawLimit) ? Number(rawLimit) : Number.NaN
  if (!(limit >= 1 && limit <= 50)) return invalidParam('query', 'limit', 'limit must be an integer between 1 and 50')
  const language = params.get('language')
  if (language !== null && !LANGUAGES.some((item) => item.code === language)) {
    return invalidParam('query', 'language', 'Unsupported language')
  }
  return { language, cursor: params.get('cursor'), limit }
}
