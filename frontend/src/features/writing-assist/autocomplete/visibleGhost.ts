export interface Answer {
  base: string
  completion: string
}

// Derived, not stored: typing that matches the ghost eats into it; anything else ends it.
export function visibleGhost(answer: Answer | null, value: string): string {
  if (!answer || !value.startsWith(answer.base)) return ''
  const typed = value.slice(answer.base.length)
  return answer.completion.startsWith(typed) ? answer.completion.slice(typed.length) : ''
}
