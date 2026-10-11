import { Tooltip, type TooltipAlign } from '@/components/ui/Tooltip'
import type { MistakeKind, MistakeOut } from '@/types/analysis'
import { KIND_HINTS, KIND_LABELS } from './labels'
import { markClasses } from './markClasses'

const KINDS: MistakeKind[] = ['error', 'suggestion', 'vocab_help']
// The first chip's tip opens rightwards and the last leftwards, so none overflows a 375px screen.
const ALIGN: Record<MistakeKind, TooltipAlign> = { error: 'start', suggestion: 'center', vocab_help: 'end' }

export interface LegendProps {
  mistakes: readonly MistakeOut[]
}

export function Legend({ mistakes }: LegendProps) {
  return (
    <ul aria-label="Feedback legend" className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
      {KINDS.map((kind) => (
        <li key={kind} className="flex items-center gap-1">
          <Tooltip content={KIND_HINTS[kind]} align={ALIGN[kind]}>
            <span className={markClasses[kind]}>{KIND_LABELS[kind]}</span>
          </Tooltip>{' '}
          <span className="font-semibold tabular-nums">{mistakes.filter((mistake) => mistake.kind === kind).length}</span>
        </li>
      ))}
    </ul>
  )
}
