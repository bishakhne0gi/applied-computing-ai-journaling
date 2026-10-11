import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { buildAnalysis, buildMistake } from '@/mocks/factories'
import { FeedbackView } from './FeedbackView'
import { KIND_HINTS } from './labels'

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

  it('switches to the corrected version in a tab and hides the highlights meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<FeedbackView analysis={analysis} />)
    // Act
    await user.click(screen.getByRole('tab', { name: 'Corrected' }))
    // Assert
    expect(screen.getByRole('tab', { name: 'Corrected' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel', { name: 'Corrected' })).toHaveTextContent('Hoy 😀 yo soy feliz en el parque.')
    expect(screen.queryByRole('button', { name: /yo es/ })).not.toBeInTheDocument()
  })

  it('closes an open mistake panel when the version changes', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<FeedbackView analysis={analysis} />)
    await user.click(screen.getByRole('button', { name: 'yo es (error)' }))
    // Act
    await user.click(screen.getByRole('tab', { name: 'Corrected' }))
    await user.click(screen.getByRole('tab', { name: 'Your text' }))
    // Assert
    expect(screen.getByRole('button', { name: 'yo es (error)' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('explains what each kind of mark means', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<FeedbackView analysis={analysis} />)
    // Act
    await user.click(screen.getByRole('button', { name: 'What do these mean?' }))
    // Assert
    const tip = screen.getByRole('tooltip')
    expect(tip).toHaveAttribute('data-state', 'open')
    for (const hint of Object.values(KIND_HINTS)) expect(tip).toHaveTextContent(hint)
  })

  it('keeps the legend chips out of the tab order', () => {
    // Arrange + Act
    render(<FeedbackView analysis={analysis} />)
    // Assert
    const legend = screen.getByRole('list', { name: 'Feedback legend' })
    expect(within(legend).queryAllByRole('button')).toHaveLength(0)
  })

  it('hugs the tabs to their content and makes an empty original text focusable', () => {
    // Arrange + Act
    render(<FeedbackView analysis={buildAnalysis({ mistakes: [], feedback_summary: 'Clean.' })} />)
    // Assert
    expect(screen.getByRole('tablist', { name: 'Text version' }).parentElement).not.toHaveClass('flex-col')
    expect(screen.getByRole('tabpanel', { name: 'Your text' })).toHaveAttribute('tabindex', '0')
  })

  it('leaves the original panel out of the tab order when it holds highlights', () => {
    // Arrange + Act
    render(<FeedbackView analysis={analysis} />)
    // Assert
    expect(screen.getByRole('tabpanel', { name: 'Your text' })).not.toHaveAttribute('tabindex')
  })

  it('says when there is nothing to correct', () => {
    // Arrange
    const clean = buildAnalysis({ mistakes: [], feedback_summary: 'Great job, no mistakes found!' })
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
