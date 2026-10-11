import { useState } from 'react'

// The sheet belongs to the moment it was opened in (entry | composer key | insights | layout): any navigation closes it,
// and the stored moment is reset so Back to that moment does not reopen it.
export function useEntriesSheet(moment: string) {
  const [sheet, setSheet] = useState({ moment, open: false })
  if (sheet.moment !== moment) setSheet({ moment, open: false })
  return {
    open: sheet.open && sheet.moment === moment,
    show: () => setSheet({ moment, open: true }),
    hide: () => setSheet({ moment, open: false }),
  }
}
