import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { VocabularyOut } from '@/types/assist'
import { BetterWords } from './BetterWords'

const ITEMS: VocabularyOut[] = [
  {
    original: 'feliz',
    start: 10,
    end: 15,
    alternatives: [
      { word: 'contento', nuance: 'Everyday and a little softer.' },
      { word: 'alegre', nuance: 'Cheerful, outgoing.' },
    ],
  },
]

describe('BetterWords', () => {
  it('lists each alternative as a button in edit mode and reports the pick', async () => {
    // Arrange
    const onUseWord = vi.fn()
    render(<BetterWords items={ITEMS} mode="edit" onUseWord={onUseWord} />)
    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Use contento for feliz' }))
    // Assert
    expect(screen.getByRole('button', { name: 'Use alegre for feliz' })).toBeInTheDocument()
    expect(onUseWord).toHaveBeenCalledWith(ITEMS[0], 'contento')
  })

  it('shows plain chips and no replace buttons in read mode', () => {
    // Arrange + Act
    render(<BetterWords items={ITEMS} mode="read" />)
    // Assert
    expect(screen.getByText('contento')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Use / })).not.toBeInTheDocument()
  })

  it('reaches every nuance toggletip with Tab and opens it on focus', async () => {
    // Arrange
    render(<BetterWords items={ITEMS} mode="edit" onUseWord={vi.fn()} />)
    // Act
    await userEvent.tab()
    await userEvent.tab()
    // Assert
    expect(screen.getByRole('button', { name: 'How contento differs' })).toHaveFocus()
    expect(screen.getByText('Everyday and a little softer.')).toHaveAttribute('data-state', 'open')
  })

  it('says so when the sentence already uses good words', () => {
    // Arrange + Act
    render(<BetterWords items={[]} mode="edit" onUseWord={vi.fn()} />)
    // Assert
    expect(screen.getByText('This sentence already uses good words.')).toBeInTheDocument()
  })
})
