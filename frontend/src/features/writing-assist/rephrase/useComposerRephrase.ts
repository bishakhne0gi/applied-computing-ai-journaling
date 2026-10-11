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
  // On a phone the sheet hands focus back to the Rephrase button (closeToOpener); focusing the text there would raise the keyboard.
  const closeToOpener = useCallback(() => setOpen(null), [])
  const close = useCallback(() => {
    setOpen(null)
    const el = textarea.current
    if (open && el) {
      el.focus()
      el.setSelectionRange(open.span.start, open.span.end)
    }
  }, [open, textarea])
  // The card's offsets index the text as it was sent; if it changed since, nothing is replaced.
  const replace = (startCp: number, endCp: number, replacement: string) => {
    const el = textarea.current
    if (!el || !open) return
    if (serverView(el.value).text !== open.request.text) {
      setNotice(STALE)
      return
    }
    setOpen(null)
    setAnnouncement(REPLACED)
    applyHint(el, { ...fromServerSpan(el.value, startCp, endCp), correction: replacement })
  }
  const applyVersion = (version: VersionOut) => open && replace(open.request.start, open.request.end, version.text)
  const applyWord = (item: VocabularyOut, word: string) => open && replace(open.request.start + item.start, open.request.start + item.end, word)
  const events: TextareaEvents = {
    onKeyDown: (event) => {
      if (event.nativeEvent.isComposing || !event.altKey || event.ctrlKey || event.metaKey || event.code !== 'KeyR') return
      event.preventDefault() // Option+R would otherwise type «®» on a Mac
      openCard()
    },
  }
  return { target, open, openCard, close, closeToOpener, applyVersion, applyWord, notice, announcement, events }
}

export type ComposerRephraseState = ReturnType<typeof useComposerRephrase>
