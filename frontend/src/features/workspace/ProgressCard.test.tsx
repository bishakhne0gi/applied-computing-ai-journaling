import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { failWith } from '@/test/helpers'
import { renderWithProviders } from '@/test/renderWithProviders'
import { server } from '@/test/server'
import { ENDPOINTS } from '@/utils/endpoints'
import { ProgressCard } from './ProgressCard'

const renderCard = (route = '/', onOpenInsights = vi.fn()) => {
  renderWithProviders(<ProgressCard onOpenInsights={onOpenInsights} />, { route })
  return userEvent.setup()
}

describe('ProgressCard', () => {
  it('shows a loading state, then a sparkline of the latest ten rates with the overall trend', async () => {
    // Arrange + Act
    renderCard()
    // Assert
    expect(screen.getByRole('status')).toHaveTextContent('Loading progress…')
    expect(await screen.findByRole('img', { name: /across 10 entries.*Overall: steady/ })).toBeInTheDocument()
    expect(screen.getByText(/Steady/)).toBeInTheDocument()
    expect(screen.getByText('7.6 per 100 words')).toBeInTheDocument()
  })

  it.each([
    ['/?language=fr', '1 more entry to see trends'],
    ['/?language=de', '4 more entries to see trends'],
  ])('counts down to trends for %s', async (route, message) => {
    // Arrange + Act
    renderCard(route)
    // Assert
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('opens insights from its button', async () => {
    // Arrange
    const onOpenInsights = vi.fn()
    const user = renderCard('/', onOpenInsights)
    // Act
    await user.click(screen.getByRole('button', { name: 'Open insights' }))
    // Assert
    expect(onOpenInsights).toHaveBeenCalledTimes(1)
  })

  it('offers a retry when progress cannot load', async () => {
    // Arrange
    failWith('get', ENDPOINTS.insights)
    const user = renderCard()
    expect(await screen.findByRole('alert')).toHaveTextContent(/on our side/)
    server.resetHandlers()
    // Act
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    // Assert
    expect(await screen.findByRole('img', { name: /across 10 entries/ })).toBeInTheDocument()
  })
})
