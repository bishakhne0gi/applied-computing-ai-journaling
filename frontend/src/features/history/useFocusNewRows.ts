import { useEffect, useRef } from 'react'

// "Load more" disappears or disables once the page arrives, which would drop keyboard focus to the body.
// Focus moves to the first row that was added instead.
export function useFocusNewRows(rowCount: number) {
  const listRef = useRef<HTMLUListElement>(null)
  const firstNewRow = useRef<number | null>(null)
  useEffect(() => {
    const index = firstNewRow.current
    if (index === null || rowCount <= index) return
    firstNewRow.current = null
    listRef.current?.children[index]?.querySelector('a')?.focus()
  }, [rowCount])
  const expectRowsAfter = (count: number) => {
    firstNewRow.current = count
  }
  return { listRef, expectRowsAfter }
}
