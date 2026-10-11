import { Tooltip } from '@/components/ui/Tooltip'
import type { MistakeKind, MistakeOut } from '@/types/analysis'
import { KIND_HINTS, KIND_LABELS } from './labels'
import { markClasses } from './markClasses'

const KINDS: MistakeKind[] = ['error', 'suggestion', 'vocab_help']

export interface LegendProps {
  mistakes: readonly MistakeOut[]
}

// The chips are plain labels (label and count read together); one toggletip explains all three, so the legend costs a
// single tab stop and also works on touch.
export function Legend({ mistakes }: LegendProps) {
  const explanation = KINDS.map((kind) => (
    <span key={kind} className="block py-0.5">
      <span className="font-semibold">{KIND_LABELS[kind]}</span> {KIND_HINTS[kind]}
    </span>
  ))
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <ul aria-label="Feedback legend" className="flex flex-wrap gap-x-4 gap-y-1">
        {KINDS.map((kind) => (
          <li key={kind}>
            <span className={markClasses[kind]}>{KIND_LABELS[kind]}</span>{' '}
            <span className="font-semibold tabular-nums">{mistakes.filter((mistake) => mistake.kind === kind).length}</span>
          </li>
        ))}
      </ul>
      <Tooltip content={explanation} align="start">
        <span className="text-muted underline decoration-dotted underline-offset-4">What do these mean?</span>
      </Tooltip>
    </div>
  )
}
