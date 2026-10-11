import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { buildAnalysis, buildMistake } from '@/mocks/factories'
import { renderWithProviders } from '@/test/renderWithProviders'
import type { EntryOut } from '@/types/entry'
import { RevisableFeedback } from './RevisableFeedback'

const TEXT = 'Ayer fui al mercado. Hoy yo es feliz con mi familia.'
const ENTRY: EntryOut = { id: 'entry-test', language: 'es', text: TEXT, word_count: 10, created_at: '2026-10-09T18:00:00.000Z', updated_at: '2026-10-09T18:00:00.000Z' }
const ANALYSIS = buildAnalysis({ entry_id: ENTRY.id, input_text: TEXT, corrected_text: TEXT, mistakes: [buildMistake({ original: 'yo es', start: 25, end: 30 })] })

const renderFeedback = () => {
  renderWithProviders(<RevisableFeedback entry={ENTRY} analysis={ANALYSIS} />)
  return userEvent.setup()
}
const opener = () => screen.getByRole('button', { name: 'Rephrase a sentence' })

describe('RevisableFeedback rephrase', () => {
  it('opens a Rephrase section, closes it back to the button, and leaves the entry text alone', async () => {
    // Arrange
    const user = renderFeedback()
    // Act
    await user.click(opener())
    // Assert
    const section = await screen.findByRole('region', { name: 'Rephrase' })
    expect(within(section).getByRole('combobox', { name: 'Sentence' })).toHaveTextContent('Ayer fui al mercado.')
    // Act
    await user.click(within(section).getByRole('button', { name: 'Close' }))
    // Assert
    expect(screen.queryByRole('region', { name: 'Rephrase' })).not.toBeInTheDocument()
    expect(opener()).toHaveFocus()
    expect(document.querySelector('[data-entry-text]')).toHaveTextContent(TEXT)
  })

  it('starts on the sentence the learner had selected in the entry text', async () => {
    // Arrange
    const user = renderFeedback()
    const word = within(document.querySelector('[data-entry-text]') as HTMLElement).getByRole('button', { name: /yo es/ })
    const text = word.firstChild as Text
    window.getSelection()?.setBaseAndExtent(text, 1, text, 3)
    // Act
    await user.click(opener())
    // Assert
    expect(await screen.findByRole('combobox', { name: 'Sentence' })).toHaveTextContent('Hoy yo es feliz con mi familia.')
  })

  it('starts on the first sentence when nothing is selected', async () => {
    // Arrange
    const user = renderFeedback()
    window.getSelection()?.removeAllRanges()
    // Act
    await user.click(opener())
    // Assert
    expect(await screen.findByRole('combobox', { name: 'Sentence' })).toHaveTextContent('Ayer fui al mercado.')
  })
})
