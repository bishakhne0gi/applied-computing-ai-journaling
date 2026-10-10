import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SEEDED } from '@/mocks/seed'
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
    const switcher = await screen.findByLabelText('Analysis')
    const [latest, older] = within(switcher).getAllByRole<HTMLOptionElement>('option')
    expect(latest?.textContent).toMatch(/0 errors \(latest\)$/)
    // Act
    await user.selectOptions(switcher, older?.value ?? '')
    // Assert
    expect(await screen.findByRole('button', { name: /à le/ })).toBeInTheDocument()
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
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't find that entry.")
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
    expect(screen.getByLabelText('Analysis')).toHaveDisplayValue(/\(latest\)$/)
  })
})
