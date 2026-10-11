import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { editor as draftEditor, openByClick, popover, renderWithDraft } from '@/test/composerHints'
import { caretAt, composerField as editor, PAIR_FIXED as FIXED, openCard, renderComposer, PAIR_SENTENCE as SENTENCE, PAIR_TEXT as TEXT, tint } from '@/test/composerRephrase'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ComposerEditor rephrase', () => {
  it('opens the card for the caret sentence from the Rephrase button and tints that sentence', async () => {
    // Arrange
    const { user } = renderComposer()
    // Act
    const dialog = await openCard(user)
    // Assert
    expect(await within(dialog).findByRole('button', { name: FIXED })).toBeInTheDocument()
    expect(within(dialog).getByText(SENTENCE, { selector: 'blockquote' })).toBeInTheDocument()
    expect(tint()).toHaveTextContent(SENTENCE)
    expect(within(dialog).getByRole('tab', { name: 'Rephrase' })).toHaveFocus()
  })

  it('opens with Alt+R and ignores it while composing', async () => {
    // Arrange
    renderComposer()
    caretAt(30)
    // Act
    fireEvent.keyDown(editor(), { code: 'KeyR', altKey: true, isComposing: true })
    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.keyDown(editor(), { code: 'KeyR', altKey: true })
    expect(await screen.findByRole('dialog', { name: 'Rephrase' })).toBeInTheDocument()
  })

  it('disables the Rephrase button when the caret sentence has fewer than three words', () => {
    // Arrange + Act
    renderComposer('¿Y tú?')
    // Assert
    expect(screen.getByRole('button', { name: 'Rephrase' })).toBeDisabled()
  })

  it('replaces the sentence with a version through the editing API and closes the card', async () => {
    // Arrange
    const { user, onValue } = renderComposer()
    const dialog = await openCard(user)
    // Act
    await user.click(await within(dialog).findByRole('button', { name: FIXED }))
    // Assert
    expect(onValue).toHaveBeenLastCalledWith(`Ayer fui al mercado. ${FIXED}`)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(editor()).toHaveFocus()
    expect(screen.getByText('Sentence replaced. Press Command or Control Z to undo.')).toBeInTheDocument()
  })

  it('replaces one word from Better words', async () => {
    // Arrange
    const { user, onValue } = renderComposer()
    const dialog = await openCard(user)
    await within(dialog).findByRole('button', { name: FIXED })
    // Act
    await user.click(within(dialog).getByRole('tab', { name: 'Better words' }))
    await user.click(await within(dialog).findByRole('button', { name: /contento for feliz/ }))
    // Assert
    expect(onValue).toHaveBeenLastCalledWith('Ayer fui al mercado. Hoy yo es contento con mi familia.')
  })

  it('lands the replacement on the right characters after emoji and leading spaces', async () => {
    // Arrange
    const value = '  ¿Qué tal? 😊 Hoy yo es feliz con mi familia.'
    const { user, onValue } = renderComposer(value)
    caretAt(value.length - 5)
    await user.click(screen.getByRole('button', { name: 'Rephrase' }))
    const dialog = await screen.findByRole('dialog', { name: 'Rephrase' })
    // Act
    // The emoji stays with «¿Qué tal?»; only the sentence after it changes, the leading spaces stay.
    await user.click(await within(dialog).findByRole('button', { name: FIXED }))
    // Assert
    expect(onValue).toHaveBeenLastCalledWith(`  ¿Qué tal? 😊 ${FIXED}`)
  })

  it('refuses a replacement when the text before the sentence changed, and says so', async () => {
    // Arrange
    const { user, onValue } = renderComposer()
    const dialog = await openCard(user)
    const version = await within(dialog).findByRole('button', { name: FIXED })
    fireEvent.change(editor(), { target: { value: `Ya. ${TEXT}` } })
    onValue.mockClear()
    // Act
    await user.click(version)
    // Assert
    expect(onValue).not.toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toHaveTextContent('The sentence changed. Close this and rephrase again.')
  })

  it('Esc closes the card and puts the caret back on the sentence', async () => {
    // Arrange
    const { user } = renderComposer()
    await openCard(user)
    // Act
    await user.keyboard('{Escape}')
    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(editor()).toHaveFocus()
    expect([editor().selectionStart, editor().selectionEnd]).toEqual([21, 52])
  })

  it('still replaces when only text after the sentence changed', async () => {
    // Arrange
    const { user, onValue } = renderComposer()
    const dialog = await openCard(user)
    const version = await within(dialog).findByRole('button', { name: FIXED })
    fireEvent.change(editor(), { target: { value: `${TEXT} Y más.` } })
    onValue.mockClear()
    // Act
    await user.click(version)
    // Assert
    expect(onValue).toHaveBeenLastCalledWith(`Ayer fui al mercado. ${FIXED} Y más.`)
  })

  it('Esc on the info toggletip closes the tip and leaves the card open', async () => {
    // Arrange
    const { user } = renderComposer()
    const dialog = await openCard(user)
    await within(dialog).findByRole('button', { name: FIXED })
    await user.click(within(dialog).getAllByRole('button', { name: 'Why this version' })[0] as HTMLElement)
    const tip = () => document.querySelector('[role="tooltip"][data-state="open"]')
    expect(tip()).toBeInTheDocument()
    // Act
    await user.keyboard('{Escape}')
    // Assert
    expect(tip()).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Rephrase' })).toBeInTheDocument()
  })

  it('stops announcing the replacement at the next edit, so hint counts are announced again', async () => {
    // Arrange
    const { user } = await renderWithDraft('Hoy yo soy feliz y tranquilo con todo.')
    draftEditor().setSelectionRange(5, 5)
    fireEvent.select(draftEditor())
    await user.click(screen.getByRole('button', { name: 'Rephrase' }))
    await user.click(await screen.findByRole('button', { name: /^Sinceramente/ }))
    const region = () => document.querySelector('p[aria-live="polite"]')
    expect(region()).toHaveTextContent('Sentence replaced')
    // Act
    await user.type(draftEditor(), ' yo es')
    // Assert
    expect(await screen.findByRole('button', { name: '1 hint' }, { timeout: 4000 })).toBeInTheDocument()
    await waitFor(() => expect(region()).toHaveTextContent('1 hint'), { timeout: 4000 })
  })

  it('does not mistake Ctrl+Alt+R (AltGr) for the shortcut, and Alt+R is consumed so no ® is typed', () => {
    // Arrange
    renderComposer()
    caretAt(30)
    // Act
    const ctrl = fireEvent.keyDown(editor(), { code: 'KeyR', altKey: true, ctrlKey: true })
    const alt = fireEvent.keyDown(editor(), { code: 'KeyR', altKey: true })
    // Assert
    expect(ctrl).toBe(true)
    expect(alt).toBe(false)
  })

  it('does not open anything for Ctrl+Alt+R', () => {
    // Arrange
    renderComposer()
    caretAt(30)
    // Act
    fireEvent.keyDown(editor(), { code: 'KeyR', altKey: true, ctrlKey: true })
    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes on a press outside the card and puts the selection back on the sentence', async () => {
    // Arrange
    const { user } = renderComposer()
    await openCard(user)
    // Act
    fireEvent.pointerDown(document.body)
    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(editor()).toHaveFocus()
    expect([editor().selectionStart, editor().selectionEnd]).toEqual([21, 52])
  })

  it('hides the hint popover while the card is open', async () => {
    // Arrange
    await openByClick()
    expect(popover()).toBeInTheDocument()
    // Act
    // A bare click: no pointerdown or blur, so nothing else closes the hint popover.
    fireEvent.click(screen.getByRole('button', { name: 'Rephrase' }))
    // Assert
    expect(await screen.findByRole('dialog', { name: 'Rephrase' })).toBeInTheDocument()
    expect(popover()).not.toBeInTheDocument()
  })

  it('rephrases a selection instead of the caret sentence', async () => {
    // Arrange
    const { user } = renderComposer()
    caretAt(21, 36)
    // Act
    await user.click(screen.getByRole('button', { name: 'Rephrase' }))
    // Assert
    const dialog = await screen.findByRole('dialog', { name: 'Rephrase' })
    expect(within(dialog).getByText('Hoy yo es feliz', { selector: 'blockquote' })).toBeInTheDocument()
  })

  it('keeps the other composer controls working next to the button', () => {
    // Arrange + Act
    renderComposer()
    // Assert
    expect(screen.getByRole('switch', { name: 'Live hints' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rephrase' })).toHaveAttribute('aria-keyshortcuts', 'Alt+R')
  })
})
