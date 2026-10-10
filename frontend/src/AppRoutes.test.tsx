import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SEEDED } from '@/mocks/seed'
import { renderWithProviders } from '@/test/renderWithProviders'
import { AppRoutes } from './AppRoutes'

describe('routes', () => {
  it('opens Write at the root and marks it current in the navigation', () => {
    // Arrange
    const route = '/'
    // Act
    renderWithProviders(<AppRoutes />, { route })
    // Assert
    expect(screen.getByRole('heading', { level: 1, name: 'Write' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Write' })).toHaveAttribute('aria-current', 'page')
  })

  it('opens History at /entries', () => {
    // Arrange
    const route = '/entries'
    // Act
    renderWithProviders(<AppRoutes />, { route })
    // Assert
    expect(screen.getByRole('heading', { level: 1, name: 'History' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Write' })).not.toHaveAttribute('aria-current')
  })

  it('opens an entry at /entries/:entryId', () => {
    // Arrange
    const route = `/entries/${SEEDED.emoji}`
    // Act
    renderWithProviders(<AppRoutes />, { route })
    // Assert
    expect(screen.getByRole('heading', { level: 1, name: 'Entry' })).toBeInTheDocument()
  })

  it('opens Insights at /insights and marks it current in the navigation', () => {
    // Arrange
    const route = '/insights'
    // Act
    renderWithProviders(<AppRoutes />, { route })
    // Assert
    expect(screen.getByRole('heading', { level: 1, name: 'Insights' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Insights' })).toHaveAttribute('aria-current', 'page')
  })

  it('shows a not-found page with a way back for unknown paths', () => {
    // Arrange
    const route = '/nowhere'
    // Act
    renderWithProviders(<AppRoutes />, { route })
    // Assert
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to writing' })).toHaveAttribute('href', '/')
  })

  it('offers a skip link to the main content', () => {
    // Arrange
    const route = '/'
    // Act
    renderWithProviders(<AppRoutes />, { route })
    // Assert
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
  })

  it('leaves focus alone on first load', () => {
    // Arrange
    const route = '/entries'
    // Act
    renderWithProviders(<AppRoutes />, { route })
    // Assert
    expect(document.body).toHaveFocus()
  })

  it('moves focus to the new page heading when the route changes', async () => {
    // Arrange
    const user = userEvent.setup()
    renderWithProviders(<AppRoutes />, { route: '/' })
    // Act
    await user.click(screen.getByRole('link', { name: 'History' }))
    // Assert
    expect(await screen.findByRole('heading', { level: 1, name: 'History' })).toHaveFocus()
  })

  it('does not steal focus when only the query string changes', async () => {
    // Arrange
    const user = userEvent.setup()
    renderWithProviders(<AppRoutes />, { route: '/entries' })
    const filter = await screen.findByLabelText('Language')
    await screen.findByRole('option', { name: 'Spanish' })
    // Act
    await user.selectOptions(filter, 'es')
    // Assert
    expect(filter).toHaveFocus()
  })

  it.each([
    ['/', 'Write · Language Journal'],
    ['/entries', 'History · Language Journal'],
    [`/entries/${SEEDED.emoji}`, 'Entry · Language Journal'],
    ['/insights', 'Insights · Language Journal'],
    ['/nowhere', 'Page not found · Language Journal'],
  ])('titles the document for %s', async (route, title) => {
    // Arrange
    renderWithProviders(<AppRoutes />, { route })
    // Act
    await waitFor(() => expect(document.title).toBe(title))
    // Assert
    expect(document.title).toBe(title)
  })

  it('retitles the document when the route changes', async () => {
    // Arrange
    const user = userEvent.setup()
    renderWithProviders(<AppRoutes />, { route: '/' })
    // Act
    await user.click(screen.getByRole('link', { name: 'History' }))
    // Assert
    await waitFor(() => expect(document.title).toBe('History · Language Journal'))
  })
})
