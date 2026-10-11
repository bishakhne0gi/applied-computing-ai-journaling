import { useRef, useState } from 'react'
import { useCreateEntryMutation } from '@/hooks/mutations/useCreateEntryMutation'
import { useRunAnalysisMutation, type AnalysisCallbacks } from '@/hooks/mutations/useRunAnalysisMutation'
import { useEntryQuery } from '@/hooks/queries/useEntryQuery'
import type { EntryCreate } from '@/types/entry'

export type WritePhase = 'editing' | 'saving' | 'analyzing' | 'done'

function phaseOf(saving: boolean, entryId: string | null, analyzing: boolean): WritePhase {
  if (saving) return 'saving'
  if (entryId === null) return 'editing'
  return analyzing ? 'analyzing' : 'done'
}

// Save first, analyse second (spec §2): the entry exists before the model is called.
export function useWriteSession(onSaved: () => void, callbacks: AnalysisCallbacks = {}) {
  const [entryId, setEntryId] = useState<string | null>(null)
  // A ref, not state: the second click of a double click lands before React re-renders the disabled button.
  const submitting = useRef(false)
  const create = useCreateEntryMutation()
  const analyze = useRunAnalysisMutation(callbacks)
  // A second instance so "retrying" is just its pending state, not a flag kept beside the first.
  const reanalyze = useRunAnalysisMutation(callbacks)
  const entry = useEntryQuery(entryId).data ?? null
  const analysis = entry?.latest_analysis ?? null
  // Until the first result or error arrives the entry is still being analysed, even before isPending flips.
  const analyzeError = reanalyze.isIdle ? analyze.error : reanalyze.error
  const analyzing = analyze.isPending || reanalyze.isPending || (analysis === null && analyzeError === null)

  const submit = (body: EntryCreate) => {
    if (submitting.current || entryId) return
    submitting.current = true
    create.mutate(body, {
      onSuccess: (created) => {
        setEntryId(created.id)
        onSaved()
        analyze.mutate(created.id)
      },
      onSettled: () => {
        submitting.current = false
      },
    })
  }
  const retry = () => {
    if (!entryId) return
    reanalyze.mutate(entryId)
  }
  const reset = () => {
    setEntryId(null)
    create.reset()
    analyze.reset()
    reanalyze.reset()
  }

  return {
    entry,
    analysis,
    phase: phaseOf(create.isPending, entryId, analyzing),
    saveError: create.error,
    analyzeError,
    isRetrying: reanalyze.isPending,
    submit,
    retry,
    reset,
  }
}

export type WriteSession = ReturnType<typeof useWriteSession>
