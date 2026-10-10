import { useParams } from 'react-router'
import { PageHeading } from '@/components/ui/PageHeading'
import { EntryDetail } from '@/features/entry-detail/EntryDetail'

export function EntryDetailPage() {
  const { entryId = '' } = useParams()
  return (
    <div className="flex flex-col gap-6">
      <title>Entry · Language Journal</title>
      <PageHeading>Entry</PageHeading>
      <EntryDetail key={entryId} entryId={entryId} />
    </div>
  )
}
