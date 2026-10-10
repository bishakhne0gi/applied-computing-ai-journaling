import { screen } from '@testing-library/react'
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
})
