import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HintPopover } from './HintPopover'
import type { LiveHint } from './reanchor'

const HINT = { id: 'h1', original: 'yo es', correction: 'yo soy', explanation: 'Why.' } as LiveHint

const box = (top: number, bottom: number) => ({ top, bottom, left: 0, right: 100, width: 100, height: bottom - top, x: 0, y: top, toJSON: () => ({}) }) as DOMRect

// The textarea shows y 100..200; the mark's position is the thing a test scrolls.
const rects = { mark: box(120, 134) }

function mount(onClose = vi.fn()) {
  render(
    <div>
      <textarea aria-label="text" />
      <mark data-decoration-id="h1">yo es</mark>
      <HintPopover hint={HINT} onAccept={vi.fn()} onDismiss={vi.fn()} onClose={onClose} onEscape={vi.fn()} />
    </div>,
  )
  return onClose
}

beforeEach(() => {
  rects.mark = box(120, 134)
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this instanceof HTMLTextAreaElement) return box(100, 200)
    return this.tagName === 'MARK' ? rects.mark : box(0, 400)
  })
})
afterEach(() => vi.restoreAllMocks())

describe('HintPopover anchoring', () => {
  it('stays open while its mark is inside the textarea', async () => {
    // Arrange + Act
    const onClose = mount()
    // Assert
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('group')).toBeInTheDocument()
  })

  it('places itself under the mark again when the text scrolls', async () => {
    // Arrange
    mount()
    const popover = screen.getByRole('group')
    const before = popover.style.top
    // Act
    rects.mark = box(150, 164)
    document.querySelector('div')?.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('resize'))
    // Assert
    await waitFor(() => expect(popover.style.top).not.toBe(before))
  })

  it('closes, without dismissing, once the text scrolls its mark out of view', async () => {
    // Arrange
    const onClose = mount()
    // Act
    rects.mark = box(-60, -46)
    window.dispatchEvent(new Event('resize'))
    // Assert
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('cancels mousedown on the popover so a press never moves focus (Firefox)', () => {
    // Arrange
    mount()
    // Act + Assert
    expect(fireEvent.mouseDown(screen.getByRole('button', { name: 'Accept' }))).toBe(false)
  })
})
