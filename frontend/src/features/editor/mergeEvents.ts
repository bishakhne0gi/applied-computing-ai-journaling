import type { SyntheticEvent } from 'react'
import type { TextareaEvents } from './EntryTextField'

type Handler = (event: SyntheticEvent) => void

// Several owners (selection, rephrase, hints) listen on one textarea; each handler runs in order until one prevents the default.
export function mergeEvents(...sets: TextareaEvents[]): TextareaEvents {
  const keys = new Set(sets.flatMap((set) => Object.keys(set)))
  const merged: Record<string, Handler> = {}
  for (const key of keys) {
    const handlers = sets.flatMap((set) => {
      const handler: unknown = (set as Record<string, unknown>)[key]
      return typeof handler === 'function' ? [handler as Handler] : []
    })
    merged[key] = (event) => {
      for (const handler of handlers) {
        handler(event)
        if (event.isDefaultPrevented()) return
      }
    }
  }
  return merged as TextareaEvents
}
