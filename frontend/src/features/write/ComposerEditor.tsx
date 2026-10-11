import { useCallback, useRef, useState, type MouseEvent } from 'react'
import { EntryTextField } from '@/features/editor/EntryTextField'
import { applyHint } from '@/features/live-hints/applyHint'
import { editorDecorations } from '@/features/live-hints/editorDecorations'
import { HintPopover } from '@/features/live-hints/HintPopover'
import { LiveHintsControls } from '@/features/live-hints/LiveHintsControls'
import { hintAtCaret, type LiveHint } from '@/features/live-hints/reanchor'
import { useLiveHints } from '@/features/live-hints/useLiveHints'
import { useLiveHintsSetting } from '@/features/live-hints/useLiveHintsSetting'
import { bracketRanges } from '@/utils/text'

export interface ComposerEditorProps {
  language: string
  value: string
  onChange: (text: string) => void
  onSubmitShortcut: () => void
  readOnly: boolean
  focusOnMount: boolean
}

export function ComposerEditor({ language, value, onChange, onSubmitShortcut, readOnly, focusOnMount }: ComposerEditorProps) {
  const [liveOn, setLiveOn] = useLiveHintsSetting()
  const live = useLiveHints({ text: value, language, enabled: liveOn && !readOnly })
  const [openId, setOpenId] = useState<string | null>(null)
  const textarea = useRef<HTMLTextAreaElement | null>(null)
  const attach = useCallback(
    (node: HTMLTextAreaElement | null) => {
      textarea.current = node
      if (node && focusOnMount) node.focus()
    },
    [focusOnMount],
  )
  const open = live.hints.find((hint) => hint.id === openId) ?? null
  const accept = (hint: LiveHint) => {
    setOpenId(null)
    if (textarea.current) applyHint(textarea.current, hint)
  }
  const dismiss = (hint: LiveHint) => {
    setOpenId(null)
    live.dismiss(hint.key)
    textarea.current?.focus()
  }
  const onTextareaClick = (event: MouseEvent<HTMLTextAreaElement>) => setOpenId(hintAtCaret(live.hints, event.currentTarget)?.id ?? null)
  return (
    <EntryTextField
      id="entry-text"
      label="Your entry"
      value={value}
      onChange={onChange}
      onSubmitShortcut={onSubmitShortcut}
      readOnly={readOnly}
      textareaRef={attach}
      decorations={editorDecorations(bracketRanges(value), live.hints)}
      onTextareaClick={onTextareaClick}
      overlay={open && <HintPopover hint={open} onAccept={() => accept(open)} onDismiss={() => dismiss(open)} onClose={() => setOpenId(null)} />}
      footer={<LiveHintsControls on={liveOn} onToggle={setLiveOn} hints={live.hints} onAccept={accept} onDismiss={dismiss} />}
    />
  )
}
