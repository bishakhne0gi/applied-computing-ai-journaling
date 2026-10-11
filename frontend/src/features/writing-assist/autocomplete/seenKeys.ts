// A typing session produces a key per pause; only recent ones can still be in the query cache, so older ones are forgotten.
export const MAX_SEEN = 50

export function remember(seen: ReadonlySet<string>, key: string): ReadonlySet<string> {
  return new Set([...seen, key].slice(-MAX_SEEN))
}
