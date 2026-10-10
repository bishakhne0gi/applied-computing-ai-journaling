export interface CorrectionProps {
  original: string
  correction: string
}

// The arrow is decorative; screen readers hear "… should be …" instead.
export function Correction({ original, correction }: CorrectionProps) {
  return (
    <>
      <span className="line-through decoration-2">{original}</span>
      {' '}
      <span aria-hidden="true">→</span>
      {/* Spaces sit outside the spans: accessible-name computation trims them inside an inline element. */}
      <span className="sr-only">should be</span>{' '}
      <span>{correction}</span>
    </>
  )
}
