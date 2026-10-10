import type { AnalysisOut } from '@/types/analysis'
import type { EntryOut } from '@/types/entry'
import { countWords } from '@/utils/text'
import { analyzeText, failedAnalysis } from './analyzer'
import { buildMistake } from './factories'

export interface Store {
  entries: EntryOut[]
  analyses: AnalysisOut[]
}

// Fixed ids so tests, e2e and ui-qa can open specific demo entries.
export const SEEDED = {
  revisedFrench: 'entry-fr-revised',
  emoji: 'entry-es-emoji',
  failed: 'entry-es-failed',
  unanalysed: 'entry-es-unanalysed',
  otherNotes: 'entry-es-notes',
} as const

interface Sample {
  id: string
  language: string
  text: string
}

const NEWEST = Date.parse('2026-10-09T18:00:00Z')
const HOUR = 3_600_000
const hoursBefore = (hours: number) => new Date(NEWEST - hours * HOUR).toISOString()

// Newest first: the first ten fill page one of History, the last four need "Load more".
const SAMPLES: Sample[] = [
  { id: SEEDED.revisedFrench, language: 'fr', text: 'Je suis allé au marché avec ma sœur.' },
  { id: SEEDED.emoji, language: 'es', text: 'Hoy 😀 la problema fue difícil, pero yo es optimista.' },
  { id: SEEDED.failed, language: 'es', text: 'Mañana voy a el cine con mis amigos.' },
  { id: SEEDED.unanalysed, language: 'es', text: 'Escribo esto antes de dormir.' },
  { id: SEEDED.otherNotes, language: 'es', text: 'El fin de semana fue muy bueno y yo es feliz.' },
  { id: 'entry-fr-park', language: 'fr', text: 'Hier, je suis allé à le parc.' },
  { id: 'entry-fr-books', language: 'fr', text: 'J’aime lire le soir.' },
  { id: 'entry-fr-pie', language: 'fr', text: 'Nous avons mangé une [pie] délicieuse.' },
  { id: 'entry-es-park', language: 'es', text: 'Ayer yo es feliz en el [park].' },
  { id: 'entry-es-market', language: 'es', text: 'Fui a el mercado por la mañana.' },
  { id: 'entry-es-house', language: 'es', text: 'Mi casa es pequeña pero bonita.' },
  { id: 'entry-es-car', language: 'es', text: 'Creo que la problema es el motor.' },
  { id: 'entry-es-paella', language: 'es', text: 'Quiero aprender a cocinar [paella] este año.' },
  { id: 'entry-es-train', language: 'es', text: 'El tren llegó tarde otra vez.' },
]

function toEntry(sample: Sample, createdAt: string): EntryOut {
  return { ...sample, word_count: countWords(sample.text), created_at: createdAt, updated_at: createdAt }
}

// The learner fixed «à le» and re-checked: the older analysis keeps the text it was run on.
function revisedHistory(entry: EntryOut): AnalysisOut[] {
  const revisedAt = new Date(Date.parse(entry.created_at) + HOUR / 2).toISOString()
  return [
    analyzeText(entry.id, 'Je suis allé à le marché avec ma sœur.', entry.created_at),
    analyzeText(entry.id, entry.text, revisedAt),
  ]
}

// The aligner leaves offsets null when a snippet overlaps other highlights; the UI lists it under "Other notes".
function withUnplacedNote(analysis: AnalysisOut): AnalysisOut {
  const note = buildMistake({
    kind: 'suggestion',
    category: 'other',
    original: 'muy bueno y yo es',
    correction: 'estupendo y yo soy',
    explanation: 'Both fixes together read: «fue estupendo y yo soy feliz».',
    start: null,
    end: null,
  })
  return { ...analysis, mistakes: [...analysis.mistakes, note] }
}

function historyFor(entry: EntryOut): AnalysisOut[] {
  switch (entry.id) {
    case SEEDED.unanalysed:
      return []
    case SEEDED.failed:
      return [failedAnalysis(entry.id, entry.text, entry.created_at)]
    case SEEDED.revisedFrench:
      return revisedHistory(entry)
    case SEEDED.otherNotes:
      return [withUnplacedNote(analyzeText(entry.id, entry.text, entry.created_at))]
    default:
      return [analyzeText(entry.id, entry.text, entry.created_at)]
  }
}

export function seedStore(): Store {
  const entries = SAMPLES.map((sample, index) => toEntry(sample, hoursBefore(index * 5)))
  return { entries, analyses: entries.flatMap(historyFor) }
}
