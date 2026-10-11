import { act, renderHook } from '@testing-library/react'
import type { SyntheticEvent } from 'react'
import { describe, expect, it } from 'vitest'
import { useTextareaSelection } from './useTextareaSelection'

function textarea(value: string, start: number, end: number) {
  const el = document.createElement('textarea')
  document.body.append(el)
  el.value = value
  el.setSelectionRange(start, end)
  return el
}

describe('useTextareaSelection', () => {
  it('follows the caret on select and remembers it after the text loses focus', () => {
    // Arrange
    const { result } = renderHook(() => useTextareaSelection())
    const el = textarea('Hola mundo', 2, 6)
    el.focus()
    // Act
    act(() => result.current.events.onSelect?.({ currentTarget: el } as unknown as SyntheticEvent<HTMLTextAreaElement>))
    act(() => result.current.events.onBlur?.({ currentTarget: el } as never))
    // Assert
    expect(result.current.selection).toEqual({ start: 2, end: 6, focused: false, dragging: false })
    el.remove()
  })

  it('syncs on demand so the selection and the value land in the same render', () => {
    // Arrange
    const { result } = renderHook(() => useTextareaSelection())
    const el = textarea('Hola', 4, 4)
    // Act
    act(() => result.current.sync(el))
    // Assert
    expect(result.current.selection).toMatchObject({ start: 4, end: 4 })
    el.remove()
  })
})
