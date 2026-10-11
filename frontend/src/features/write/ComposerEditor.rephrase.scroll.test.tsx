import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { composerField as editor, openCard, renderComposer } from '@/test/composerRephrase'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('when the textarea scrolls', () => {
  const view = { top: 0, bottom: 100 }
  function layout(markTop: number) {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this instanceof HTMLTextAreaElement) return { ...view, left: 0, right: 300, width: 300, height: 100, x: 0, y: 0, toJSON: () => ({}) }
      if (this instanceof HTMLElement && this.dataset.decorationId === 'rephrase-target') {
        const top = markTop - (editor().scrollTop || 0)
        return { top, bottom: top + 20, left: 10, right: 200, width: 190, height: 20, x: 10, y: top, toJSON: () => ({}) }
      }
      return { top: 0, bottom: 0, left: 0, right: 300, width: 300, height: 0, x: 0, y: 0, toJSON: () => ({}) }
    })
  }

  it('scrolls a target that is out of view into view instead of closing the card', async () => {
    // Arrange
    layout(300)
    const { user } = renderComposer()
    // Act
    await openCard(user)
    // Assert
    expect(editor().scrollTop).toBeGreaterThan(0)
    expect(screen.getByRole('dialog', { name: 'Rephrase' })).toBeInTheDocument()
  })

  it('closes without taking focus or the selection when the sentence scrolls out of view', async () => {
    // Arrange
    layout(50)
    const { user } = renderComposer()
    await openCard(user)
    const before = [editor().selectionStart, editor().selectionEnd]
    screen.getByRole('button', { name: 'Close rephrase' }).focus()
    // Act
    editor().scrollTop = 400
    fireEvent.scroll(editor())
    // Assert
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(editor()).not.toHaveFocus()
    expect([editor().selectionStart, editor().selectionEnd]).toEqual(before)
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
    expect(screen.getByRole('button', { name: 'Rephrase' })).toHaveFocus()
    expect(editor()).not.toHaveFocus()
  })
})
