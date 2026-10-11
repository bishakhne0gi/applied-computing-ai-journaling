import { categoryLabel } from '@/features/feedback/labels'
import type { Category } from '@/types/analysis'
import type { CategoryInsightOut, InsightsOut, InsightsStatus, RatePointOut, Trend } from '@/types/insights'
import { pluralize } from '@/utils/formatter'
import { countWords } from '@/utils/text'
import type { AnalysedEntry } from './db'

// A port of backend/app/services/insights/{calculations,summary}.py, so dev, tests and e2e see the numbers the
// real API would send for the same entries. Change both together.
const MIN_ENTRIES = 3
const MIN_ENTRIES_FOR_TRENDS = 4
const WINDOW_CAP = 5
const RECURRING_WINDOW = 5
const RECURRING_MIN = 3
const TREND_FLOOR = 0.5
const TREND_SHARE = 0.25

interface Counted {
  id: string
  createdAt: string
  words: number
  errors: Map<Category, { count: number; original: string; correction: string }>
}

type Windows = readonly [earlier: Counted[], recent: Counted[]]
type Body = Omit<InsightsOut, 'summary'>

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)
const errorsIn = (item: Counted, category?: Category) =>
  category ? (item.errors.get(category)?.count ?? 0) : sum([...item.errors.values()].map((error) => error.count))
const rate = (errors: number, words: number) => (words > 0 ? (errors * 100) / words : null)
const pooled = (items: Counted[], category?: Category) =>
  rate(sum(items.map((item) => errorsIn(item, category))), sum(items.map((item) => item.words)))
// Half-up on the shortest decimal form, like the backend's Decimal(str(value)); value * 10 would mis-round 1.15.
const round = (value: number | null) => (value === null ? null : Math.round(Number(`${value}e1`)) / 10)

function toCounted({ entry, analysis }: AnalysedEntry): Counted {
  const errors: Counted['errors'] = new Map()
  for (const mistake of analysis.mistakes.filter((item) => item.kind === 'error')) {
    const previous = errors.get(mistake.category)
    const first = { count: 1, original: mistake.original, correction: mistake.correction }
    errors.set(mistake.category, previous ? { ...previous, count: previous.count + 1 } : first)
  }
  return { id: entry.id, createdAt: entry.created_at, words: countWords(analysis.input_text), errors }
}

function splitWindows(items: Counted[]): Windows {
  const recentSize = Math.min(Math.ceil(items.length / 2), WINDOW_CAP)
  const earlierSize = Math.min(Math.floor(items.length / 2), WINDOW_CAP)
  const start = items.length - recentSize
  return [items.slice(start - earlierSize, start), items.slice(start)]
}

function classifyTrend(earlier: number | null, recent: number | null): Trend | null {
  if (earlier === null || recent === null) return null
  const threshold = Math.max(TREND_FLOOR, TREND_SHARE * earlier)
  if (recent - earlier <= -threshold) return 'improving'
  return recent - earlier >= threshold ? 'worsening' : 'stable'
}

function statusOf(count: number): InsightsStatus {
  if (count < MIN_ENTRIES) return 'insufficient_data'
  return count < MIN_ENTRIES_FOR_TRENDS ? 'totals_only' : 'trends'
}

const windowRates = (windows: Windows | null, category?: Category) =>
  windows ? ([pooled(windows[0], category), pooled(windows[1], category)] as const) : ([null, null] as const)

function categoryInsight(category: Category, items: Counted[], windows: Windows | null): CategoryInsightOut {
  const recentEntries = items.slice(-RECURRING_WINDOW).filter((item) => item.errors.has(category)).length
  const [earlier, recent] = windowRates(windows, category)
  const latest = items.findLast((item) => item.errors.has(category))?.errors.get(category)
  return {
    category,
    occurrences: sum(items.map((item) => errorsIn(item, category))),
    recent_entries: recentEntries,
    recurring: recentEntries >= RECURRING_MIN,
    earlier_rate: round(earlier),
    recent_rate: round(recent),
    trend: classifyTrend(earlier, recent),
    latest_example: { original: latest?.original ?? '', correction: latest?.correction ?? '' },
  }
}

function categoriesOf(items: Counted[], windows: Windows | null): CategoryInsightOut[] {
  const seen = new Set(items.flatMap((item) => [...item.errors.keys()]))
  // Most frequent first, then by category code — the backend's order exactly.
  return [...seen]
    .map((category) => categoryInsight(category, items, windows))
    .sort((a, b) => b.occurrences - a.occurrences || (a.category < b.category ? -1 : 1))
}

const toPoint = (item: Counted): RatePointOut => ({
  entry_id: item.id,
  created_at: item.createdAt,
  word_count: item.words,
  error_count: errorsIn(item),
  rate: round(rate(errorsIn(item), item.words)),
})

const PHRASES: Record<Trend, string> = { improving: 'is improving', stable: 'is steady', worsening: 'is getting worse' }

function trendSentence(subject: string, trend: Trend | null, earlier: number | null, recent: number | null): string[] {
  if (trend === null || earlier === null || recent === null) return []
  return [`${subject} ${PHRASES[trend]} (${earlier.toFixed(1)} → ${recent.toFixed(1)} per 100 words).`]
}

function summarise(body: Body): string[] {
  if (body.status === 'insufficient_data') {
    return [`Insights start after ${MIN_ENTRIES} entries with feedback (${MIN_ENTRIES - body.entry_count} to go).`]
  }
  const perHundred = body.error_rate === null ? '' : `, ${body.error_rate.toFixed(1)} per 100 words`
  const moving = body.categories.filter((item) => item.trend !== 'stable')
  return [
    `${pluralize(body.total_errors, 'error')} across ${body.entry_count} entries${perHundred}.`,
    ...trendSentence('Overall, your error rate', body.trend, body.earlier_rate, body.recent_rate),
    ...moving.flatMap((item) => trendSentence(categoryLabel(item.category), item.trend, item.earlier_rate, item.recent_rate)),
    ...body.categories
      .filter((item) => item.recurring)
      .map((item) => `${categoryLabel(item.category)} keeps recurring: ${item.recent_entries} of your last ${body.recurring_window} entries.`),
    ...(body.status === 'totals_only' ? [`Trends start at ${MIN_ENTRIES_FOR_TRENDS} entries with feedback.`] : []),
  ]
}

export function computeInsights(analysed: AnalysedEntry[]): InsightsOut {
  const items = analysed.map(toCounted).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || (a.id < b.id ? -1 : 1))
  const status = statusOf(items.length)
  const windows = status === 'trends' ? splitWindows(items) : null
  const computed = status !== 'insufficient_data'
  const [earlier, recent] = windowRates(windows)
  const body: Body = {
    status,
    entry_count: items.length,
    total_words: sum(items.map((item) => item.words)),
    total_errors: sum(items.map((item) => errorsIn(item))),
    error_rate: computed ? round(pooled(items)) : null,
    earlier_rate: round(earlier),
    recent_rate: round(recent),
    trend: classifyTrend(earlier, recent),
    recurring_window: Math.min(items.length, RECURRING_WINDOW),
    points: computed ? items.map(toPoint) : [],
    categories: computed ? categoriesOf(items, windows) : [],
  }
  return { ...body, summary: summarise(body) }
}
