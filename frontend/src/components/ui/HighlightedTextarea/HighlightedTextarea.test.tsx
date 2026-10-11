import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef, useState } from 'react'
import { describe, expect, it } from 'vitest'
import { CHIP_CLASS, HighlightedTextarea } from '.'

function Harness({ initial = 'en el [park].', readOnly = false, ghost }: { initial?: string; readOnly?: boolean; ghost?: string }) {
  const [value, setValue] = useState(initial)
  return <HighlightedTextarea aria-label="Your entry" value={value} readOnly={readOnly} onChange={(event) => setValue(event.target.value)} decorations={[{ start: 6, end: 12, className: CHIP_CLASS }]} ghost={ghost} />
}

// The backdrop is aria-hidden by design (the textarea is the accessible control), so it is reached through the DOM.
const backdrop = (container: HTMLElement) => container.querySelector<HTMLElement>('[aria-hidden="true"]')

describe('HighlightedTextarea', () => {
  it('keeps the native textarea as the labelled, editable control', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<Harness initial="" />)
    // Act
    await user.type(screen.getByRole('textbox', { name: 'Your entry' }), 'Hola')
    // Assert
    expect(screen.getByRole('textbox', { name: 'Your entry' })).toHaveValue('Hola')
  })

  it('mirrors the text behind it and draws decorated ranges as chips', () => {
    // Arrange + Act
    const { container } = render(<Harness />)
    // Assert
    expect(backdrop(container)).toHaveTextContent('en el [park].')
    const marks = container.querySelectorAll('mark')
    expect(marks).toHaveLength(1)
    expect(marks[0]).toHaveTextContent('[park]')
    expect(marks[0]).toHaveClass('bg-primary-soft', 'shadow-chip')
  })

  it('draws the ghost in the aria-hidden backdrop after the last character, and leaves the value alone', () => {
    // Arrange + Act
    const { container } = render(<Harness ghost=" y luego" />)
    // Assert
    const ghost = container.querySelector('[data-ghost]')
    expect(ghost).toHaveTextContent('y luego')
    expect(ghost).toHaveClass('text-muted')
    expect(ghost?.closest('[aria-hidden="true"]')).toBe(backdrop(container))
    expect(ghost?.previousSibling).toHaveTextContent('.')
    expect(screen.getByRole('textbox')).toHaveValue('en el [park].')
  })

  it('makes room for a ghost that wraps below a full, scrolled textarea, and scrolls it into view', () => {
    // Arrange
    const { container, rerender } = render(<Harness />)
    const textarea = screen.getByRole('textbox')
    const layer = backdrop(container)
    if (!layer) throw new Error('no backdrop')
    Object.defineProperty(layer, 'scrollHeight', { configurable: true, value: 300 })
    Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value: 200 })
    // Act
    rerender(<Harness ghost=" y luego" />)
    // Assert
    expect(textarea.style.paddingBottom).toBe('calc(100px + 1rem)')
    expect(textarea.scrollTop).toBe(200)
    expect(layer.scrollTop).toBe(200)
    rerender(<Harness />)
    expect(textarea.style.paddingBottom).toBe('')
  })

  it('adds no room when the ghost fits', () => {
    // Arrange
    const { container, rerender } = render(<Harness />)
    const textarea = screen.getByRole('textbox')
    Object.defineProperty(backdrop(container), 'scrollHeight', { configurable: true, value: 200 })
    Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value: 200 })
    // Act
    rerender(<Harness ghost=" y luego" />)
    // Assert
    expect(textarea.style.paddingBottom).toBe('')
  })

  it('draws no ghost without one', () => {
    // Arrange + Act
    const { container } = render(<Harness />)
    // Assert
    expect(container.querySelector('[data-ghost]')).not.toBeInTheDocument()
  })

  it('scrolls the backdrop with the textarea', () => {
    // Arrange
    const { container } = render(<Harness />)
    const textarea = screen.getByRole('textbox')
    textarea.scrollTop = 40
    // Act — user-event has no scroll API.
    fireEvent.scroll(textarea)
    // Assert
    expect(backdrop(container)?.scrollTop).toBe(40)
  })

  it('still calls its own scroll handler and hands its ref to the native textarea', () => {
    // Arrange
    const ref = createRef<HTMLTextAreaElement>()
    let scrolled = 0
    render(<HighlightedTextarea aria-label="Entry" ref={ref} value="" readOnly decorations={[]} onScroll={() => (scrolled += 1)} />)
    // Act
    fireEvent.scroll(screen.getByRole('textbox'))
    // Assert
    expect(scrolled).toBe(1)
    expect(ref.current).toBe(screen.getByRole('textbox'))
  })

  it('tints its frame while read-only', () => {
    // Arrange + Act
    const { container } = render(<Harness readOnly />)
    // Assert
    expect(container.firstChild).toHaveClass('bg-surface')
    expect(screen.getByRole('textbox')).toHaveAttribute('readonly')
  })

  it('keeps the placeholder visible although the typed text is transparent', () => {
    // Arrange + Act
    render(<HighlightedTextarea aria-label="Entry" value="" placeholder="Write here" decorations={[]} onChange={() => undefined} />)
    // Assert
    expect(screen.getByRole('textbox')).toHaveClass('text-transparent', 'placeholder:text-muted')
  })

  it('draws decorations on a transparent mark so underline-only styles sit on no yellow background', () => {
    // Arrange + Act
    const { container } = render(<HighlightedTextarea aria-label="Entry" value="abc" readOnly decorations={[{ start: 0, end: 1, className: 'underline' }]} />)
    // Assert
    expect(container.querySelector('mark')).toHaveClass('bg-transparent', 'text-fg', 'underline')
  })

  it('stops the browser translating the backdrop and gives a final empty line its height', () => {
    // Arrange + Act
    const { container } = render(<HighlightedTextarea aria-label="Entry" value={'a\n'} readOnly decorations={[]} />)
    // Assert
    expect(backdrop(container)).toHaveAttribute('translate', 'no')
    expect(backdrop(container)?.textContent).toBe('a\n ')
  })

  it('hides the typed text so only the backdrop is seen', () => {
    // Arrange + Act
    render(<Harness />)
    // Assert
    expect(screen.getByRole('textbox')).toHaveClass('text-transparent')
  })

  it('re-syncs the backdrop scroll after a render that changes the text, without a scroll event', async () => {
    // Arrange
    const user = userEvent.setup()
    const { container } = render(<Harness initial="" />)
    const textarea = screen.getByRole('textbox')
    textarea.scrollTop = 25
    // Act
    await user.type(textarea, 'x')
    // Assert
    expect(backdrop(container)?.scrollTop).toBe(25)
  })

  it('labels each decorated mark with its id so overlays can find it', () => {
    // Arrange + Act
    const { container } = render(<HighlightedTextarea aria-label="Entry" value="ab" readOnly decorations={[{ id: 'h1', start: 0, end: 2, className: CHIP_CLASS }]} />)
    // Assert
    expect(container.querySelector('mark')).toHaveAttribute('data-decoration-id', 'h1')
  })
})
