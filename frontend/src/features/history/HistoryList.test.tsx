import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { apiUrl, clearMockMode, failWith, setMockMode, waitForLanguages, pickOption, slowDown } from '@/test/helpers'
import { renderWithProviders } from '@/test/renderWithProviders'
import { server } from '@/test/server'
import { ENDPOINTS } from '@/utils/endpoints'
import { HistoryList } from './HistoryList'

const renderHistory = (onStartWriting = vi.fn()) => renderWithProviders(<HistoryList onStartWriting={onStartWriting} />, { route: '/' })
const rows = () => within(screen.getByRole('list', { name: 'Entries' })).getAllByRole('listitem')

describe('HistoryList', () => {
  it('shows a loading state, then the newest ten entries', async () => {
    // Arrange + Act
    slowDown('get', ENDPOINTS.entries)
    renderHistory()
    // Assert
    expect(screen.getByRole('status')).toHaveTextContent('Loading entries…')
    await waitFor(() => expect(screen.getByRole('status').querySelectorAll('[aria-hidden="true"]')).toHaveLength(4))
    expect(await screen.findByText('Showing 10 entries')).toBeInTheDocument()
    expect(rows()).toHaveLength(10)
  })

  it('heads the list with the number of loaded entries, marked + while more pages exist', async () => {
    // Arrange
    const user = userEvent.setup()
    renderHistory()
    const section = await screen.findByRole('region', { name: 'History' })
    expect(await within(section).findByText('10+')).toBeInTheDocument()
    // Act
    await user.click(screen.getByRole('button', { name: 'Load more' }))
    // Assert
    expect(await within(section).findByText('14')).toBeInTheDocument()
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
    await pickOption(user, screen.getByLabelText('Filter by language'), 'French')
    // Assert
    expect(await screen.findByText('Showing 4 entries')).toBeInTheDocument()
    expect(rows().every((row) => row.textContent?.includes('French'))).toBe(true)
  })

  it('shows an empty state whose action starts a new entry', async () => {
    // Arrange
    setMockMode('empty')
    const onStartWriting = vi.fn()
    const user = userEvent.setup()
    renderHistory(onStartWriting)
    // Act
    await user.click(await screen.findByRole('button', { name: 'Write your first entry' }))
    // Assert
    expect(screen.getByText('No entries yet')).toBeInTheDocument()
    expect(onStartWriting).toHaveBeenCalledTimes(1)
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

  it('shows a single retry when the languages cannot load either', async () => {
    // Arrange
    setMockMode('error')
    const user = userEvent.setup()
    renderHistory()
    expect(await screen.findByRole('alert')).toHaveTextContent(/on our side/)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    clearMockMode()
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
