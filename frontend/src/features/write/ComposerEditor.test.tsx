import { fireEvent, screen, within } from '@testing-library/react'
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
const popover = () => screen.queryByRole('dialog', { name: 'Hint: yo es should be yo soy' })
const inPopover = () => within(screen.getByRole('dialog', { name: 'Hint: yo es should be yo soy' }))

// Caret between «yo» and « es»: strictly inside the underlined words.
async function openByClick() {
  const utils = await renderWithDraft()
  await hintsButton()
  await utils.user.pointer({ keys: '[MouseLeft]', target: editor(), offset: 6 })
  return utils
}

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

  it('opens the hint passively from a click inside the underlined words: the caret stays in the text', async () => {
    // Arrange + Act
    await openByClick()
    // Assert
    expect(popover()).toBeInTheDocument()
    expect(popover()).toHaveAccessibleDescription('With «yo», «ser» is conjugated «soy».')
    expect(editor()).toHaveFocus()
  })

  it('keeps typing where the writer clicked and closes the hint on the first key', async () => {
    // Arrange
    const { user } = await openByClick()
    // Act
    await user.keyboard('x')
    // Assert
    expect(editor()).toHaveValue('Hoy yox es feliz y tranquilo.')
    expect(popover()).not.toBeInTheDocument()
  })

  it('never accepts on Space or Enter typed in the text', async () => {
    // Arrange
    const { user } = await openByClick()
    // Act
    await user.keyboard(' {Enter}')
    // Assert
    expect(editor()).toHaveValue('Hoy yo \n es feliz y tranquilo.')
  })

  it('accepts by clicking Accept in the popover, without the text losing focus first', async () => {
    // Arrange
    const { user } = await openByClick()
    // Act
    await user.click(inPopover().getByRole('button', { name: 'Accept' }))
    // Assert
    expect(editor()).toHaveValue(FIXED)
    expect(editor()).toHaveFocus()
  })

  it('keeps Dismiss working where a button press blurs without a related target (Safari, Firefox)', async () => {
    // Arrange
    await openByClick()
    const dismiss = inPopover().getByRole('button', { name: 'Dismiss' })
    // Act: a press that is not cancelled would blur the text with relatedTarget null before the click.
    const pressKeptFocus = !fireEvent.pointerDown(dismiss)
    if (!pressKeptFocus) fireEvent.blur(editor(), { relatedTarget: null })
    fireEvent.click(dismiss)
    // Assert
    expect(pressKeptFocus).toBe(true)
    expect(popover()).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '1 hint' })).not.toBeInTheDocument()
  })

  it('closes with Escape but keeps the hint: closing is not dismissing', async () => {
    // Arrange
    const { user } = await openByClick()
    // Act
    await user.keyboard('{Escape}')
    // Assert
    expect(popover()).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1 hint' })).toBeInTheDocument()
    expect(editor()).toHaveFocus()
    expect(editor()).toHaveValue(TEXT)
  })

  it('closes when focus leaves the text, and keeps the hint listed', async () => {
    // Arrange
    const { user } = await openByClick()
    // Act
    await user.click(screen.getByRole('combobox'))
    // Assert
    expect(popover()).not.toBeInTheDocument()
  })

  it('closes when the caret moves out of the underlined words', async () => {
    // Arrange
    const { user } = await openByClick()
    // Act
    await user.keyboard('{Home}')
    // Assert
    expect(popover()).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1 hint' })).toBeInTheDocument()
  })

  it('closes on a press outside the popover and the text', async () => {
    // Arrange
    await openByClick()
    // Act
    fireEvent.pointerDown(screen.getByRole('switch', { name: 'Live hints' }))
    // Assert
    expect(popover()).not.toBeInTheDocument()
  })

  it('describes the hint as a non-modal dialog', async () => {
    // Arrange + Act
    await openByClick()
    // Assert
    expect(popover()).not.toHaveAttribute('aria-modal', 'true')
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

  it('does not open anything for a click in the blank space after a hinted last word', async () => {
    // Arrange
    const text = 'Hoy camino mucho y yo es'
    const { user } = await renderWithDraft(text)
    await hintsButton()
    // Act
    await user.pointer({ keys: '[MouseLeft]', target: editor(), offset: text.length })
    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(editor()).toHaveFocus()
  })
})
