import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { buildAnalysis, buildMistake } from '@/mocks/factories'
import { FeedbackView } from './FeedbackView'

// Code points: H o y ␠ 😀 ␠ → "yo es" starts at 6; "[park]" spans 24–30.
const analysis = buildAnalysis({
  input_text: 'Hoy 😀 yo es feliz en el [park].',
  corrected_text: 'Hoy 😀 yo soy feliz en el parque.',
  feedback_summary: 'Good effort! 3 things to look at.',
  mistakes: [
    buildMistake({ id: 'm-error', start: 6, end: 11 }),
    buildMistake({ id: 'm-vocab', kind: 'vocab_help', category: 'vocabulary', original: '[park]', correction: 'parque', explanation: 'Here is the word you were looking for.', start: 24, end: 30 }),
    buildMistake({ id: 'm-note', kind: 'suggestion', category: 'other', original: 'feliz en el', correction: 'contento en el', explanation: 'Overlaps another highlight.', start: null, end: null }),
  ],
})

describe('FeedbackView', () => {
  it('shows the summary and turns each placed mistake into a highlight button', () => {
    // Arrange
    const props = { analysis }
    // Act
    render(<FeedbackView {...props} />)
    // Assert
    expect(screen.getByRole('heading', { name: 'Feedback' })).toBeInTheDocument()
    expect(screen.getByText('Good effort! 3 things to look at.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'yo es (error)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '[park] (word help)' })).toBeInTheDocument()
  })

  it('encodes the kind in the underline style as well as the colour', () => {
    // Arrange
    render(<FeedbackView analysis={analysis} />)
    // Act
    const error = screen.getByRole('button', { name: /yo es/ })
    const vocab = screen.getByRole('button', { name: /park/ })
    // Assert
    expect(error).toHaveClass('decoration-wavy', 'decoration-mark-error')
    expect(vocab).toHaveClass('decoration-dotted', 'decoration-mark-vocab')
  })

  it('counts each kind in the legend', () => {
    // Arrange
    render(<FeedbackView analysis={analysis} />)
    // Act
    const legend = screen.getByRole('list', { name: 'Feedback legend' })
    // Assert
    expect(within(legend).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Error 1',
      'Suggestion 1',
      'Word help 1',
    ])
  })

  it('lists notes it cannot place under "Other notes"', () => {
    // Arrange
    render(<FeedbackView analysis={analysis} />)
    // Act
    const notes = screen.getByRole('region', { name: 'Other notes' })
    // Assert
    expect(notes).toHaveTextContent('feliz en el')
    expect(notes).toHaveTextContent('Overlaps another highlight.')
  })

  it('toggles the corrected version and hides the highlights meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<FeedbackView analysis={analysis} />)
    const toggle = screen.getByRole('button', { name: 'Show corrected version' })
    // Act
    await user.click(toggle)
    // Assert
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Hoy 😀 yo soy feliz en el parque.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /yo es/ })).not.toBeInTheDocument()
  })

  it('says when there is nothing to correct', () => {
    // Arrange
    const clean = buildAnalysis({ mistakes: [], feedback_summary: 'Great job — no mistakes found!' })
    // Act
    render(<FeedbackView analysis={clean} />)
    // Assert
    expect(screen.getByText('Nothing to correct in this entry.')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Other notes' })).not.toBeInTheDocument()
  })

  it('renders the actions it is given', () => {
    // Arrange
    const actions = <a href="/">New entry</a>
    // Act
    render(<FeedbackView analysis={analysis} actions={actions} />)
    // Assert
    expect(screen.getByRole('link', { name: 'New entry' })).toBeInTheDocument()
  })
})
