import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SEEDED } from '@/mocks/seed'
import { failWith } from '@/test/helpers'
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

async function renderRows() {
  const user = userEvent.setup()
  renderWithProviders(<HistoryList />, { route: '/entries' })
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
    expect(within(row).getByRole('link')).toHaveAttribute('href', `/entries/${SEEDED.emoji}`)
    expect(row).toHaveTextContent(/Oct \d{1,2}, 2026/)
    expect(within(row).getByText('2 errors')).toBeInTheDocument()
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
