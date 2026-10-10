import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { buildAnalysis } from '@/mocks/factories'
import { FeedbackView } from './FeedbackView'

const analysis = buildAnalysis()

async function openPanel() {
  const user = userEvent.setup()
  render(<FeedbackView analysis={analysis} />)
  const highlight = screen.getByRole('button', { name: /yo es/ })
  await user.click(highlight)
  return { user, highlight }
}

describe('FeedbackView detail panel', () => {
  it('shows the correction, category and explanation and moves focus into the panel', async () => {
    // Arrange + Act
    const { highlight } = await openPanel()
    // Assert
    const panel = screen.getByRole('region', { name: /yo es should be yo soy/ })
    expect(within(panel).getByText('Verb conjugation')).toBeInTheDocument()
    expect(panel).toHaveTextContent('With «yo», «ser» is conjugated «soy».')
    expect(highlight).toHaveAttribute('aria-expanded', 'true')
    expect(within(panel).getByRole('heading')).toHaveFocus()
  })

  it('closes on Escape and returns focus to the highlight', async () => {
    // Arrange
    const { user, highlight } = await openPanel()
    // Act
    await user.keyboard('{Escape}')
    // Assert
    expect(screen.queryByRole('region', { name: /should be/ })).not.toBeInTheDocument()
    expect(highlight).toHaveFocus()
    expect(highlight).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes with its Close button', async () => {
    // Arrange
    const { user, highlight } = await openPanel()
    // Act
    await user.click(screen.getByRole('button', { name: 'Close' }))
    // Assert
    expect(screen.queryByRole('region', { name: /should be/ })).not.toBeInTheDocument()
    expect(highlight).toHaveFocus()
  })

  it('closes when its own highlight is clicked again', async () => {
    // Arrange
    const { user, highlight } = await openPanel()
    // Act
    await user.click(highlight)
    // Assert
    expect(screen.queryByRole('region', { name: /should be/ })).not.toBeInTheDocument()
    expect(highlight).toHaveAttribute('aria-expanded', 'false')
    expect(highlight).toHaveFocus()
  })

  it('opens from the keyboard', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<FeedbackView analysis={analysis} />)
    await user.tab()
    await user.tab()
    // Act
    await user.keyboard('{Enter}')
    // Assert
    expect(screen.getByRole('region', { name: /should be/ })).toBeInTheDocument()
  })
})
