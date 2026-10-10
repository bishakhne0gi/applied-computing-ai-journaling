import { useId } from 'react'
import type { MistakeOut } from '@/types/analysis'
import { Correction } from './Correction'
import { categoryLabel, KIND_LABELS } from './labels'

export interface OtherNotesProps {
  mistakes: readonly MistakeOut[]
}

export function OtherNotes({ mistakes }: OtherNotesProps) {
  const headingId = useId()
  if (mistakes.length === 0) return null
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 id={headingId} className="text-base font-semibold">
        Other notes
      </h3>
      <ul className="flex flex-col gap-2">
        {mistakes.map((mistake) => (
          <li key={mistake.id} className="flex flex-col gap-1 rounded-md border border-border p-3 text-sm">
            <p>
              <Correction original={mistake.original} correction={mistake.correction} />
            </p>
            <p className="text-muted">
              {KIND_LABELS[mistake.kind]} · {categoryLabel(mistake.category)} · {mistake.explanation}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
