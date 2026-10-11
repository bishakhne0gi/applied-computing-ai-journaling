import { useCallback, useMemo, useState, type RefObject } from 'react'
import type { TextareaEvents } from '@/features/editor/EntryTextField'
import type { TextareaSelection } from '@/features/editor/useTextareaSelection'
import { applyHint } from '@/features/live-hints/applyHint'
import { serverView } from '@/features/live-hints/serverText'
import type { RephraseRequest, VersionOut, VocabularyOut } from '@/types/assist'
import { rephraseTarget, type Span } from '../text/sentences'
import { fromServerSpan, toServerSpan } from '../text/serverSpan'

interface OpenRephrase {
  request: RephraseRequest
  span: Span
}

interface Input {
  value: string
  language: string
  readOnly: boolean
  selection: TextareaSelection
  textarea: RefObject<HTMLTextAreaElement | null>
}

const spanText = (text: string, { start, end }: RephraseRequest) => Array.from(text).slice(start, end).join('')

const STALE = 'The sentence changed. Close this and rephrase again.'
const REPLACED = 'Sentence replaced. Press Command or Control Z to undo.'

export function useComposerRephrase({ value, language, readOnly, selection, textarea }: Input) {
  const [open, setOpen] = useState<OpenRephrase | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const target = useMemo(
    () => (readOnly || language === '' ? null : rephraseTarget(value, selection.start, selection.end, language)),
    [readOnly, language, value, selection.start, selection.end],
  )
  const openCard = () => {
    const server = target && toServerSpan(value, target)
    if (!server) return
    setNotice(null)
    setAnnouncement('')
    setOpen({ request: { language, text: server.text, start: server.start, end: server.end }, span: target })
  }
  // Closes without touching focus or selection: the phone sheet hands focus back to the Rephrase button (focusing the text
  // would raise the keyboard), and a sentence that scrolled away must not snap the textarea back.
  const closeQuietly = useCallback(() => setOpen(null), [])
  const close = useCallback(() => {
    setOpen(null)
    const el = textarea.current
    if (open && el) {
      el.focus()
      el.setSelectionRange(open.span.start, open.span.end)
    }
  }, [open, textarea])
  // The card's offsets index the text as it was sent; if the text at the target changed since, nothing is replaced.
  // An edit after the sentence leaves the offsets valid, so it does not block.
  const replace = (startCp: number, endCp: number, replacement: string) => {
    const el = textarea.current
    if (!el || !open) return
    if (spanText(serverView(el.value).text, open.request) !== spanText(open.request.text, open.request)) {
      setNotice(STALE)
      return
    }
    setOpen(null)
    applyHint(el, { ...fromServerSpan(el.value, startCp, endCp), correction: replacement })
    // After the edit: the edit's own change event clears the announcement, so this must come last.
    setAnnouncement(REPLACED)
  }
  const applyVersion = (version: VersionOut) => open && replace(open.request.start, open.request.end, version.text)
  const applyWord = (item: VocabularyOut, word: string) => open && replace(open.request.start + item.start, open.request.start + item.end, word)
  const clearAnnouncement = useCallback(() => setAnnouncement(''), [])
  const events: TextareaEvents = {
    onKeyDown: (event) => {
      if (event.nativeEvent.isComposing || !event.altKey || event.ctrlKey || event.metaKey || event.code !== 'KeyR') return
      event.preventDefault() // Option+R would otherwise type «®» on a Mac
      openCard()
    },
  }
  return { target, open, openCard, close, closeQuietly, clearAnnouncement, applyVersion, applyWord, notice, announcement, events }
}

export type ComposerRephraseState = ReturnType<typeof useComposerRephrase>
