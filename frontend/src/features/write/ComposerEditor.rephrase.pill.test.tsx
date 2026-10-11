import { fireEvent, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { caretAt, composerField as editor, PAIR_TEXT as TEXT, renderComposer } from '@/test/composerRephrase'

afterEach(() => vi.unstubAllGlobals())

function pointer(fine: boolean) {
  // Desktop width either way, so the card is the popover; only the pointer type varies.
  vi.stubGlobal('matchMedia', (media: string) => ({
    matches: media === '(pointer: fine)' ? fine : true,
    media,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
}

const select = (phrase: string) => {
  editor().focus()
  const start = TEXT.indexOf(phrase)
  caretAt(start, start + phrase.length)
}
const pill = () => screen.queryByRole('button', { name: 'Rephrase selection' })

describe('ComposerEditor selection pill', () => {
  it('shows after a selection of three words and opens the card on the selection', async () => {
    // Arrange
    pointer(true)
    const { user } = renderComposer()
    // Act
    select('yo es feliz')
    await user.click(pill() as HTMLElement)
    // Assert
    const dialog = await screen.findByRole('dialog', { name: 'Rephrase' })
    expect(within(dialog).getByText('yo es feliz', { selector: 'blockquote' })).toBeInTheDocument()
    expect(pill()).not.toBeInTheDocument()
  })

  it('does not appear for two words or a bare caret', () => {
    // Arrange
    pointer(true)
    renderComposer()
    // Act + Assert
    select('yo es')
    expect(pill()).not.toBeInTheDocument()
    caretAt(30)
    expect(pill()).not.toBeInTheDocument()
  })

  it('stays away on touch devices', () => {
    // Arrange
    pointer(false)
    renderComposer()
    // Act
    select('yo es feliz')
    // Assert
    expect(pill()).not.toBeInTheDocument()
  })

  it('leaves the textarea focused and out of the tab order', () => {
    // Arrange
    pointer(true)
    renderComposer()
    select('yo es feliz')
    // Act
    const notPrevented = fireEvent.pointerDown(pill() as HTMLElement)
    // Assert
    expect(notPrevented).toBe(false)
    expect(pill()).toHaveAttribute('tabindex', '-1')
    expect(editor()).toHaveFocus()
  })

  it('goes away when the textarea loses the selection', () => {
    // Arrange
    pointer(true)
    renderComposer()
    select('yo es feliz')
    expect(pill()).toBeInTheDocument()
    // Act
    fireEvent.blur(editor())
    // Assert
    expect(pill()).not.toBeInTheDocument()
  })

  it('waits for the mouse button to come up before showing', () => {
    // Arrange
    pointer(true)
    renderComposer()
    // Act
    fireEvent.pointerDown(editor(), { pointerType: 'mouse' })
    select('yo es feliz')
    // Assert
    expect(pill()).not.toBeInTheDocument()
    // Act
    fireEvent.pointerUp(document, { pointerType: 'mouse' })
    // Assert
    expect(pill()).toBeInTheDocument()
  })
})
