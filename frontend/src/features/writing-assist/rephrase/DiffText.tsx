import { Fragment } from 'react'
import type { DiffPart } from '../text/wordDiff'

const changeClasses = {
  inline: { added: 'font-medium text-primary no-underline', removed: 'hidden' },
  compare: { added: 'rounded-sm bg-primary-soft font-medium text-fg no-underline', removed: 'rounded-sm bg-neutral-soft text-fg-secondary no-underline' },
} as const

// Kept words are bare text, not spans: the accessible name of a version then keeps the spaces around a changed word.
// <ins>/<del> carry the change for assistive tech; colour and weight repeat it on screen. Inline mode renders only the
// version's parts, so `removed` never appears there; the map entry just keeps the type total.
export function DiffText({ parts, variant }: { parts: readonly DiffPart[]; variant: 'inline' | 'compare' }) {
  return (
    <>
      {parts.map((part, index) => {
        if (part.change === 'same') return <Fragment key={index}>{part.text}</Fragment>
        const Tag = part.change === 'added' ? 'ins' : 'del'
        return (
          <Tag key={index} className={changeClasses[variant][part.change]}>
            {part.text}
          </Tag>
        )
      })}
    </>
  )
}
