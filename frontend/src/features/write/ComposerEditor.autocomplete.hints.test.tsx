import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { composerField as editor, renderComposer } from '@/test/composerRephrase'
import { ghost, pause } from '@/test/composerAutocomplete'

// jsdom cannot measure underlines, so the click is taken to land on the first hint, with the caret at the end of the text.
vi.mock('@/features/live-hints/hintAtClick', () => ({ hintAtClick: (hints: readonly unknown[]) => hints[0] }))

describe('ComposerEditor autocomplete beside the hint popover', () => {
  it('shows no ghost while the passive hint popover is open at the end of the text, and leaves the popover alone', async () => {
    // Arrange
    const user = userEvent.setup()
    renderComposer('Hoy yo es feliz y tranquilo.')
    await screen.findByRole('button', { name: '1 hint' })
    // Act
    await user.click(editor())
    fireEvent.select(editor())
    // Assert
    expect(screen.getByRole('group', { name: /Hint:/ })).toBeInTheDocument()
    // act() flushes the chained debounces one stage per call: long enough for the ask, the answer and the ghost.
    for (let stage = 0; stage < 4; stage++) await pause(900)
    expect(ghost()).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: /Hint:/ })).toBeInTheDocument()
  })
})
