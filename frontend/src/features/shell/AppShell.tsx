import { Outlet } from 'react-router'
import { useFocusOnRouteChange } from '@/hooks/misc/useFocusOnRouteChange'

const skipLinkClass =
  'sr-only focus:not-sr-only focus:fixed focus:top-17 focus:left-1/2 focus:z-toast focus:-translate-x-1/2 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-contrast'

// Each screen owns its <main id="main">: the workspace's main column sits beside a sidebar that is not main content.
export function AppShell() {
  useFocusOnRouteChange()
  return (
    <div className="min-h-screen bg-bg text-fg antialiased">
      <a href="#main" className={skipLinkClass}>
        Skip to content
      </a>
      <Outlet />
    </div>
  )
}
