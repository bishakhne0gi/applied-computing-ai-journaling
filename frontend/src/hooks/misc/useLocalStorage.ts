import { useCallback, useState } from 'react'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    if (value === '') localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Private mode or a full quota: the in-memory value still works for this visit.
  }
}

export function useLocalStorage(key: string): [string, (value: string) => void] {
  const [value, setValue] = useState(() => read(key) ?? '')
  const update = useCallback(
    (next: string) => {
      setValue(next)
      write(key, next)
    },
    [key],
  )
  return [value, update]
}
