import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { clearMockMode, failWith, setMockMode, waitForLanguages, pickOption, slowDown } from '@/test/helpers'
import { renderWithProviders } from '@/test/renderWithProviders'
import { server } from '@/test/server'
import { ENDPOINTS } from '@/utils/endpoints'
import { InsightsScreen } from './InsightsScreen'

const renderInsights = (route = '/insights') => renderWithProviders(<InsightsScreen />, { route })
const chart = () => screen.findByRole('img', { name: /Errors per 100 words across/ })

describe('InsightsScreen', () => {
  it('shows a loading state, then the chart and categories for every language', async () => {
    // Arrange + Act
    slowDown('get', ENDPOINTS.insights)
    renderInsights()
    // Assert
    expect(screen.getByRole('status')).toHaveTextContent('Loading insights…')
    await waitFor(() => expect(screen.getByRole('status').querySelectorAll('[aria-hidden="true"]')).toHaveLength(2))
    expect(await screen.findByRole('img', { name: /across 11 entries/ })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Errors by category' })).toBeInTheDocument()
  })

  it('opens on the chart: there is no summary section', async () => {
    // Arrange
    renderInsights()
    // Act
    const image = await chart()
    // Assert
    expect(screen.queryByRole('heading', { name: 'Summary' })).not.toBeInTheDocument()
    const figure = image.closest('figure')
    expect(figure?.parentElement?.firstElementChild).toBe(figure)
  })

  it('narrows to one language from the filter', async () => {
    // Arrange
    const user = userEvent.setup()
    renderInsights()
    await waitForLanguages()
    // Act
    await pickOption(user, screen.getByLabelText('Filter by language'), 'Spanish')
    // Assert
    expect(await screen.findByRole('row', { name: /Verb conjugation/ })).toHaveTextContent('Recurring · 3 of last 5')
  })

  it('explains that trends need a fourth entry and that there is nothing to break down', async () => {
    // Arrange + Act
    renderInsights('/insights?language=fr')
    // Assert
    expect(await screen.findByText('Trends start at 4 entries with feedback.')).toBeInTheDocument()
    expect(screen.getByText('No errors in these entries, so nothing to work on yet.')).toBeInTheDocument()
  })

  it.each([
    ['fewer than three entries', '/insights?language=de', ''],
    ['no entries at all', '/insights', 'empty'],
  ])('shows an empty state with a way to write for %s', async (_label, route, mode) => {
    // Arrange
    if (mode) setMockMode(mode)
    // Act
    renderInsights(route)
    // Assert
    expect(await screen.findByText('Not enough entries yet')).toBeInTheDocument()
    expect(screen.getByText('Insights start after 3 entries with feedback (3 to go).')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Write an entry' })).toHaveAttribute('href', '/')
  })

  it('offers a retry when insights cannot load', async () => {
    // Arrange
    failWith('get', ENDPOINTS.insights)
    const user = userEvent.setup()
    renderInsights()
    expect(await screen.findByRole('alert')).toHaveTextContent(/on our side/)
    server.resetHandlers()
    // Act
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    // Assert
    expect(await chart()).toBeInTheDocument()
  })

  it('shows one alert and no results for a deep-linked language when the languages cannot load', async () => {
    // Arrange
    setMockMode('error')
    // Act
    renderInsights('/insights?language=xx')
    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(/on our side/)
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('makes no trend claims for three entries', async () => {
    // Arrange + Act
    renderInsights('/insights?language=fr')
    // Assert
    expect(await screen.findByText('Trends start at 4 entries with feedback.')).toBeInTheDocument()
    expect(screen.queryByText(/Improving|Getting worse|Stable/)).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: /Trend/ })).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: /across 3 entries/ })).not.toHaveAccessibleName(/Overall/)
  })

  it('shows a single retry when the languages cannot load either', async () => {
    // Arrange
    setMockMode('error')
    const user = userEvent.setup()
    renderInsights()
    expect(await screen.findByRole('alert')).toHaveTextContent(/on our side/)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    clearMockMode()
    // Act
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    // Assert
    expect(await chart()).toBeInTheDocument()
  })

  it('ignores a language code the server does not offer', async () => {
    // Arrange + Act
    renderInsights('/insights?language=xx')
    // Assert
    expect(await screen.findByRole('img', { name: /across 11 entries/ })).toBeInTheDocument()
  })
})
