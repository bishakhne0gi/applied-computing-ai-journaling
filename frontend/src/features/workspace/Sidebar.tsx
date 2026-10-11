import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { HistoryList } from '@/features/history/HistoryList'

export interface SidebarProps {
  onNewEntry: () => void
}

export function Sidebar({ onNewEntry }: SidebarProps) {
  return (
    <div className="flex flex-col gap-8">
      <Button variant="primary" onClick={onNewEntry}>
        <Icon name="plus" />
        New entry
      </Button>
      <HistoryList onStartWriting={onNewEntry} />
    </div>
  )
}
