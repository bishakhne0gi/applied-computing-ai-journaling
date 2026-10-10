import { useParams } from 'react-router'
import { EntryDetail } from '@/features/entry-detail/EntryDetail'

export function EntryDetailPage() {
  const { entryId = '' } = useParams()
  return (
    <div className="flex flex-col gap-6">
      <title>Entry · Language Journal</title>
      <h1 className="text-2xl font-bold">Entry</h1>
      <EntryDetail key={entryId} entryId={entryId} />
    </div>
  )
}
