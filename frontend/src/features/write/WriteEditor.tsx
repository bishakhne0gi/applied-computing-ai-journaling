import type { ReactNode } from 'react'
import { AnalysisFailure } from '@/features/feedback/AnalysisFailure'
import { toErrorMessage } from '@/utils/errorMessage'
import { EntryForm } from './EntryForm'
import type { Draft } from './useDraft'
import type { WriteSession } from './useWriteSession'

export interface WriteEditorProps {
  draft: Draft
  session: WriteSession
  focusOnMount: boolean
  newEntryButton: ReactNode
}

// Before saving the form edits the draft; after saving it shows the stored entry read-only.
export function WriteEditor({ draft, session, focusOnMount, newEntryButton }: WriteEditorProps) {
  const { entry, phase } = session
  return (
    <>
      <EntryForm
        language={entry?.language ?? draft.language}
        onLanguageChange={draft.setLanguage}
        text={entry?.text ?? draft.text}
        onTextChange={draft.setText}
        phase={phase}
        focusOnMount={focusOnMount}
        onSubmit={() => session.submit({ language: draft.language, text: draft.text })}
      />
      {session.saveError ? (
        <p role="alert" className="text-sm text-danger">
          {toErrorMessage(session.saveError)} Your draft is still here.
        </p>
      ) : null}
      {(phase === 'done' || session.isRetrying) && (
        <div className="flex flex-col items-start gap-3">
          <AnalysisFailure analysis={session.analysis} requestError={session.analyzeError} isRetrying={session.isRetrying} onRetry={session.retry} />
          {newEntryButton}
        </div>
      )}
    </>
  )
}
