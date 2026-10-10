import { useRef, useState } from 'react'
import { useCreateEntryMutation } from '@/hooks/mutations/useCreateEntryMutation'
import { useRunAnalysisMutation } from '@/hooks/mutations/useRunAnalysisMutation'
import { useEntryQuery } from '@/hooks/queries/useEntryQuery'
import type { EntryCreate } from '@/types/entry'

export type WritePhase = 'editing' | 'saving' | 'analyzing' | 'done'

function phaseOf(saving: boolean, entryId: string | null, analyzing: boolean): WritePhase {
  if (saving) return 'saving'
  if (entryId === null) return 'editing'
  return analyzing ? 'analyzing' : 'done'
}

// Save first, analyse second (spec §2): the entry exists before the model is called.
export function useWriteSession(onSaved: () => void) {
  const [entryId, setEntryId] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  // A ref, not state: the second click of a double click lands before React re-renders the disabled button.
  const submitting = useRef(false)
  const create = useCreateEntryMutation()
  const analyze = useRunAnalysisMutation()
  const entry = useEntryQuery(entryId).data ?? null
  const analysis = entry?.latest_analysis ?? null
  // Until the first result or error arrives the entry is still being analysed, even before isPending flips.
  const analyzing = analyze.isPending || (analysis === null && analyze.error === null)

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
    setRetrying(true)
    analyze.mutate(entryId, { onSettled: () => setRetrying(false) })
  }
  const reset = () => {
    setEntryId(null)
    create.reset()
    analyze.reset()
  }

  return {
    entry,
    analysis,
    phase: phaseOf(create.isPending, entryId, analyzing),
    saveError: create.error,
    analyzeError: analyze.error,
    isRetrying: retrying,
    submit,
    retry,
    reset,
  }
}

export type WriteSession = ReturnType<typeof useWriteSession>
