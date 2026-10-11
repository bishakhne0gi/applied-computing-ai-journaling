import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Tooltip } from '@/components/ui/Tooltip'
import type { VocabularyOut } from '@/types/assist'

export interface BetterWordsProps {
  items: readonly VocabularyOut[]
  // edit: alternatives replace the word; read: plain chips.
  mode: 'edit' | 'read'
  onUseWord?: (item: VocabularyOut, word: string) => void
}

export function BetterWords({ items, mode, onUseWord }: BetterWordsProps) {
  if (items.length === 0) return <p className="text-muted">This sentence already uses good words.</p>
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={`${item.start}-${item.original}`} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3">
          <span className="rounded-sm bg-primary-soft px-1.5">{item.original}</span>
          <Icon name="arrowRight" className="text-muted" />
          {item.alternatives.map(({ word, nuance }) => (
            <span key={word} className="inline-flex items-center">
              {mode === 'edit' ? (
                <Button variant="secondary" className="min-h-9 px-3" aria-label={`Use ${word} for ${item.original}`} onClick={() => onUseWord?.(item, word)}>
                  {word}
                </Button>
              ) : (
                <span className="rounded-full border border-border px-3 py-1 text-sm">{word}</span>
              )}
              <Tooltip content={nuance} size="hint" align="start">
                <span className="sr-only">{`How ${word} differs`}</span>
                <Icon name="info" className="size-4" />
              </Tooltip>
            </span>
          ))}
        </li>
      ))}
    </ul>
  )
}
