import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { apiUrl, failWith, setMockMode, waitForLanguages } from '@/test/helpers'
import { renderWithProviders } from '@/test/renderWithProviders'
import { server } from '@/test/server'
import { ENDPOINTS } from '@/utils/endpoints'
import { HistoryList } from './HistoryList'

const renderHistory = () => renderWithProviders(<HistoryList />, { route: '/entries' })
const rows = () => within(screen.getByRole('list', { name: 'Entries' })).getAllByRole('listitem')

describe('HistoryList', () => {
  it('shows a loading state, then the newest ten entries', async () => {
    // Arrange + Act
    renderHistory()
    // Assert
    expect(screen.getByRole('status')).toHaveTextContent('Loading entries…')
    expect(await screen.findByText('Showing 10 entries')).toBeInTheDocument()
    expect(rows()).toHaveLength(10)
  })

  it('loads the next page with "Load more" until none are left', async () => {
    // Arrange
    const user = userEvent.setup()
    renderHistory()
    await screen.findByText('Showing 10 entries')
    // Act
    await user.click(screen.getByRole('button', { name: 'Load more' }))
    // Assert
    expect(await screen.findByText('Showing 14 entries')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('filters by language', async () => {
    // Arrange
    const user = userEvent.setup()
    renderHistory()
    await waitForLanguages()
    // Act
    await user.selectOptions(screen.getByLabelText('Language'), 'fr')
    // Assert
    expect(await screen.findByText('Showing 4 entries')).toBeInTheDocument()
    expect(rows().every((row) => row.textContent?.includes('French'))).toBe(true)
  })

  it('shows an empty state with a way to start writing', async () => {
    // Arrange
    setMockMode('empty')
    // Act
    renderHistory()
    // Assert
    expect(await screen.findByText('No entries yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Write your first entry' })).toHaveAttribute('href', '/')
  })

  it('offers a retry when the list cannot load', async () => {
    // Arrange
    failWith('get', ENDPOINTS.entries)
    const user = userEvent.setup()
    renderHistory()
    expect(await screen.findByRole('alert')).toHaveTextContent(/on our side/)
    server.resetHandlers()
    // Act
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    // Assert
    expect(await screen.findByText('Showing 10 entries')).toBeInTheDocument()
  })

  it('keeps the loaded entries and explains when the next page fails', async () => {
    // Arrange
    server.use(
      http.get(apiUrl(ENDPOINTS.entries), ({ request }) =>
        new URL(request.url).searchParams.has('cursor') ? HttpResponse.json({ status: 500 }, { status: 500 }) : undefined,
      ),
    )
    const user = userEvent.setup()
    renderHistory()
    await screen.findByText('Showing 10 entries')
    // Act
    await user.click(screen.getByRole('button', { name: 'Load more' }))
    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(/on our side/)
    expect(rows()).toHaveLength(10)
  })
})
