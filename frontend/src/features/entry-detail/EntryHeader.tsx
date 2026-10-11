import { useLanguageName } from '@/features/languages/useLanguageName'
import type { EntryOut } from '@/types/entry'
import { formatTime, pluralize } from '@/utils/formatter'

export interface EntryHeaderProps {
  entry: EntryOut
}

export function EntryHeader({ entry }: EntryHeaderProps) {
  const languageName = useLanguageName(entry.language)
  return (
    <p className="text-sm text-muted">
      {languageName} · {formatTime(entry.created_at)} · {pluralize(entry.word_count, 'word')}
    </p>
  )
}
