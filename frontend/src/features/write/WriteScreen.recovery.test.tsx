import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { listEntries } from '@/mocks/db'
import { seedStore } from '@/mocks/seed'
import { apiUrl, failWith, setMockMode, slowDown, waitForLanguages } from '@/test/helpers'
import { server } from '@/test/server'
import { renderWithProviders } from '@/test/renderWithProviders'
import { STORAGE_KEYS } from '@/utils/constants'
import { ENDPOINTS } from '@/utils/endpoints'
import { WriteScreen } from './WriteScreen'

const ENTRY = 'Ayer yo es feliz en el [park].'
const entryCount = () => listEntries(null, null, 50)?.items.length
const seededCount = () => seedStore().entries.length

async function startWithDraft() {
  localStorage.setItem(STORAGE_KEYS.draft, ENTRY)
  const user = userEvent.setup()
  renderWithProviders(<WriteScreen />)
  await waitForLanguages()
  return user
}

const getFeedback = () => screen.getByRole('button', { name: 'Get feedback' })

describe('WriteScreen recovery', () => {
  it('keeps the saved entry when the analysis request never arrives, and retries without a second entry', async () => {
    // Arrange
    server.use(http.post(apiUrl(ENDPOINTS.analyses(':entryId')), () => HttpResponse.error(), { once: true }))
    const user = await startWithDraft()
    await user.click(getFeedback())
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Your entry is saved.')
    expect(screen.getByLabelText('Your entry')).toHaveValue(ENTRY)
    expect(entryCount()).toBe(seededCount() + 1)
    // Act
    await user.click(within(alert).getByRole('button', { name: 'Retry analysis' }))
    // Assert
    expect(await screen.findByRole('heading', { name: 'Feedback' })).toBeInTheDocument()
    expect(entryCount()).toBe(seededCount() + 1)
  })

  it('disables the retry and says so while the retry runs', async () => {
    // Arrange
    setMockMode('analysis-fail')
    const user = await startWithDraft()
    await user.click(getFeedback())
    const alert = await screen.findByRole('alert')
    slowDown('post', ENDPOINTS.analyses(':entryId'), 200)
    // Act
    await user.click(within(alert).getByRole('button', { name: 'Retry analysis' }))
    // Assert
    expect(await screen.findByRole('button', { name: 'Retrying…' })).toBeDisabled()
    expect(await screen.findByRole('heading', { name: 'Feedback' })).toBeInTheDocument()
  })

  it('moves focus to the Feedback heading once the analysis arrives', async () => {
    // Arrange
    const user = await startWithDraft()
    // Act
    await user.click(getFeedback())
    // Assert
    expect(await screen.findByRole('heading', { name: 'Feedback' })).toHaveFocus()
  })

  it('moves focus to the new Feedback heading after a revision', async () => {
    // Arrange
    const user = await startWithDraft()
    await user.click(getFeedback())
    await user.click(await screen.findByRole('button', { name: 'Revise & re-check' }))
    // Act
    await user.type(screen.getByLabelText('Revise your entry'), ' ahora')
    await user.click(screen.getByRole('button', { name: 'Re-check' }))
    // Assert
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Feedback' })).toHaveFocus())
  })

  it('shows an error and keeps the revision when the revised text cannot be saved', async () => {
    // Arrange
    const user = await startWithDraft()
    await user.click(getFeedback())
    await user.click(await screen.findByRole('button', { name: 'Revise & re-check' }))
    failWith('patch', ENDPOINTS.entry(':entryId'))
    const editor = screen.getByLabelText('Revise your entry')
    await user.clear(editor)
    await user.type(editor, 'Ayer fui feliz.')
    // Act
    await user.click(screen.getByRole('button', { name: 'Re-check' }))
    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(/on our side/)
    expect(editor).toHaveValue('Ayer fui feliz.')
  })
})
