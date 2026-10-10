import { Link, NavLink, Outlet } from 'react-router'

// One list so a later phase adds a section (Insights) as one item.
const NAV_ITEMS = [
  { to: '/', label: 'Write', end: true },
  { to: '/entries', label: 'History', end: false },
] as const

const navLinkClass =
  'inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-muted hover:text-fg aria-[current=page]:bg-surface aria-[current=page]:text-fg'
const skipLinkClass =
  'sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-toast focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-contrast'

export function AppShell() {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <a href="#main" className={skipLinkClass}>
        Skip to content
      </a>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-2 px-4 py-2">
          <Link to="/" className="text-lg font-bold">
            Language Journal
          </Link>
          <nav aria-label="Main">
            <ul className="flex gap-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} end={item.end} className={navLinkClass}>
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-content px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
