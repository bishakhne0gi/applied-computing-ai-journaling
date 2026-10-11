import { render, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button } from '@/components/ui/Button'
import { applyHint } from './applyHint'

function Harness() {
  const [text, setText] = useState('Hoy yo es feliz.')
  const ref = useRef<HTMLTextAreaElement>(null)
  return (
    <>
      <textarea aria-label="Entry" ref={ref} value={text} onChange={(event) => setText(event.target.value)} />
      <Button onClick={() => ref.current && applyHint(ref.current, { start: 4, end: 9, correction: 'yo soy' })}>Accept</Button>
    </>
  )
}

function stubExecCommand(result: boolean) {
  const execCommand = vi.fn(() => result)
  Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true })
  return execCommand
}

describe('applyHint', () => {
  afterEach(() => vi.restoreAllMocks())

  it('edits through the editing API so the browser can undo it', () => {
    // Arrange
    const execCommand = stubExecCommand(true)
    render(<Harness />)
    // Act
    screen.getByRole('button', { name: 'Accept' }).click()
    // Assert
    expect(execCommand).toHaveBeenCalledWith('insertText', false, 'yo soy')
    expect(screen.getByRole('textbox')).toHaveFocus()
  })

  it('falls back to replacing the range and telling React the text changed', () => {
    // Arrange
    stubExecCommand(false)
    render(<Harness />)
    // Act
    screen.getByRole('button', { name: 'Accept' }).click()
    // Assert
    const textarea = screen.getByRole<HTMLTextAreaElement>('textbox')
    expect(textarea).toHaveValue('Hoy yo soy feliz.')
    expect(textarea.selectionStart).toBe(10)
  })
})
