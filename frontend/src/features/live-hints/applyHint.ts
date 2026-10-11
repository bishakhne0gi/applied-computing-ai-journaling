export interface Replacement {
  start: number
  end: number
  correction: string
}

export function applyHint(textarea: HTMLTextAreaElement, { start, end, correction }: Replacement): void {
  textarea.focus()
  textarea.setSelectionRange(start, end)
  // Deprecated, yet still the only edit that lands in the browser's undo stack, so ⌘/Ctrl+Z restores the original.
  if (typeof document.execCommand === 'function' && document.execCommand('insertText', false, correction)) return
  textarea.setRangeText(correction, start, end, 'end')
  // React listens for `input`; setRangeText alone would leave the controlled value stale.
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
}
