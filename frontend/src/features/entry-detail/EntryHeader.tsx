import { TextLink } from '@/components/ui/TextLink'
import { useLanguageName } from '@/features/languages/useLanguageName'
import type { EntryOut } from '@/types/entry'
import { formatDateTime, pluralize } from '@/utils/formatter'

export interface EntryHeaderProps {
  entry: EntryOut
}

export function EntryHeader({ entry }: EntryHeaderProps) {
  const languageName = useLanguageName(entry.language)
  return (
    <div className="flex flex-col items-start gap-1">
      <p className="text-sm text-muted">
        {languageName} · {formatDateTime(entry.created_at)} · {pluralize(entry.word_count, 'word')}
      </p>
      <TextLink to="/entries">Back to history</TextLink>
    </div>
  )
}
