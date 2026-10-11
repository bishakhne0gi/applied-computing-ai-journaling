import { Button } from '@/components/ui/Button'
import type { MistakeOut } from '@/types/analysis'
import { cn } from '@/utils/utils'
import { KIND_LABELS } from './labels'
import { markClasses } from './markClasses'
import { segmentText, type PlacedMistake } from './segmentText'

export interface AnnotatedTextProps {
  text: string
  placed: readonly PlacedMistake[]
  selectedId: string | null
  panelId: string
  onSelect: (mistake: MistakeOut, trigger: HTMLButtonElement) => void
}

export function AnnotatedText({ text, placed, selectedId, panelId, onSelect }: AnnotatedTextProps) {
  return (
    <p data-entry-text="" className="max-w-prose text-lg leading-loose whitespace-pre-wrap">
      {segmentText(text, placed).map(({ text: part, mistake }, index) => {
        if (!mistake) return <span key={`text-${index}`}>{part}</span>
        const selected = mistake.id === selectedId
        return (
          <Button
            key={mistake.id}
            variant="inline"
            className={cn(markClasses[mistake.kind], selected && 'outline-2 outline-primary')}
            aria-label={`${part} (${KIND_LABELS[mistake.kind].toLowerCase()})`}
            aria-expanded={selected}
            aria-controls={selected ? panelId : undefined}
            onClick={(event) => onSelect(mistake, event.currentTarget)}
          >
            {part}
          </Button>
        )
      })}
    </p>
  )
}
