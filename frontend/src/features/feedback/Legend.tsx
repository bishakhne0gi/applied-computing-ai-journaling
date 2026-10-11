import { Icon } from '@/components/ui/Icon'
import { Tooltip } from '@/components/ui/Tooltip'
import type { MistakeKind, MistakeOut } from '@/types/analysis'
import { KIND_HINTS, KIND_LABELS } from './labels'
import { markClasses } from './markClasses'

const KINDS: MistakeKind[] = ['error', 'suggestion', 'vocab_help']

export interface LegendProps {
  mistakes: readonly MistakeOut[]
}

// The chips are plain labels (label and count read together); one toggletip explains all three, so the legend costs a
// single tab stop and also works on touch. It opens below, where it covers the text it explains rather than the page.
export function Legend({ mistakes }: LegendProps) {
  const explanation = (
    <span className="flex flex-col gap-3">
      {KINDS.map((kind) => (
        <span key={kind} className="flex items-baseline gap-3">
          <span className="w-24 shrink-0">
            <span className={markClasses[kind]}>{KIND_LABELS[kind]}</span>
          </span>
          <span className="text-fg-secondary">{KIND_HINTS[kind]}</span>
        </span>
      ))}
      <span className="border-t border-border pt-3 text-muted">Only errors count towards your error rate.</span>
    </span>
  )
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
      <Tooltip content={explanation} align="start" placement="bottom" size="card">
        <span className="inline-flex items-center gap-1.5 font-medium text-primary hover:text-primary-pressed hover:underline hover:underline-offset-4">
          <Icon name="info" className="size-4" />
          What do these mean?
        </span>
      </Tooltip>
    </div>
  )
}
