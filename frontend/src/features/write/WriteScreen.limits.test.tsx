import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { listEntries } from '@/mocks/db'
import { seedStore } from '@/mocks/seed'
import { waitForLanguages } from '@/test/helpers'
import { renderWithProviders } from '@/test/renderWithProviders'
import { MAX_ENTRY_CHARS, STORAGE_KEYS } from '@/utils/constants'
import { WriteScreen } from './WriteScreen'

async function startWithDraft(text: string) {
  localStorage.setItem(STORAGE_KEYS.draft, text)
  const user = userEvent.setup()
  renderWithProviders(<WriteScreen />)
  await waitForLanguages()
  return user
}

// A submit would reach the in-memory API within a few ms; wait past that before asserting nothing happened.
const settle = () => new Promise((resolve) => setTimeout(resolve, 100))

const getFeedback = () => screen.getByRole('button', { name: 'Get feedback' })

describe('WriteScreen entry length', () => {
  afterEach(() => vi.restoreAllMocks())

  it('shows a live count against the limit next to the word count', async () => {
    // Arrange
    const user = userEvent.setup()
    renderWithProviders(<WriteScreen />)
    // Act
    await user.type(screen.getByLabelText('Your entry'), 'Hoy es lunes')
    // Assert
    expect(screen.getByText(`12 / ${MAX_ENTRY_CHARS}`)).toBeInTheDocument()
    expect(screen.getByText('3 words')).toBeInTheDocument()
  })

  it('does not cap typing in the browser, so the limit can be explained instead', async () => {
    // Arrange + Act
    await startWithDraft('Hola')
    // Assert
    expect(screen.getByLabelText('Your entry')).not.toHaveAttribute('maxlength')
  })

  it('counts code points: 5000 emoji are within the limit', async () => {
    // Arrange + Act
    await startWithDraft('😀'.repeat(MAX_ENTRY_CHARS))
    // Assert
    expect(screen.getByText(`${MAX_ENTRY_CHARS} / ${MAX_ENTRY_CHARS}`)).not.toHaveClass('text-danger')
    expect(getFeedback()).toBeEnabled()
  })

  it('ignores surrounding whitespace, as the backend trims it', async () => {
    // Arrange + Act
    await startWithDraft(`  \n${'a'.repeat(MAX_ENTRY_CHARS)}\n\n  `)
    // Assert
    expect(screen.getByText(`${MAX_ENTRY_CHARS} / ${MAX_ENTRY_CHARS}`)).toBeInTheDocument()
    expect(getFeedback()).toBeEnabled()
  })

  it('warns and blocks submitting one code point over the limit', async () => {
    // Arrange + Act
    const user = await startWithDraft('😀'.repeat(MAX_ENTRY_CHARS + 1))
    // Assert
    expect(screen.getByText(`${MAX_ENTRY_CHARS + 1} / ${MAX_ENTRY_CHARS}`)).toHaveClass('text-danger')
    expect(screen.getByLabelText('Your entry')).toHaveAccessibleDescription(/1 character too long/)
    expect(getFeedback()).toBeDisabled()
    await user.click(screen.getByLabelText('Your entry'))
    await user.keyboard('{Control>}{Enter}{/Control}')
    await settle()
    expect(listEntries(null, null, 50)?.items).toHaveLength(seedStore().entries.length)
  })
})

describe('WriteScreen keyboard shortcut', () => {
  it('does nothing for blank text', async () => {
    // Arrange
    const user = userEvent.setup()
    renderWithProviders(<WriteScreen />)
    await waitForLanguages()
    await user.type(screen.getByLabelText('Your entry'), '   ')
    // Act
    await user.keyboard('{Control>}{Enter}{/Control}')
    await settle()
    // Assert
    expect(listEntries(null, null, 50)?.items).toHaveLength(seedStore().entries.length)
    expect(screen.getByRole('status')).not.toHaveTextContent(/Saving|Saved/)
  })

  it('is ignored while an input method is composing', async () => {
    // Arrange
    await startWithDraft('Hola mundo')
    // Act
    fireEvent.keyDown(screen.getByLabelText('Your entry'), { key: 'Enter', ctrlKey: true, isComposing: true })
    await settle()
    // Assert
    expect(screen.getByRole('status')).toHaveTextContent('Draft kept on this device')
    expect(listEntries(null, null, 50)?.items).toHaveLength(seedStore().entries.length)
  })
})

describe('WriteScreen draft status', () => {
  afterEach(() => vi.restoreAllMocks())

  it('does not claim the draft is kept when the device refuses to store it', async () => {
    // Arrange
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const user = userEvent.setup()
    renderWithProviders(<WriteScreen />)
    // Act
    await user.type(screen.getByLabelText('Your entry'), 'Hola')
    // Assert
    expect(screen.getByRole('status')).not.toHaveTextContent('Draft kept on this device')
    expect(screen.getByRole('status')).toHaveTextContent('Draft not saved on this device')
  })
})
