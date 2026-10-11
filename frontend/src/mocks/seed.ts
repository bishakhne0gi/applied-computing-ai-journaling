import type { AnalysisOut } from '@/types/analysis'
import type { EntryOut } from '@/types/entry'
import { countWords } from '@/utils/text'
import { analyzeText, failedAnalysis, pendingAnalysis } from './analyzer'
import { buildMistake } from './factories'

export interface Store {
  entries: EntryOut[]
  analyses: AnalysisOut[]
}

// Real UUIDs, because the backend rejects any other entry id with a 422.
const seedId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

// Fixed ids so tests, e2e and ui-qa can open specific demo entries.
export const SEEDED = {
  revisedFrench: seedId(1),
  emoji: seedId(2),
  failed: seedId(3),
  unanalysed: seedId(4),
  otherNotes: seedId(5),
  interrupted: seedId(6),
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
  { id: SEEDED.interrupted, language: 'fr', text: 'Hier, je suis allé à le parc.' },
  { id: seedId(7), language: 'fr', text: 'J’aime lire le soir.' },
  { id: seedId(8), language: 'fr', text: 'Nous avons mangé une [pie] délicieuse.' },
  { id: seedId(9), language: 'es', text: 'Ayer yo es feliz en el [park].' },
  { id: seedId(10), language: 'es', text: 'Fui a el mercado por la mañana.' },
  { id: seedId(11), language: 'es', text: 'Mi casa es pequeña pero bonita.' },
  { id: seedId(12), language: 'es', text: 'Creo que la problema es el motor.' },
  { id: seedId(13), language: 'es', text: 'Quiero aprender a cocinar [paella] este año.' },
  { id: seedId(14), language: 'es', text: 'El tren llegó tarde otra vez.' },
]

function toEntry(sample: Sample, createdAt: string): EntryOut {
  return { ...sample, word_count: countWords(sample.text), created_at: createdAt, updated_at: createdAt }
}

// The learner fixed «à le» and re-checked: the older analysis keeps the text it was run on.
function revisedHistory(entry: EntryOut): AnalysisOut[] {
  const revisedAt = new Date(Date.parse(entry.created_at) + HOUR / 2).toISOString()
  return [
    analyzeText(entry.id, 'Je suis allé à le marché avec ma sœur.', entry.created_at, entry.language),
    analyzeText(entry.id, entry.text, revisedAt, entry.language),
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
    case SEEDED.interrupted:
      return [pendingAnalysis(entry.id, entry.text, entry.created_at)]
    case SEEDED.revisedFrench:
      return revisedHistory(entry)
    case SEEDED.otherNotes:
      return [withUnplacedNote(analyzeText(entry.id, entry.text, entry.created_at, entry.language))]
    default:
      return [analyzeText(entry.id, entry.text, entry.created_at, entry.language)]
  }
}

export function seedStore(): Store {
  const entries = SAMPLES.map((sample, index) => toEntry(sample, hoursBefore(index * 5)))
  return { entries, analyses: entries.flatMap(historyFor) }
}
