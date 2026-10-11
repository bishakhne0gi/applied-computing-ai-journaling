import { delay, http, HttpResponse } from 'msw'
import { API_BASE } from '@/utils/constants'
import { ENDPOINTS } from '@/utils/endpoints'
import { analyzeText, failedAnalysis } from './analyzer'
import { check } from './check'
import { addAnalysis, analysedEntries, analysesOf, createEntry, entryDetail, findEntry, listEntries, updateEntry } from './db'
import { computeInsights } from './insights'
import { badEntryId, cleanLanguage, cleanText, invalid, LANGUAGES, notFound, parseLanguage, parseListQuery, problem } from './responses'

// `?mock=slow|error|empty|analysis-fail|check-unavailable` forces UI states in dev, e2e and ui-qa runs.
const mockMode = () => (typeof location === 'undefined' ? '' : (new URLSearchParams(location.search).get('mock') ?? ''))
const url = (path: string) => `${API_BASE}${path}`
const ENTRY = url(ENDPOINTS.entry(':entryId'))
const ANALYSES = url(ENDPOINTS.analyses(':entryId'))

async function forcedResponse(): Promise<Response | undefined> {
  const mode = mockMode()
  await delay(mode === 'slow' ? 2000 : undefined)
  return mode === 'error' ? problem(500, 'Internal Server Error', 'Something went wrong') : undefined
}

function list(requestUrl: string): Response {
  if (mockMode() === 'empty') return HttpResponse.json({ items: [], next_cursor: null })
  const query = parseListQuery(new URL(requestUrl).searchParams)
  if (query instanceof Response) return query
  const page = listEntries(query.language, query.cursor, query.limit)
  return page ? HttpResponse.json(page) : problem(400, 'Bad Request', 'Invalid cursor')
}

function create(body: unknown): Response {
  const language = cleanLanguage(body)
  const text = cleanText(body)
  if (!language || !text) return invalid()
  return HttpResponse.json(createEntry(language, text), { status: 201 })
}

function detail(entryId: string): Response {
  const bad = badEntryId(entryId)
  if (bad) return bad
  const entry = findEntry(entryId)
  return entry ? HttpResponse.json(entryDetail(entry)) : notFound()
}

function update(entryId: string, body: unknown): Response {
  const bad = badEntryId(entryId)
  if (bad) return bad
  const entry = findEntry(entryId)
  const text = cleanText(body)
  if (!entry) return notFound()
  return text ? HttpResponse.json(updateEntry(entry, text)) : invalid()
}

// Like the backend, a failed analysis is a stored 201 resource, not an HTTP error.
function analyze(entryId: string): Response {
  const bad = badEntryId(entryId)
  if (bad) return bad
  const entry = findEntry(entryId)
  if (!entry) return notFound()
  // Only entries with no analyses yet fail, so seeded entries keep re-analysing successfully.
  const failFirst = mockMode() === 'analysis-fail' && analysesOf(entryId).length === 0
  const analysis = failFirst ? failedAnalysis(entry.id, entry.text) : analyzeText(entry.id, entry.text)
  return HttpResponse.json(addAnalysis(analysis), { status: 201 })
}

function history(entryId: string): Response {
  const bad = badEntryId(entryId)
  if (bad) return bad
  return findEntry(entryId) ? HttpResponse.json(analysesOf(entryId)) : notFound()
}

function insights(requestUrl: string): Response {
  const language = parseLanguage(new URL(requestUrl).searchParams)
  if (language instanceof Response) return language
  return HttpResponse.json(computeInsights(mockMode() === 'empty' ? [] : analysedEntries(language)))
}

export const handlers = [
  http.get(url(ENDPOINTS.languages), async () => (await forcedResponse()) ?? HttpResponse.json(LANGUAGES)),
  http.get(url(ENDPOINTS.entries), async ({ request }) => (await forcedResponse()) ?? list(request.url)),
  http.post(url(ENDPOINTS.entries), async ({ request }) => (await forcedResponse()) ?? create(await request.json())),
  http.get(ENTRY, async ({ params }) => (await forcedResponse()) ?? detail(String(params.entryId))),
  http.patch(ENTRY, async ({ params, request }) => (await forcedResponse()) ?? update(String(params.entryId), await request.json())),
  http.post(ANALYSES, async ({ params }) => (await forcedResponse()) ?? analyze(String(params.entryId))),
  http.get(ANALYSES, async ({ params }) => (await forcedResponse()) ?? history(String(params.entryId))),
  http.get(url(ENDPOINTS.insights), async ({ request }) => (await forcedResponse()) ?? insights(request.url)),
  http.post(url(ENDPOINTS.check), async ({ request }) => (await forcedResponse()) ?? check(await request.json(), mockMode())),
]
