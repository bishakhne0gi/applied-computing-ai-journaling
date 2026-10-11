export interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

export interface Size {
  width: number
  height: number
}

const POPOVER_GAP = 10
const POPOVER_MARGIN = 8

// Below the words by default; above when below would run past the viewport or the editor frame (which would cover the
// hints row under it) and above has room. Horizontally it stays inside the viewport with a margin. Returns frame-relative px.
export function placePopover(mark: Box, frame: Box, popover: Size, viewport: Size): { left: number; top: number } {
  const maxLeft = viewport.width - popover.width - POPOVER_MARGIN
  const left = Math.max(POPOVER_MARGIN, Math.min(mark.left, maxLeft))
  const below = mark.bottom + POPOVER_GAP
  const above = mark.top - POPOVER_GAP - popover.height
  const fitsBelow = below + popover.height <= Math.min(frame.bottom, viewport.height - POPOVER_MARGIN)
  const top = fitsBelow || above < POPOVER_MARGIN ? below : above
  return { left: left - frame.left, top: top - frame.top }
}
