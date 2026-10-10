import { PageHeading } from '@/components/ui/PageHeading'
import { HistoryList } from '@/features/history/HistoryList'

export function HistoryPage() {
  return (
    <div className="flex flex-col gap-6">
      <title>History · Language Journal</title>
      <div className="flex flex-col gap-1">
        <PageHeading>History</PageHeading>
        <p className="text-muted">Every entry you have written, newest first.</p>
      </div>
      <HistoryList />
    </div>
  )
}
