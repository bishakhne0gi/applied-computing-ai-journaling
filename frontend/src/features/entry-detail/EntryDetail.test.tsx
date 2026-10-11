import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { journalKeys } from '@/hooks/queries/journalKeys'
import { analysesOf } from '@/mocks/db'
import { SEEDED } from '@/mocks/seed'
import { apiUrl, failWith } from '@/test/helpers'
import { server } from '@/test/server'
import { ENDPOINTS } from '@/utils/endpoints'
import { formatDateTime } from '@/utils/formatter'
import { renderWithProviders } from '@/test/renderWithProviders'
import { EntryDetail } from './EntryDetail'

const renderDetail = (id: string) => {
  renderWithProviders(<EntryDetail entryId={id} />)
  return userEvent.setup()
}

describe('EntryDetail', () => {
  it('shows a loading state, then the entry and its latest feedback', async () => {
    // Arrange + Act
    renderDetail(SEEDED.revisedFrench)
    // Assert
    expect(screen.getByRole('status')).toHaveTextContent('Loading entry…')
    expect(await screen.findByText('Great job — no mistakes found!')).toBeInTheDocument()
    expect(await screen.findByText(/French · .* · 8 words/)).toBeInTheDocument()
  })

  it('switches to an earlier analysis, which keeps its own text and highlights', async () => {
    // Arrange
    const user = renderDetail(SEEDED.revisedFrench)
    await user.click(await screen.findByLabelText('Analysis'))
    const [latest, older] = screen.getAllByRole('option')
    expect(latest?.textContent).toMatch(/0 errors \(latest\)$/)
    // Act
    if (older) await user.click(older)
    // Assert
    expect(await screen.findByRole('button', { name: /à le/ })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Feedback' })).toHaveTextContent('Je suis allé à le marché avec ma sœur.')
  })

  it('retries a failed analysis', async () => {
    // Arrange
    const user = renderDetail(SEEDED.failed)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The AI took too long to respond.')
    // Act
    await user.click(within(alert).getByRole('button', { name: 'Retry analysis' }))
    // Assert
    expect(await screen.findByRole('heading', { name: 'Feedback' })).toBeInTheDocument()
  })

  it('retries an analysis that was interrupted', async () => {
    // Arrange
    const user = renderDetail(SEEDED.interrupted)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The analysis did not finish.')
    // Act
    await user.click(within(alert).getByRole('button', { name: 'Retry analysis' }))
    // Assert
    expect(await screen.findByRole('heading', { name: 'Feedback' })).toBeInTheDocument()
  })

  it('offers feedback for an entry that was never analysed', async () => {
    // Arrange
    const user = renderDetail(SEEDED.unanalysed)
    // Act
    await user.click(await screen.findByRole('button', { name: 'Get feedback' }))
    // Assert
    expect(await screen.findByRole('heading', { name: 'Feedback' })).toBeInTheDocument()
  })

  it('explains an entry that does not exist', async () => {
    // Arrange + Act
    renderDetail('ffffffff-ffff-4fff-8fff-ffffffffffff')
    // Assert
    expect(await screen.findByText("We couldn't find that entry. It may have been removed.")).toBeInTheDocument()
    // The route already moves focus to the heading, which announces this; a second alert would read it twice.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('names the page for what happened when the entry is missing', async () => {
    // Arrange + Act
    renderDetail('ffffffff-ffff-4fff-8fff-ffffffffffff')
    // Assert
    expect(await screen.findByRole('heading', { level: 1, name: 'Entry not found' })).toBeInTheDocument()
    await waitFor(() => expect(document.title).toBe('Entry not found · Language Journal'))
  })

  it.each([
    ['a missing entry', 'ffffffff-ffff-4fff-8fff-ffffffffffff'],
    ['an id that is not a UUID', 'not-an-id'],
  ])('offers a new entry, not a retry, for %s', async (_label, id) => {
    // Arrange + Act
    renderDetail(id)
    // Assert
    expect(await screen.findByRole('link', { name: 'Write a new entry' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })

  it('keeps showing the entry when a background refresh fails', async () => {
    // Arrange
    const { client } = renderWithProviders(<EntryDetail entryId={SEEDED.revisedFrench} />)
    await screen.findByText('Great job — no mistakes found!')
    failWith('get', ENDPOINTS.entry(':entryId'))
    failWith('get', ENDPOINTS.analyses(':entryId'))
    // Act
    await act(() => client.refetchQueries({ queryKey: journalKeys.entry(SEEDED.revisedFrench) }))
    await waitFor(() => expect(client.getQueryState(journalKeys.entry(SEEDED.revisedFrench))?.status).toBe('error'))
    // Assert
    expect(screen.getByText('Great job — no mistakes found!')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('lists analyses newest first and marks only the newest as latest, whatever order the API used', async () => {
    // Arrange
    const [newer, older] = analysesOf(SEEDED.revisedFrench)
    server.use(http.get(apiUrl(ENDPOINTS.analyses(':entryId')), () => HttpResponse.json([older, newer])))
    const user = renderDetail(SEEDED.revisedFrench)
    // Act
    await user.click(await screen.findByLabelText('Analysis'))
    const options = screen.getAllByRole('option')
    // Assert
    expect(options[0]).toHaveTextContent(formatDateTime(newer?.created_at ?? ''))
    expect(options[1]).toHaveTextContent(formatDateTime(older?.created_at ?? ''))
    expect(options[0]).toHaveTextContent(/\(latest\)$/)
    expect(options[1]).not.toHaveTextContent('(latest)')
  })

  it('revises the entry and selects the new analysis', async () => {
    // Arrange
    const user = renderDetail(SEEDED.emoji)
    await user.click(await screen.findByRole('button', { name: 'Revise & re-check' }))
    const editor = screen.getByLabelText('Revise your entry')
    // Act
    await user.clear(editor)
    await user.type(editor, 'Hoy fue difícil, pero soy optimista.')
    await user.click(screen.getByRole('button', { name: 'Re-check' }))
    // Assert
    expect(await screen.findByText('Great job — no mistakes found!')).toBeInTheDocument()
    expect(screen.getByLabelText('Analysis')).toHaveTextContent(/\(latest\)$/)
    await user.click(screen.getByLabelText('Analysis'))
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(2)
    expect(options[0]).toHaveTextContent(/\(latest\)$/)
    expect(options.slice(1).some((option) => option.textContent?.includes('(latest)'))).toBe(false)
  })

  it('never shows the old feedback again once a re-check has been requested', async () => {
    // Arrange
    const user = renderDetail(SEEDED.emoji)
    const oldSummary = (await screen.findByRole('region', { name: 'Feedback' })).querySelector('p')?.textContent ?? ''
    expect(oldSummary).not.toBe('')
    await user.click(screen.getByRole('button', { name: 'Revise & re-check' }))
    const editor = screen.getByLabelText('Revise your entry')
    await user.clear(editor)
    await user.type(editor, 'Hoy fue difícil, pero soy optimista.')
    let sawOld = false
    const observer = new MutationObserver(() => {
      sawOld ||= document.body.textContent.includes(oldSummary)
    })
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    // Act
    await user.click(screen.getByRole('button', { name: 'Re-check' }))
    await screen.findByText('Great job — no mistakes found!')
    observer.disconnect()
    // Assert
    expect(sawOld).toBe(false)
  })
})
