import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { composerField as editor, renderComposer } from '@/test/composerRephrase'
import { findGhost, ghost, GHOST, pause, SPOKEN, spyCompletions, TEXT, WAIT, writeAtEnd } from '@/test/composerAutocomplete'
import { clearMockMode, setMockMode } from '@/test/helpers'
import { STORAGE_KEYS } from '@/utils/constants'

afterEach(clearMockMode)

describe('ComposerEditor autocomplete', () => {
  it('shows ghost text after a pause with the caret at the end, announces it once, and Tab inserts it', async () => {
    // Arrange
    const user = userEvent.setup()
    const { onValue } = await writeAtEnd(user)
    // Act
    await findGhost()
    // Assert
    expect(ghost()).toHaveTextContent('y fue un buen día.')
    expect(screen.getByText(SPOKEN)).toBeInTheDocument()
    await user.keyboard('{Tab}')
    expect(onValue).toHaveBeenLastCalledWith(`${TEXT}${GHOST}`)
    expect(editor()).toHaveValue(`${TEXT}${GHOST}`)
    expect(editor()).toHaveFocus()
    expect(ghost()).not.toBeInTheDocument()
  })

  it('without a ghost, Tab moves focus on as usual', async () => {
    // Arrange
    const user = userEvent.setup()
    await writeAtEnd(user, 'Hoy fui')
    // Act
    await user.tab()
    // Assert
    expect(editor()).not.toHaveFocus()
    expect(editor()).toHaveValue('Hoy fui')
  })

  it('leaves Shift+Tab alone even with a ghost', async () => {
    // Arrange
    const user = userEvent.setup()
    await writeAtEnd(user)
    await findGhost()
    // Act
    await user.tab({ shift: true })
    // Assert
    expect(editor()).toHaveValue(TEXT)
    expect(editor()).not.toHaveFocus()
  })

  it('Esc removes the ghost, keeps focus in the text and does not ask again', async () => {
    // Arrange
    const user = userEvent.setup()
    await writeAtEnd(user)
    await findGhost()
    const bodies = spyCompletions()
    // Act
    await user.keyboard('{Escape}')
    await pause()
    // Assert
    expect(ghost()).not.toBeInTheDocument()
    expect(editor()).toHaveFocus()
    expect(editor()).toHaveValue(TEXT)
    expect(bodies).toHaveLength(0)
  })

  it('consumes typed letters that match the ghost without announcing again, and clears on anything else', async () => {
    // Arrange
    const user = userEvent.setup()
    await writeAtEnd(user)
    await findGhost()
    // Act
    await user.keyboard(' y')
    // Assert
    expect(ghost()).toHaveTextContent('fue un buen día.')
    expect(screen.getAllByText(SPOKEN)).toHaveLength(1)
    await user.keyboard('x')
    expect(ghost()).not.toBeInTheDocument()
    expect(screen.queryByText(SPOKEN)).not.toBeInTheDocument()
  })

  it('hides the ghost when the caret leaves the end', async () => {
    // Arrange
    const user = userEvent.setup()
    await writeAtEnd(user)
    await findGhost()
    // Act
    await user.keyboard('{ArrowLeft}')
    // Assert
    expect(ghost()).not.toBeInTheDocument()
    await user.keyboard('{End}')
    expect(ghost()).not.toBeInTheDocument()
  })

  it('hides the ghost and its announcement when focus leaves the text', async () => {
    // Arrange
    const user = userEvent.setup()
    await writeAtEnd(user)
    await findGhost()
    expect(screen.getByText(SPOKEN)).toBeInTheDocument()
    // Act
    act(() => editor().blur())
    // Assert
    expect(ghost()).not.toBeInTheDocument()
    expect(screen.queryByText(SPOKEN)).not.toBeInTheDocument()
  })

  it('hides the ghost while the rephrase card is open', async () => {
    // Arrange
    const user = userEvent.setup()
    await writeAtEnd(user)
    await findGhost()
    // Act
    fireEvent.keyDown(editor(), { code: 'KeyR', altKey: true })
    // Assert
    expect(await screen.findByRole('dialog', { name: 'Rephrase' })).toBeInTheDocument()
    expect(ghost()).not.toBeInTheDocument()
  })

  it.each([
    ['caret not at the end', () => editor().setSelectionRange(3, 3)],
    ['a selection', () => editor().setSelectionRange(0, 3)],
    ['an open IME composition', () => fireEvent.compositionStart(editor())],
  ])('asks nothing with %s', async (_name, arrange) => {
    // Arrange
    const bodies = spyCompletions()
    const user = userEvent.setup()
    renderComposer(TEXT)
    await user.click(editor())
    // Act
    arrange()
    fireEvent.select(editor())
    await pause()
    // Assert
    expect(bodies).toHaveLength(0)
    expect(ghost()).not.toBeInTheDocument()
  })

  it('asks nothing for fewer than three words', async () => {
    // Arrange
    const bodies = spyCompletions()
    const user = userEvent.setup()
    await writeAtEnd(user, 'Hoy fui')
    // Act
    await pause()
    // Assert
    expect(bodies).toHaveLength(0)
  })

  it('asks nothing with the Autocomplete switch off, and the choice is remembered', async () => {
    // Arrange
    const bodies = spyCompletions()
    const user = userEvent.setup()
    renderComposer(TEXT)
    // Act
    await user.click(screen.getByRole('switch', { name: 'Autocomplete' }))
    await user.click(editor())
    fireEvent.select(editor())
    await pause()
    // Assert
    expect(bodies).toHaveLength(0)
    expect(ghost()).not.toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEYS.autocomplete)).toBe('off')
    expect(editor()).not.toHaveAccessibleDescription(/Tab/)
  })

  it('starts with the switch on and nothing stored', () => {
    // Arrange + Act
    renderComposer(TEXT)
    // Assert
    expect(screen.getByRole('switch', { name: 'Autocomplete' })).toBeChecked()
    expect(localStorage.getItem(STORAGE_KEYS.autocomplete)).toBeNull()
  })

  it('shows nothing and no alert when autocomplete is unavailable', async () => {
    // Arrange
    setMockMode('assist-unavailable')
    const bodies = spyCompletions()
    const user = userEvent.setup()
    await writeAtEnd(user)
    // Act
    await waitFor(() => expect(bodies).toHaveLength(1), WAIT)
    await pause(300)
    // Assert
    expect(ghost()).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('mentions Tab in the editor description while the switch is on', () => {
    // Arrange + Act
    renderComposer(TEXT)
    // Assert
    expect(editor()).toHaveAccessibleDescription(/Press Tab to accept a grey suggestion\./)
  })
})
