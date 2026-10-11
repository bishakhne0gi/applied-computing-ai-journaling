import type { VersionOut } from '@/types/assist'
import { wordDiff } from '../text/wordDiff'
import { DiffText } from './DiffText'

// Two columns from 40rem (`sm`), stacked on a phone.
export function CompareView({ id, sentence, version }: { id: string; sentence: string; version: VersionOut }) {
  const diff = wordDiff(sentence, version.text)
  return (
    <section id={id} aria-label={`Compare: your sentence and ${version.label.toLowerCase()}`} className="grid gap-3 px-2 pb-2 sm:grid-cols-2">
      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-medium text-muted">Your sentence</h3>
        <p>
          <DiffText parts={diff.before} variant="compare" />
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-medium text-muted">{version.label}</h3>
        <p>
          <DiffText parts={diff.after} variant="compare" />
        </p>
      </div>
    </section>
  )
}
