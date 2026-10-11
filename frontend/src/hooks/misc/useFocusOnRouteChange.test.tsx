import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Navigate, Outlet, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { TextLink } from '@/components/ui/TextLink'
import { useFocusOnRouteChange } from './useFocusOnRouteChange'

// A layout route, like AppShell: one hook instance sees every pathname change, including a redirect's.
function Layout() {
  useFocusOnRouteChange()
  return (
    <main>
      <Outlet />
      <TextLink to="/other">Other</TextLink>
    </main>
  )
}

function renderAt(route: string) {
  render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<h1 tabIndex={-1}>Home</h1>} />
          <Route path="/other" element={<h1 tabIndex={-1}>Other page</h1>} />
          <Route path="/old" element={<Navigate replace to="/" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('useFocusOnRouteChange', () => {
  it('moves focus to the new heading when the user goes to another path', async () => {
    // Arrange
    const user = userEvent.setup()
    renderAt('/')
    // Act
    await user.click(screen.getByRole('link', { name: 'Other' }))
    // Assert
    expect(screen.getByRole('heading', { name: 'Other page' })).toHaveFocus()
  })

  it('leaves focus alone when a redirect replaces the path', async () => {
    // Arrange + Act
    renderAt('/old')
    // Assert
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument()
    expect(document.body).toHaveFocus()
  })
})
