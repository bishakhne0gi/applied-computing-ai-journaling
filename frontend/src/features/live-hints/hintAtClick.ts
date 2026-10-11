import { hintAtCaret, type LiveHint } from './reanchor'

const contains = (box: DOMRect, { x, y }: { x: number; y: number }) => x >= box.left && x <= box.right && y >= box.top && y <= box.bottom

// A one-character hint ("a" → "à") can never hold a caret strictly inside it, so a click is hit-tested against the
// underline's own rectangles (the backdrop marks). Where nothing can be measured (jsdom) the caret rule decides.
export function hintAtClick(hints: readonly LiveHint[], textarea: HTMLTextAreaElement, point: { x: number; y: number }): LiveHint | undefined {
  if (textarea.selectionStart !== textarea.selectionEnd) return undefined
  const marks = Array.from(textarea.parentElement?.querySelectorAll<HTMLElement>('mark[data-decoration-id]') ?? [])
  let measured = false
  for (const hint of hints) {
    const boxes = marks.filter((mark) => mark.dataset.decorationId === hint.id).flatMap((mark) => Array.from(mark.getClientRects()))
    if (boxes.length > 0) measured = true
    if (boxes.some((box) => contains(box, point))) return hint
  }
  return measured ? undefined : hintAtCaret(hints, textarea)
}
