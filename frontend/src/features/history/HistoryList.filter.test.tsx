import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { apiUrl, waitForLanguages, pickOption } from '@/test/helpers'
import { renderWithProviders } from '@/test/renderWithProviders'
import { server } from '@/test/server'
import { ENDPOINTS } from '@/utils/endpoints'
import { HistoryList } from './HistoryList'

// Exposes router state, which the list only changes through the URL.
function Probe() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <output aria-label="Search">{location.search}</output>
      <Button onClick={() => void navigate(-1)}>Go back</Button>
    </>
  )
}

const renderAt = (route: string) =>
  renderWithProviders(
    <>
      <HistoryList onStartWriting={vi.fn()} />
      <Probe />
    </>,
    { route },
  )
const rows = () => within(screen.getByRole('list', { name: 'Entries' })).getAllByRole('listitem')
const search = () => screen.getByLabelText('Search').textContent

describe('HistoryList language filter', () => {
  it('opens a deep link already filtered, with the select showing it', async () => {
    // Arrange + Act
    renderAt('/?language=fr')
    // Assert
    expect(await screen.findByText('Showing 4 entries')).toBeInTheDocument()
    expect(screen.getByLabelText('Filter by language')).toHaveTextContent('French')
  })

  it.each([
    ['an unknown code', '?language=xx'],
    ['an empty code', '?language='],
  ])('treats %s as unfiltered and drops it from the URL', async (_label, query) => {
    // Arrange + Act
    renderAt(`/${query}`)
    // Assert
    expect(await screen.findByText('Showing 10 entries')).toBeInTheDocument()
    expect(screen.getByLabelText('Filter by language')).toHaveTextContent('All languages')
    expect(search()).toBe('')
  })

  it('never fetches the list with a language the server does not offer', async () => {
    // Arrange
    const seen: (string | null)[] = []
    server.use(
      http.get(apiUrl(ENDPOINTS.entries), ({ request }) => {
        seen.push(new URL(request.url).searchParams.get('language'))
      }),
    )
    // Act
    renderAt('/?language=xx')
    await screen.findByText('Showing 10 entries')
    // Assert
    expect(seen).toEqual([null])
  })

  it('writes the chosen language to the URL and clears it for "All languages"', async () => {
    // Arrange
    const user = userEvent.setup()
    renderAt('/')
    await waitForLanguages()
    // Act
    await pickOption(user, screen.getByLabelText('Filter by language'), 'French')
    // Assert
    expect(search()).toBe('?language=fr')
    await pickOption(user, screen.getByLabelText('Filter by language'), 'All languages')
    expect(search()).toBe('')
  })

  it('restores the previous filter on Back', async () => {
    // Arrange
    const user = userEvent.setup()
    renderAt('/?language=fr')
    await screen.findByText('Showing 4 entries')
    await pickOption(user, screen.getByLabelText('Filter by language'), 'Spanish')
    await screen.findByText('Showing 10 entries')
    // Act
    await user.click(screen.getByRole('button', { name: 'Go back' }))
    // Assert
    expect(await screen.findByText('Showing 4 entries')).toBeInTheDocument()
    expect(screen.getByLabelText('Filter by language')).toHaveTextContent('French')
  })
})

describe('HistoryList load more', () => {
  it('keeps the rows on screen while the next page loads', async () => {
    // Arrange
    server.use(
      http.get(apiUrl(ENDPOINTS.entries), async ({ request }) => {
        if (new URL(request.url).searchParams.has('cursor')) await delay(150)
      }),
    )
    const user = userEvent.setup()
    renderAt('/')
    await screen.findByText('Showing 10 entries')
    // Act
    await user.click(screen.getByRole('button', { name: 'Load more' }))
    // Assert
    expect(screen.getByRole('button', { name: 'Loading…' })).toBeDisabled()
    expect(rows()).toHaveLength(10)
    expect(await screen.findByText('Showing 14 entries')).toBeInTheDocument()
  })

  it('moves focus to the first new row so it is not lost when the button goes away', async () => {
    // Arrange
    const user = userEvent.setup()
    renderAt('/')
    await screen.findByText('Showing 10 entries')
    // Act
    await user.click(screen.getByRole('button', { name: 'Load more' }))
    // Assert
    await screen.findByText('Showing 14 entries')
    expect(within(rows()[10] as HTMLElement).getByRole('link')).toHaveFocus()
  })
})
