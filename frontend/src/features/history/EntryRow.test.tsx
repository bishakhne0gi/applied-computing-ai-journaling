import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SEEDED } from '@/mocks/seed'
import { failWith, setMockMode } from '@/test/helpers'
import { ENDPOINTS } from '@/utils/endpoints'
import { renderWithProviders } from '@/test/renderWithProviders'
import { HistoryList } from './HistoryList'

function rowContaining(text: string): HTMLElement {
  const row = within(screen.getByRole('list', { name: 'Entries' }))
    .getAllByRole('listitem')
    .find((item) => item.textContent?.includes(text))
  if (!row) throw new Error(`No row containing "${text}"`)
  return row
}

async function renderRows(route = '/') {
  const user = userEvent.setup()
  renderWithProviders(<HistoryList onStartWriting={vi.fn()} />, { route })
  await screen.findByText('Showing 10 entries')
  return user
}

describe('history rows', () => {
  it('link to the entry and show date, language, preview and error count', async () => {
    // Arrange
    await renderRows()
    // Act
    const row = rowContaining('Hoy 😀 la problema')
    // Assert
    expect(within(row).getByRole('link')).toHaveAttribute('href', `/?entry=${SEEDED.emoji}`)
    expect(row).toHaveTextContent(/Oct \d{1,2}, 2026/)
    expect(within(row).getByText('2 errors')).toBeInTheDocument()
  })

  it('name each link by its preview and describe it with date, language and status', async () => {
    // Arrange
    await renderRows()
    // Act
    const link = within(rowContaining('Mañana voy a el cine')).getByRole('link')
    // Assert
    expect(link).toHaveAccessibleName('Mañana voy a el cine con mis amigos.')
    expect(link).toHaveAccessibleDescription(/^Oct \d{1,2}, 2026, .* · Spanish Analysis failed$/)
  })

  it('mark the open entry as the current one', async () => {
    // Arrange + Act
    await renderRows(`/?entry=${SEEDED.emoji}`)
    // Assert
    expect(within(rowContaining('Hoy 😀 la problema')).getByRole('link')).toHaveAttribute('aria-current', 'true')
    expect(within(rowContaining('Escribo esto antes de dormir')).getByRole('link')).not.toHaveAttribute('aria-current')
  })

  it('mark entries that were never analysed', async () => {
    // Arrange
    await renderRows()
    // Act
    const row = rowContaining('Escribo esto antes de dormir')
    // Assert
    expect(within(row).getByText('Not analyzed')).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: /^Get feedback/ })).toBeInTheDocument()
  })

  it('retry a failed analysis in place', async () => {
    // Arrange
    const user = await renderRows()
    const row = rowContaining('Mañana voy a el cine')
    expect(within(row).getByText('Analysis failed')).toBeInTheDocument()
    // Act
    await user.click(within(row).getByRole('button', { name: /^Retry analysis/ }))
    // Assert
    await waitFor(() => expect(within(rowContaining('Mañana voy a el cine')).getByText('1 error')).toBeInTheDocument())
  })

  it('moves focus to the row’s link and announces it when a retry succeeds', async () => {
    // Arrange
    const user = await renderRows()
    const row = rowContaining('Mañana voy a el cine')
    // Act
    await user.click(within(row).getByRole('button', { name: /^Retry analysis/ }))
    // Assert
    await waitFor(() => expect(within(rowContaining('Mañana voy a el cine')).getByText('1 error')).toBeInTheDocument())
    expect(within(rowContaining('Mañana voy a el cine')).getByRole('link')).toHaveFocus()
    expect(within(rowContaining('Mañana voy a el cine')).getByRole('status')).toHaveTextContent('Feedback ready')
  })

  it('announces that the analysis failed again and keeps focus on the retry button', async () => {
    // Arrange
    const user = await renderRows()
    setMockMode('analysis-fail')
    const row = rowContaining('Escribo esto antes de dormir')
    // Act
    await user.click(within(row).getByRole('button', { name: /^Get feedback/ }))
    // Assert
    await waitFor(() => expect(within(row).getByRole('status')).toHaveTextContent('Analysis failed again'))
    expect(within(row).getByRole('button', { name: /^Get feedback/ })).toHaveFocus()
  })

  it('mark an interrupted analysis as retryable', async () => {
    // Arrange
    const user = await renderRows()
    const row = rowContaining('Hier, je suis allé')
    expect(within(row).getByText('Analysis interrupted')).toBeInTheDocument()
    // Act
    await user.click(within(row).getByRole('button', { name: /^Retry analysis/ }))
    // Assert
    await waitFor(() => expect(within(rowContaining('Hier, je suis allé')).getByText('1 error')).toBeInTheDocument())
  })

  it('give each retry button the entry it belongs to', async () => {
    // Arrange
    await renderRows()
    // Act
    const names = screen.getAllByRole('button', { name: /^Retry analysis/ }).map((button) => button.getAttribute('aria-label'))
    // Assert
    expect(names).toEqual(['Retry analysis: Mañana voy a el cine con mis amigos.', 'Retry analysis: Hier, je suis allé à le parc.'])
  })

  it('explain in the row when a retry fails and let the learner try again', async () => {
    // Arrange
    const user = await renderRows()
    failWith('post', ENDPOINTS.analyses(':entryId'))
    const row = rowContaining('Mañana voy a el cine')
    // Act
    await user.click(within(row).getByRole('button', { name: /^Retry analysis/ }))
    // Assert
    expect(await within(row).findByRole('alert')).toHaveTextContent(/on our side/)
    expect(within(row).getByRole('button', { name: /^Retry analysis/ })).toBeEnabled()
  })
})
