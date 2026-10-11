import { useEffect, useMemo, useRef } from 'react'
import { useToast } from '@/components/ui/Toast'
import type { AnalysisCallbacks } from '@/hooks/mutations/useRunAnalysisMutation'
import type { AnalysisOut } from '@/types/analysis'

const READY = { message: 'Feedback is ready for the entry you just wrote — it is at the top of your entries.', tone: 'success' } as const
const FAILED = { message: 'The analysis of your new entry did not finish. It is saved — open it from your entries to retry.', tone: 'danger' } as const

// While the composer is on screen its status line and feedback say everything; a toast would repeat it. Once the
// learner opens another entry the composer unmounts, and only a toast can tell them how the analysis ended.
export function useBackgroundToasts(): AnalysisCallbacks {
  const { show } = useToast()
  const onScreen = useRef(true)
  useEffect(() => {
    onScreen.current = true
    return () => {
      onScreen.current = false
    }
  }, [])
  return useMemo(
    () => ({
      onAnalysed: (analysis: AnalysisOut) => {
        if (!onScreen.current) show(analysis.status === 'succeeded' ? READY : FAILED)
      },
      onFailed: () => {
        if (!onScreen.current) show(FAILED)
      },
    }),
    [show],
  )
}
