import { useId, useState, type ReactNode } from 'react'
import { AnimatedTabs, panelId, tabId } from '@/components/ui/AnimatedTabs'
import type { AnalysisOut } from '@/types/analysis'

const VERSIONS = [
  { id: 'original', label: 'Your text' },
  { id: 'corrected', label: 'Corrected' },
] as const

export interface TextVersionsProps {
  analysis: AnalysisOut
  // Called before switching, so an open mistake panel never points at text that is no longer shown.
  onSwitch: () => void
  // The annotated original, with its highlight buttons.
  children: ReactNode
  // False when the original holds no highlight buttons, so the panel itself becomes the tab stop (APG).
  hasHighlights: boolean
}

export function TextVersions({ analysis, onSwitch, children, hasHighlights }: TextVersionsProps) {
  const [version, setVersion] = useState<string>('original')
  const prefix = useId()
  const corrected = version === 'corrected'
  return (
    <div className="flex flex-col gap-3">
      <div>
        <AnimatedTabs
          label="Text version"
          idPrefix={prefix}
          tabs={VERSIONS}
          value={version}
          onChange={(id) => {
            onSwitch()
            setVersion(id)
          }}
        />
      </div>
      <div role="tabpanel" id={panelId(prefix, version)} aria-labelledby={tabId(prefix, version)} tabIndex={corrected || !hasHighlights ? 0 : undefined}>
        {corrected ? <p className="text-lg leading-loose whitespace-pre-wrap">{analysis.corrected_text ?? analysis.input_text}</p> : children}
      </div>
    </div>
  )
}
