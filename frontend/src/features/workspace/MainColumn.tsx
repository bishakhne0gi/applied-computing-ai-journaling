import { EntryDetail } from '@/features/entry-detail/EntryDetail'
import { Composer } from './Composer'

export interface MainColumnProps {
  entryId: string | null
  composerKey: number
  moved: boolean
}

// The composer unmounts while an entry is open; its draft lives in localStorage (useDraft), so nothing typed is lost.
export function MainColumn({ entryId, composerKey, moved }: MainColumnProps) {
  if (entryId) return <EntryDetail key={entryId} entryId={entryId} focusHeading={moved} />
  return <Composer key={composerKey} focusEditor={moved} />
}
