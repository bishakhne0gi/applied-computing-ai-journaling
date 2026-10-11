import type { AnalysisOut, Category, MistakeKind, MistakeOut } from '@/types/analysis'
import { pluralize } from '@/utils/formatter'
import { codePointLength } from '@/utils/text'
import { buildAnalysis, buildMistake } from './factories'

interface Rule {
  pattern: RegExp
  correct: (found: string) => string
  kind: MistakeKind
  category: Category
  explanation: string
}

interface Hit {
  index: number
  original: string
  correction: string
  rule: Rule
}

// `\b` is ASCII-only in JS, so word edges are letter lookarounds that also respect «à» or «é».
const phrase = (words: string) => new RegExp(`(?<!\\p{L})${words}(?!\\p{L})`, 'giu')
const always = (value: string) => () => value

const GLOSSARY: Record<string, string> = { park: 'parque', pie: 'tarte', paella: 'paella', 'grocery store': 'supermercado' }
const bracketed = (found: string) => found.slice(1, -1)

// The same demo rules as the backend's fake provider, plus a suggestion and a small glossary.
const RULES: Rule[] = [
  { pattern: phrase('yo es'), correct: always('yo soy'), kind: 'error', category: 'verb_conjugation', explanation: 'With «yo», «ser» is conjugated «soy».' },
  { pattern: phrase('la problema'), correct: always('el problema'), kind: 'error', category: 'gender_agreement', explanation: '«Problema» is masculine even though it ends in -a.' },
  { pattern: phrase('a el'), correct: always('al'), kind: 'error', category: 'article', explanation: '«A» + «el» always contracts to «al».' },
  { pattern: phrase('à le'), correct: always('au'), kind: 'error', category: 'article', explanation: '«À» + «le» always contracts to «au».' },
  { pattern: phrase('muy bueno'), correct: always('estupendo'), kind: 'suggestion', category: 'vocabulary', explanation: '«Estupendo» sounds more natural than «muy bueno» here.' },
  {
    pattern: /\[([^[\]]+)\]/gu,
    correct: (found) => GLOSSARY[bracketed(found).toLowerCase()] ?? bracketed(found),
    kind: 'vocab_help',
    category: 'vocabulary',
    explanation: 'Here is the word you were looking for.',
  },
]

function findHits(text: string): Hit[] {
  const hits = RULES.flatMap((rule) =>
    Array.from(text.matchAll(rule.pattern), (match) => ({
      index: match.index,
      original: match[0],
      correction: rule.correct(match[0]),
      rule,
    })),
  )
  return withoutOverlaps(hits.sort((a, b) => a.index - b.index))
}

function withoutOverlaps(sorted: Hit[]): Hit[] {
  const kept: Hit[] = []
  let end = 0
  for (const hit of sorted) {
    if (hit.index < end) continue
    kept.push(hit)
    end = hit.index + hit.original.length
  }
  return kept
}

function toMistake(text: string, hit: Hit): MistakeOut {
  const start = codePointLength(text.slice(0, hit.index))
  const { kind, category, explanation } = hit.rule
  return buildMistake({ kind, category, explanation, original: hit.original, correction: hit.correction, start, end: start + codePointLength(hit.original) })
}

function applyFixes(text: string, hits: Hit[]): string {
  let corrected = ''
  let from = 0
  for (const hit of hits) {
    corrected += text.slice(from, hit.index) + hit.correction
    from = hit.index + hit.original.length
  }
  return corrected + text.slice(from)
}

function summarise(count: number): string {
  return count === 0 ? 'Great job, no mistakes found!' : `Good effort! ${pluralize(count, 'thing')} to look at.`
}

export function analyzeText(entryId: string, text: string, createdAt = new Date().toISOString()): AnalysisOut {
  const hits = findHits(text)
  return buildAnalysis({
    entry_id: entryId,
    input_text: text,
    corrected_text: applyFixes(text, hits),
    feedback_summary: summarise(hits.length),
    created_at: createdAt,
    completed_at: createdAt,
    mistakes: hits.map((hit) => toMistake(text, hit)),
  })
}

export function failedAnalysis(entryId: string, text: string, createdAt = new Date().toISOString()): AnalysisOut {
  return buildAnalysis({
    entry_id: entryId,
    status: 'failed',
    input_text: text,
    corrected_text: null,
    feedback_summary: null,
    model: null,
    error_code: 'provider_timeout',
    created_at: createdAt,
    completed_at: createdAt,
    mistakes: [],
  })
}

// What an analysis looks like when the client went away mid-call and nothing ever finished it.
export function pendingAnalysis(entryId: string, text: string, createdAt = new Date().toISOString()): AnalysisOut {
  return buildAnalysis({
    entry_id: entryId,
    status: 'pending',
    input_text: text,
    corrected_text: null,
    feedback_summary: null,
    model: null,
    latency_ms: null,
    created_at: createdAt,
    completed_at: null,
    mistakes: [],
  })
}
