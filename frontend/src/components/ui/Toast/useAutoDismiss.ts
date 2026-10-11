import { useCallback, useEffect, useRef } from 'react'

export interface DismissHold {
  hold: (reason: 'hover' | 'focus') => void
  release: (reason: 'hover' | 'focus') => void
}

// The timer stops while the pointer is over the toast or focus is inside it (someone is reading or reaching for the
// button) and resumes with the time that was left, not a fresh duration.
export function useAutoDismiss(duration: number, onDone: () => void): DismissHold {
  const remaining = useRef(duration)
  const startedAt = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const holds = useRef(new Set<string>())
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })

  const start = useCallback(() => {
    startedAt.current = Date.now()
    timer.current = setTimeout(() => done.current(), remaining.current)
  }, [])
  const stop = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = undefined
  }, [])

  useEffect(() => {
    start()
    return stop
  }, [start, stop])

  const hold = useCallback(
    (reason: 'hover' | 'focus') => {
      if (holds.current.size === 0 && timer.current !== undefined) {
        stop()
        remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current))
      }
      holds.current.add(reason)
    },
    [stop],
  )
  const release = useCallback(
    (reason: 'hover' | 'focus') => {
      holds.current.delete(reason)
      if (holds.current.size === 0 && timer.current === undefined) start()
    },
    [start],
  )
  return { hold, release }
}
