import { useCallback, useRef, useState } from 'react'
import { EntryTextField } from '@/features/editor/EntryTextField'
import { applyHint } from '@/features/live-hints/applyHint'
import { editorDecorations } from '@/features/live-hints/editorDecorations'
import { HintPopover } from '@/features/live-hints/HintPopover'
import { LiveHintsControls } from '@/features/live-hints/LiveHintsControls'
import type { LiveHint } from '@/features/live-hints/reanchor'
import { useHintPopover } from '@/features/live-hints/useHintPopover'
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
  const [composing, setComposing] = useState(false)
  const live = useLiveHints({ text: value, language, enabled: liveOn && !readOnly, composing })
  const textarea = useRef<HTMLTextAreaElement | null>(null)
  const attach = useCallback(
    (node: HTMLTextAreaElement | null) => {
      textarea.current = node
      if (node && focusOnMount) node.focus()
    },
    [focusOnMount],
  )
  const { open, close, returnToText, textareaEvents } = useHintPopover(live.hints, textarea)
  const accept = (hint: LiveHint) => {
    close()
    if (textarea.current) applyHint(textarea.current, hint)
  }
  const dismiss = (hint: LiveHint) => {
    close()
    live.dismiss(hint.key)
  }
  return (
    <EntryTextField
      id="entry-text"
      label="Your entry"
      value={value}
      onChange={(text) => {
        close()
        onChange(text)
      }}
      onSubmitShortcut={onSubmitShortcut}
      readOnly={readOnly}
      textareaRef={attach}
      decorations={editorDecorations(bracketRanges(value), live.hints)}
      textareaEvents={{ ...textareaEvents, onCompositionStart: () => setComposing(true), onCompositionEnd: () => setComposing(false) }}
      overlay={
        open && (
          <HintPopover
            hint={open}
            onAccept={() => accept(open)}
            onDismiss={() => {
              dismiss(open)
              textarea.current?.focus()
            }}
            onClose={close}
            onEscape={returnToText}
          />
        )
      }
      footer={<LiveHintsControls on={liveOn} onToggle={setLiveOn} hints={live.hints} announcement={live.announcement} onAccept={accept} onDismiss={dismiss} />}
    />
  )
}
