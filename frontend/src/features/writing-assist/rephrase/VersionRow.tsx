import { useId, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Tooltip } from '@/components/ui/Tooltip'
import type { VersionOut } from '@/types/assist'
import { wordDiff } from '../text/wordDiff'
import { CompareView } from './CompareView'
import { DiffText } from './DiffText'

export interface VersionRowProps {
  sentence: string
  version: VersionOut
  mode: 'edit' | 'read'
  onUse?: (version: VersionOut) => void
  onCopy?: (text: string) => void
}

export function VersionRow({ sentence, version, mode, onUse, onCopy }: VersionRowProps) {
  const [comparing, setComparing] = useState(false)
  const toneId = useId()
  const compareId = useId()
  const text = <DiffText parts={wordDiff(sentence, version.text).after} variant="inline" />
  return (
    <li className="flex flex-col px-1 py-1 focus-within:bg-primary-soft hover:bg-primary-soft">
      <div className="flex flex-wrap items-center gap-2">
        {mode === 'edit' ? (
          <Button variant="option" className="min-h-9 flex-1 hover:bg-transparent" aria-describedby={toneId} onClick={() => onUse?.(version)}>
            <span>{text}</span>
          </Button>
        ) : (
          <>
            <p className="flex-1 px-2 py-1">{text}</p>
            <Button variant="ghost" className="min-h-9 pointer-coarse:min-h-11" aria-label={`Copy ${version.label.toLowerCase()} version`} onClick={() => onCopy?.(version.text)}>
              <Icon name="copy" /> Copy
            </Button>
          </>
        )}
      </div>
      <div className="flex items-center gap-2 px-2 pb-1">
        <Badge id={toneId}>{version.label}</Badge>
        <Tooltip size="card" align="start" content={<><strong>{version.label}</strong> {version.explanation}</>}>
          <span className="sr-only">Why this version</span>
          <Icon name="info" className="size-4" />
        </Tooltip>
        <Button variant="ghost" className="ml-auto min-h-8 px-3 pointer-coarse:min-h-11" aria-expanded={comparing} aria-controls={comparing ? compareId : undefined} onClick={() => setComparing((was) => !was)}>
          Compare
        </Button>
      </div>
      {comparing && <CompareView id={compareId} sentence={sentence} version={version} />}
    </li>
  )
}
