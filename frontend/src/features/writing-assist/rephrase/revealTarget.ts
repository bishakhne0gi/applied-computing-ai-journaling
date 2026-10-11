// The textarea scrolls its own text and the tint lives in the backdrop that follows it, so both are moved together;
// the anchor effect measures right after, and a sentence outside the box would close the card at once.
export function revealTarget(popover: HTMLElement | null): void {
  const frame = popover?.parentElement
  const mark = frame?.querySelector<HTMLElement>('mark[data-decoration-id="rephrase-target"]')
  const textarea = frame?.querySelector('textarea')
  const backdrop = mark?.closest<HTMLElement>('[aria-hidden="true"]')
  if (!mark || !textarea || !backdrop) return
  const box = mark.getBoundingClientRect()
  const view = textarea.getBoundingClientRect()
  const delta = scrollDelta(box, view)
  if (delta === 0) return
  textarea.scrollTop += delta
  backdrop.scrollTop = textarea.scrollTop
}

// Up to the top edge when above; down to the bottom edge when below, but never past the sentence's own top.
function scrollDelta(box: DOMRect, view: DOMRect): number {
  if (box.top < view.top) return box.top - view.top
  return box.bottom > view.bottom ? Math.min(box.bottom - view.bottom, box.top - view.top) : 0
}
