import { useParams } from 'react-router'
import { EntryDetail } from '@/features/entry-detail/EntryDetail'

export function EntryDetailPage() {
  const { entryId = '' } = useParams()
  return <EntryDetail key={entryId} entryId={entryId} />
}
