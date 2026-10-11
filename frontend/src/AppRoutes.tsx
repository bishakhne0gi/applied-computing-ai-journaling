import { Route, Routes } from 'react-router'
import { AppShell } from '@/features/shell/AppShell'
import { InsightsPage } from '@/pages/InsightsPage'
import { EntriesRedirect, EntryRedirect } from '@/pages/LegacyRedirects'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { WorkspacePage } from '@/pages/WorkspacePage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<WorkspacePage />} />
        <Route path="entries" element={<EntriesRedirect />} />
        <Route path="entries/:entryId" element={<EntryRedirect />} />
        <Route path="insights" element={<InsightsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
