import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { waitForLanguages } from '@/test/helpers'
import { renderWithProviders } from '@/test/renderWithProviders'
import { STORAGE_KEYS } from '@/utils/constants'
import { WriteScreen } from './WriteScreen'

const TEXT = 'Hoy yo es feliz y tranquilo.'
const FIXED = 'Hoy yo soy feliz y tranquilo.'

// A stored draft is checked at once (the debounce starts at the current text) and avoids typing `[`.
async function renderWithDraft(text = TEXT) {
  localStorage.setItem(STORAGE_KEYS.draft, text)
  const utils = renderWithProviders(<WriteScreen />)
  await waitForLanguages()
  return { user: userEvent.setup(), ...utils }
}

const editor = () => screen.getByLabelText<HTMLTextAreaElement>('Your entry')
const hintsButton = () => screen.findByRole('button', { name: '1 hint' })

describe('ComposerEditor live hints', () => {
  it('underlines a likely mistake and lists it as a hint', async () => {
    // Arrange
    const { user, container } = await renderWithDraft()
    // Act
    await user.click(await hintsButton())
    // Assert
    expect(container.querySelector('mark[data-decoration-id]')).toHaveTextContent('yo es')
    expect(within(screen.getByRole('list', { name: 'Live hints' })).getByText(/With «yo»/)).toBeInTheDocument()
  })

  it('accepts a hint from the list: the text changes and the hint goes', async () => {
    // Arrange
    const { user } = await renderWithDraft()
    await user.click(await hintsButton())
    // Act
    await user.click(screen.getByRole('button', { name: 'Accept yo soy for yo es' }))
    // Assert
    expect(editor()).toHaveValue(FIXED)
    expect(screen.queryByRole('button', { name: '1 hint' })).not.toBeInTheDocument()
  })

  it('opens the hint from a click inside the underlined words, and Enter accepts it', async () => {
    // Arrange
    const { user } = await renderWithDraft()
    await hintsButton()
    // Act
    await user.pointer({ keys: '[MouseLeft]', target: editor(), offset: 6 })
    const popover = screen.getByRole('dialog', { name: 'Hint: yo es should be yo soy' })
    expect(within(popover).getByRole('button', { name: 'Accept' })).toHaveFocus()
    await user.keyboard('{Enter}')
    // Assert
    expect(editor()).toHaveValue(FIXED)
  })

  it('dismisses with Escape, returns to the text and keeps the hint away', async () => {
    // Arrange
    const { user } = await renderWithDraft()
    await hintsButton()
    await user.pointer({ keys: '[MouseLeft]', target: editor(), offset: 6 })
    // Act
    await user.keyboard('{Escape}')
    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '1 hint' })).not.toBeInTheDocument()
    expect(editor()).toHaveFocus()
    expect(editor()).toHaveValue(TEXT)
  })

  it('does not open anything for a click outside the hinted words', async () => {
    // Arrange
    const { user } = await renderWithDraft()
    await hintsButton()
    // Act
    await user.pointer({ keys: '[MouseLeft]', target: editor(), offset: 20 })
    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
