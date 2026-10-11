import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { HistoryList } from '@/features/history/HistoryList'
import { ProgressCard } from './ProgressCard'

export interface SidebarProps {
  onNewEntry: () => void
  onOpenInsights: () => void
}

export function Sidebar({ onNewEntry, onOpenInsights }: SidebarProps) {
  return (
    <div className="flex flex-col gap-8">
      <Button variant="primary" onClick={onNewEntry}>
        <Icon name="plus" />
        New entry
      </Button>
      <HistoryList onStartWriting={onNewEntry} />
      <ProgressCard onOpenInsights={onOpenInsights} />
    </div>
  )
}
