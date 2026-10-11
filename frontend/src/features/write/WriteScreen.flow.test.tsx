import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { listEntries } from '@/mocks/db'
import { seedStore } from '@/mocks/seed'
import { failWith, setMockMode, slowDown, waitForLanguages } from '@/test/helpers'
import { renderWithProviders } from '@/test/renderWithProviders'
import { STORAGE_KEYS } from '@/utils/constants'
import { ENDPOINTS } from '@/utils/endpoints'
import { WriteScreen } from './WriteScreen'

const ENTRY = 'Ayer yo es feliz en el [park].'

// A stored draft avoids typing `[`, which user-event treats as a key descriptor.
async function startWithDraft(text = ENTRY) {
  localStorage.setItem(STORAGE_KEYS.draft, text)
  const user = userEvent.setup()
  renderWithProviders(<WriteScreen />)
  await waitForLanguages()
  return user
}

const getFeedback = () => screen.getByRole('button', { name: 'Get feedback' })

describe('WriteScreen submitting', () => {
  it('saves, analyses and shows feedback, then clears the local draft', async () => {
    // Arrange
    slowDown('post', ENDPOINTS.analyses(':entryId'))
    const user = await startWithDraft()
    expect(screen.getByText(/^Write freely/)).toBeInTheDocument()
    // Act
    await user.click(getFeedback())
    // Assert
    expect(await screen.findByText('Saved. Analyzing…')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Feedback' })).toBeInTheDocument()
    // The feedback is the status now: no leftover "Saved" line or writing prompt above it.
    expect(screen.queryByText(/^Saved/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Write freely/)).not.toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEYS.draft)).toBeNull()
  })

  it('submits with Ctrl+Enter from the text box', async () => {
    // Arrange
    const user = await startWithDraft()
    await user.click(screen.getByLabelText('Your entry'))
    // Act
    await user.keyboard('{Control>}{Enter}{/Control}')
    // Assert
    expect(await screen.findByRole('heading', { name: 'Feedback' })).toBeInTheDocument()
  })

  it('creates exactly one entry when the button is pressed twice', async () => {
    // Arrange
    const user = await startWithDraft()
    // Act
    await user.dblClick(getFeedback())
    await screen.findByRole('heading', { name: 'Feedback' })
    // Assert
    expect(listEntries(null, null, 50)?.items).toHaveLength(seedStore().entries.length + 1)
  })

  it('keeps the entry and offers a retry when the analysis fails', async () => {
    // Arrange
    setMockMode('analysis-fail')
    const user = await startWithDraft()
    await user.click(getFeedback())
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The AI took too long to respond. Your entry is saved — try again.')
    // Act
    await user.click(within(alert).getByRole('button', { name: 'Retry analysis' }))
    // Assert
    expect(await screen.findByRole('heading', { name: 'Feedback' })).toBeInTheDocument()
  })

  it('shows the saved text while the failed analysis waits for a retry', async () => {
    // Arrange
    setMockMode('analysis-fail')
    const user = await startWithDraft()
    // Act
    await user.click(getFeedback())
    await screen.findByRole('alert')
    // Assert
    expect(screen.getByLabelText('Your entry')).toHaveValue(ENTRY)
    expect(screen.getByLabelText('Your entry')).toHaveAttribute('readonly')
  })

  it('keeps the draft and re-enables the button when saving fails', async () => {
    // Arrange
    failWith('post', ENDPOINTS.entries)
    const user = await startWithDraft()
    // Act
    await user.click(getFeedback())
    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent('Your draft is still here.')
    expect(localStorage.getItem(STORAGE_KEYS.draft)).toBe(ENTRY)
    expect(getFeedback()).toBeEnabled()
  })

  it('revises the entry and shows the new analysis', async () => {
    // Arrange
    const user = await startWithDraft()
    await user.click(getFeedback())
    await user.click(await screen.findByRole('button', { name: 'Revise & re-check' }))
    const editor = screen.getByLabelText('Revise your entry')
    // Act
    await user.clear(editor)
    await user.type(editor, 'Ayer fui feliz.')
    await user.click(screen.getByRole('button', { name: 'Re-check' }))
    // Assert
    expect(await screen.findByText('Great job — no mistakes found!')).toBeInTheDocument()
  })

  it('starts a fresh, focused entry from "New entry"', async () => {
    // Arrange
    const user = await startWithDraft()
    await user.click(getFeedback())
    // Act
    await user.click(await screen.findByRole('button', { name: 'New entry' }))
    // Assert
    expect(screen.getByLabelText('Your entry')).toHaveValue('')
    expect(screen.getByLabelText('Your entry')).toHaveFocus()
    expect(getFeedback()).toBeDisabled()
  })
})
