// Its own polite region: the hint count and the rephrase message share another one, and a suggestion must be spoken once.
export function AutocompleteAnnouncer({ text }: { text: string }) {
  return (
    <p aria-live="polite" className="sr-only">
      {text}
    </p>
  )
}
