import { useEffect, useId, useRef } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useEscapeKey } from '@/hooks/misc/useEscapeKey'
import type { MistakeOut } from '@/types/analysis'
import { Correction } from './Correction'
import { categoryLabel, KIND_LABELS } from './labels'

export interface MistakePanelProps {
  id: string
  mistake: MistakeOut
  onClose: () => void
}

export function MistakePanel({ id, mistake, onClose }: MistakePanelProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const titleId = useId()
  useEscapeKey(onClose)
  // Focus follows the learner into the panel so the explanation is read next.
  useEffect(() => headingRef.current?.focus(), [mistake.id])

  return (
    <section id={id} aria-labelledby={titleId} className="flex flex-col items-start gap-3 rounded-md border border-border bg-surface p-4">
      <h3 id={titleId} ref={headingRef} tabIndex={-1} className="text-lg font-semibold">
        <Correction original={mistake.original} correction={mistake.correction} />
      </h3>
      <div className="flex flex-wrap gap-2">
        <Badge>{categoryLabel(mistake.category)}</Badge>
        <Badge>{KIND_LABELS[mistake.kind]}</Badge>
      </div>
      <p className="text-sm">{mistake.explanation}</p>
      <Button onClick={onClose}>Close</Button>
    </section>
  )
}
