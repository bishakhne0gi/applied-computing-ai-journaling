import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef, useState } from 'react'
import { describe, expect, it } from 'vitest'
import { CHIP_CLASS, HighlightedTextarea } from '.'

function Harness({ initial = 'en el [park].', readOnly = false }: { initial?: string; readOnly?: boolean }) {
  const [value, setValue] = useState(initial)
  return <HighlightedTextarea aria-label="Your entry" value={value} readOnly={readOnly} onChange={(event) => setValue(event.target.value)} decorations={[{ start: 6, end: 12, className: CHIP_CLASS }]} />
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
})
