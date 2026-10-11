function* texts(root: Node): Generator<Text> {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) yield node as Text
}

// UTF-16 offset of (node, offset) in root's text, as a selection reports it (a text offset, or a child index for an
// element); null when the node is elsewhere.
export function textOffsetOf(root: Node, node: Node, offset: number): number | null {
  if (!root.contains(node)) return null
  const range = document.createRange()
  range.setStart(root, 0)
  range.setEnd(node, offset)
  return range.toString().length
}

// The box of the character just before `offset` (a collapsed range has no box in some engines).
export function rectAtOffset(root: Node, offset: number): DOMRect | null {
  let remaining = offset
  for (const text of texts(root)) {
    if (remaining <= text.length && remaining > 0) {
      const range = document.createRange()
      range.setStart(text, remaining - 1)
      range.setEnd(text, remaining)
      return Array.from(range.getClientRects()).at(-1) ?? range.getBoundingClientRect()
    }
    remaining -= text.length
  }
  return null
}
