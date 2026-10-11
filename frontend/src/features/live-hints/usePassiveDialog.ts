import { useEffect, type RefObject } from 'react'

export function usePassiveDialog(ref: RefObject<HTMLElement | null>, onClose: () => void, onEscape: () => void): void {
  // Native listeners: the dialog is not itself interactive, and these concern focus and pointer behaviour around it.
  useEffect(() => {
    const root = ref.current
    const frame = root?.parentElement
    if (!root || !frame) return
    // Safari and Firefox blur the focused element (relatedTarget null) when a button is pressed; keeping the press from
    // moving focus means nothing closes before the click lands, and the text keeps its caret and keyboard.
    const keepFocus = (event: Event) => event.preventDefault()
    const outside = (event: Event) => {
      if (event.target instanceof Node && !frame.contains(event.target)) onClose()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onEscape()
    }
    const leave = (event: FocusEvent) => {
      if (event.relatedTarget instanceof Node && !root.contains(event.relatedTarget)) onClose()
    }
    root.addEventListener('pointerdown', keepFocus)
    root.addEventListener('keydown', escape)
    root.addEventListener('focusout', leave)
    document.addEventListener('pointerdown', outside)
    return () => {
      root.removeEventListener('pointerdown', keepFocus)
      root.removeEventListener('keydown', escape)
      root.removeEventListener('focusout', leave)
      document.removeEventListener('pointerdown', outside)
    }
  }, [ref, onClose, onEscape])
}
