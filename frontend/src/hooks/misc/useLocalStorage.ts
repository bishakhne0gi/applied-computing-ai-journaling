import { useCallback, useState } from 'react'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): boolean {
  try {
    if (value === '') localStorage.removeItem(key)
    else localStorage.setItem(key, value)
    return true
  } catch {
    // Private mode or a full quota: the in-memory value still works for this visit.
    return false
  }
}

// `persisted` is false only when the latest write was refused, so callers never promise a draft that would be lost.
export function useLocalStorage(key: string): [string, (value: string) => void, boolean] {
  const [value, setValue] = useState(() => read(key) ?? '')
  const [persisted, setPersisted] = useState(true)
  const update = useCallback(
    (next: string) => {
      setValue(next)
      setPersisted(write(key, next))
    },
    [key],
  )
  return [value, update, persisted]
}
