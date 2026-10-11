import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { apiUrl, failWith } from '@/test/helpers'
import { renderWithProviders } from '@/test/renderWithProviders'
import { server } from '@/test/server'
import { ENDPOINTS } from '@/utils/endpoints'
import { ProgressCard } from './ProgressCard'

const renderCard = (route = '/', onOpenInsights = vi.fn()) => {
  renderWithProviders(<ProgressCard onOpenInsights={onOpenInsights} />, { route })
  return userEvent.setup()
}

const insightsBody = (overrides: object) => ({
  status: 'trends',
  entry_count: 12,
  total_words: 600,
  total_errors: 30,
  error_rate: 5,
  earlier_rate: 5,
  recent_rate: 5,
  trend: 'stable',
  recurring_window: 5,
  points: [],
  categories: [],
  summary: [],
  ...overrides,
})
const serveInsights = (overrides: object) => server.use(http.get(apiUrl(ENDPOINTS.insights), () => HttpResponse.json(insightsBody(overrides))))

describe('ProgressCard', () => {
  it('is a region named Progress', () => {
    // Arrange + Act
    renderCard()
    // Assert
    expect(screen.getByRole('region', { name: 'Progress' })).toBeInTheDocument()
  })

  it('draws the latest ten of twelve entries, newest last', async () => {
    // Arrange
    const points = Array.from({ length: 12 }, (_, n) => ({ entry_id: `e${n}`, created_at: '2026-10-01T00:00:00Z', word_count: 50, error_count: n, rate: n }))
    serveInsights({ points })
    // Act
    renderCard()
    // Assert
    expect(await screen.findByRole('img', { name: /across 10 entries.*lowest 2\.0, highest 11\.0, latest 11\.0/ })).toBeInTheDocument()
  })

  it('counts down at least one entry even when the API has totals only for four or more', async () => {
    // Arrange
    serveInsights({ status: 'totals_only', entry_count: 5 })
    // Act
    renderCard()
    // Assert
    expect(await screen.findByText('1 more entry to see trends')).toBeInTheDocument()
  })

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
