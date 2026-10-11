import { act, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { composerField as editor } from '@/test/composerRephrase'
import { findGhost, ghost, pause, spyCompletions, TEXT, writeAtEnd } from '@/test/composerAutocomplete'
import { apiUrl } from '@/test/helpers'
import { server } from '@/test/server'

afterEach(() => localStorage.clear())

describe('ComposerEditor autocomplete: when it asks', () => {
  it('does not ask on each keystroke after a pause, only once the typing settles', async () => {
    // Arrange
    const bodies = spyCompletions()
    const user = userEvent.setup()
    await writeAtEnd(user)
    await findGhost()
    // Act
    await user.keyboard('x')
    // Assert
    expect(bodies).toHaveLength(1)
  })

  it('asks nothing without a language', async () => {
    // Arrange
    const bodies = spyCompletions()
    const user = userEvent.setup()
    await writeAtEnd(user, TEXT, { language: '' })
    // Act
    await pause()
    // Assert
    expect(bodies).toHaveLength(0)
  })

  it('asks nothing for text over 5000 characters', async () => {
    // Arrange
    const bodies = spyCompletions()
    const user = userEvent.setup()
    await writeAtEnd(user, 'palabra '.repeat(700))
    // Act
    await pause()
    // Assert
    expect(bodies).toHaveLength(0)
  })

  it('asks nothing while the composer is read-only (a saving entry)', async () => {
    // Arrange
    const bodies = spyCompletions()
    const user = userEvent.setup()
    await writeAtEnd(user, TEXT, { readOnly: true })
    // Act
    await pause()
    // Assert
    expect(bodies).toHaveLength(0)
    expect(ghost()).not.toBeInTheDocument()
  })

  it('asks nothing once the text lost focus, even though the caret was left at the end', async () => {
    // Arrange
    const bodies = spyCompletions()
    const user = userEvent.setup()
    await writeAtEnd(user)
    // Act
    act(() => editor().blur())
    await pause()
    // Assert
    expect(bodies).toHaveLength(0)
  })

  it('never shows an answer that was still in flight when an IME composition opened', async () => {
    // Arrange
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(http.post(apiUrl('complete'), () => gate))
    const user = userEvent.setup()
    await writeAtEnd(user)
    await pause(1000)
    // Act
    fireEvent.compositionStart(editor())
    release()
    await pause(500)
    // Assert
    expect(ghost()).not.toBeInTheDocument()
  })

  it('does not bring back an older answer for text typed again, only the latest one', async () => {
    // Arrange
    const bodies = spyCompletions()
    const user = userEvent.setup()
    await writeAtEnd(user)
    await findGhost()
    await user.keyboard('{Tab}')
    await findGhost() // the answer for the text with the accepted ghost
    // Act: back to the first text, as an undo does
    fireEvent.change(editor(), { target: { value: TEXT } })
    const asked = bodies.length
    await pause()
    // Assert
    expect(ghost()).not.toBeInTheDocument()
    expect(bodies).toHaveLength(asked)
    expect(screen.queryByText(/Suggestion/)).not.toBeInTheDocument()
  })
})
