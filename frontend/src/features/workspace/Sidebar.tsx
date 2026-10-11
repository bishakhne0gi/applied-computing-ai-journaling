import { useId } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { HistoryList } from '@/features/history/HistoryList'

export interface SidebarProps {
  onNewEntry: () => void
}

export function Sidebar({ onNewEntry }: SidebarProps) {
  const historyId = useId()
  return (
    <div className="flex flex-col gap-6">
      <Button variant="primary" onClick={onNewEntry}>
        <Icon name="plus" />
        New entry
      </Button>
      <section aria-labelledby={historyId} className="flex flex-col gap-4 border-t border-border pt-6">
        <h2 id={historyId} className="font-medium text-fg">
          History
        </h2>
        <HistoryList onStartWriting={onNewEntry} />
      </section>
    </div>
  )
}
