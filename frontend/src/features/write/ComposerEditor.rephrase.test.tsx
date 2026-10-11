import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/renderWithProviders'
import { ComposerEditor } from './ComposerEditor'

const TEXT = 'Ayer fui al mercado. Hoy yo es feliz con mi familia.'
const SENTENCE = 'Hoy yo es feliz con mi familia.'
const FIXED = 'Hoy yo soy feliz con mi familia.'

afterEach(() => vi.unstubAllGlobals())

function Harness({ initial, onValue }: { initial: string; onValue?: (text: string) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <ComposerEditor
        language="es"
        value={value}
        onChange={(text) => {
          onValue?.(text)
          setValue(text)
        }}
        onSubmitShortcut={() => undefined}
        readOnly={false}
        focusOnMount={false}
      />
    </>
  )
}

const editor = () => screen.getByLabelText<HTMLTextAreaElement>('Your entry')
const caretAt = (position: number, end = position) => {
  editor().setSelectionRange(position, end)
  fireEvent.select(editor())
}
const tint = () => document.querySelector('mark[data-decoration-id="rephrase-target"]')

function renderComposer(initial = TEXT) {
  const onValue = vi.fn()
  renderWithProviders(<Harness initial={initial} onValue={onValue} />)
  return { onValue, user: userEvent.setup() }
}

async function openCard(user: ReturnType<typeof userEvent.setup>) {
  caretAt(30)
  await user.click(screen.getByRole('button', { name: 'Rephrase' }))
  return screen.findByRole('dialog', { name: 'Rephrase' })
}

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

  it('refuses a stale replacement and says so', async () => {
    // Arrange
    const { user, onValue } = renderComposer()
    const dialog = await openCard(user)
    const version = await within(dialog).findByRole('button', { name: FIXED })
    fireEvent.change(editor(), { target: { value: `${TEXT} Y más.` } })
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

describe('ComposerEditor rephrase on a phone', () => {
  it('opens the card as a modal bottom sheet', async () => {
    // Arrange
    vi.stubGlobal('matchMedia', (media: string) => ({ matches: false, media, addEventListener: () => undefined, removeEventListener: () => undefined }))
    const { user } = renderComposer()
    // Act
    const dialog = await openCard(user)
    // Assert
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
