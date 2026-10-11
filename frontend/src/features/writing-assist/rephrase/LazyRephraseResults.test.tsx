import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RephraseOut } from '@/types/assist'
import { LazyRephraseResults } from './LazyRephraseResults'
import { loadRephraseResults } from './loadRephraseResults'

vi.mock('./loadRephraseResults', () => ({ loadRephraseResults: vi.fn() }))
const load = vi.mocked(loadRephraseResults)
const Loaded = () => <p>Results loaded</p>

const DATA: RephraseOut = { sentence: 'Hoy yo es feliz.', versions: [], vocabulary: [] }
const renderResults = () => render(<LazyRephraseResults data={DATA} tab="versions" sentence={DATA.sentence} mode="edit" />)

afterEach(() => vi.restoreAllMocks())

describe('LazyRephraseResults', () => {
  it('shows the card’s own loading skeleton while the code loads', () => {
    // Arrange
    load.mockReturnValue(new Promise(() => undefined))
    // Act
    renderResults()
    // Assert
    expect(screen.getByRole('status')).toHaveTextContent('Finding better versions…')
  })

  it('explains a failed load and loads again on Try again', async () => {
    // Arrange
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    load.mockRejectedValueOnce(new Error('chunk failed')).mockResolvedValue({ default: Loaded } as never)
    const user = userEvent.setup()
    renderResults()
    // Act
    await user.click(await screen.findByRole('button', { name: /try again/i }))
    // Assert
    expect(await screen.findByText('Results loaded')).toBeInTheDocument()
  })
})
