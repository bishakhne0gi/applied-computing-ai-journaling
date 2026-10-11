import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { composerField as editor } from '@/test/composerRephrase'
import { findGhost, ghost, GHOST, TEXT, writeAtEnd } from '@/test/composerAutocomplete'

afterEach(() => vi.unstubAllGlobals())

function pointer(coarse: boolean) {
  vi.stubGlobal('matchMedia', (media: string) => ({
    matches: media === '(pointer: coarse)' ? coarse : media === '(pointer: fine)' ? !coarse : true,
    media,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
}

const accept = () => screen.queryByRole('button', { name: 'Accept suggestion' })

describe('ComposerEditor autocomplete on touch', () => {
  it('offers an Accept suggestion button while a ghost is visible, and tapping it inserts the ghost with the text still focused', async () => {
    // Arrange
    pointer(true)
    const user = userEvent.setup()
    const { onValue } = await writeAtEnd(user)
    expect(accept()).not.toBeInTheDocument()
    await findGhost()
    const button = screen.getByRole('button', { name: 'Accept suggestion' })
    // Act
    const keptFocus = !fireEvent.pointerDown(button)
    await user.click(button)
    // Assert
    expect(keptFocus).toBe(true)
    expect(button).toHaveAttribute('tabindex', '-1')
    expect(onValue).toHaveBeenLastCalledWith(`${TEXT}${GHOST}`)
    expect(editor()).toHaveFocus()
    expect(ghost()).not.toBeInTheDocument()
    expect(accept()).not.toBeInTheDocument()
  })

  it('says to tap the button, not to press Tab', () => {
    // Arrange + Act
    pointer(true)
    return writeAtEnd(userEvent.setup()).then(() => {
      // Assert
      expect(editor()).toHaveAccessibleDescription(/Tap Accept suggestion to use the grey text\./)
      expect(editor()).not.toHaveAccessibleDescription(/Press Tab/)
    })
  })

  it('has no button with a fine pointer, where Tab does it', async () => {
    // Arrange
    pointer(false)
    const user = userEvent.setup()
    await writeAtEnd(user)
    // Act
    await findGhost()
    // Assert
    expect(accept()).not.toBeInTheDocument()
    expect(editor()).toHaveAccessibleDescription(/Press Tab to accept a grey suggestion\./)
  })
})
