import { Route, Routes } from 'react-router'
import { AppShell } from '@/features/shell/AppShell'
import { EntryDetailPage } from '@/pages/EntryDetailPage'
import { HistoryPage } from '@/pages/HistoryPage'
import { InsightsPage } from '@/pages/InsightsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { WritePage } from '@/pages/WritePage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<WritePage />} />
        <Route path="entries" element={<HistoryPage />} />
        <Route path="entries/:entryId" element={<EntryDetailPage />} />
        <Route path="insights" element={<InsightsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
