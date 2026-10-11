// The textarea's scroll event does not bubble; capture on the frame still sees it. The backdrop follows the textarea in
// the same event, so measuring waits one frame. Returns the unsubscribe.
export function repositionOnScroll(frame: HTMLElement, place: () => void): () => void {
  let pending = 0
  const later = () => {
    cancelAnimationFrame(pending)
    pending = requestAnimationFrame(place)
  }
  frame.addEventListener('scroll', later, true)
  window.addEventListener('resize', later)
  return () => {
    cancelAnimationFrame(pending)
    frame.removeEventListener('scroll', later, true)
    window.removeEventListener('resize', later)
  }
}
