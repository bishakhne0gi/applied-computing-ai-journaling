import type { MistakeKind, MistakeOut } from '@/types/analysis'
import { KIND_LABELS } from './labels'
import { markClasses } from './markClasses'

const KINDS: MistakeKind[] = ['error', 'suggestion', 'vocab_help']

export interface LegendProps {
  mistakes: readonly MistakeOut[]
}

export function Legend({ mistakes }: LegendProps) {
  return (
    <ul aria-label="Feedback legend" className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
      {KINDS.map((kind) => (
        <li key={kind} className="flex items-center gap-1">
          <span className={markClasses[kind]}>{KIND_LABELS[kind]}</span>{' '}
          <span className="font-semibold">{mistakes.filter((mistake) => mistake.kind === kind).length}</span>
        </li>
      ))}
    </ul>
  )
}
