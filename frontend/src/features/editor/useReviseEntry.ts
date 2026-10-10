import { useUpdateEntryMutation } from '@/hooks/mutations/useUpdateEntryMutation'
import { useRunAnalysisMutation } from '@/hooks/mutations/useRunAnalysisMutation'

// Save the text first, then analyse it: a failed analysis never loses the revision.
export function useReviseEntry(entryId: string) {
  const update = useUpdateEntryMutation()
  const analyze = useRunAnalysisMutation()
  const submit = (text: string, onDone: () => void) =>
    update.mutate({ id: entryId, text }, { onSuccess: () => analyze.mutate(entryId, { onSuccess: onDone }) })
  return { submit, isPending: update.isPending || analyze.isPending, error: update.error ?? analyze.error }
}
