import { useCallback, useRef, useState } from 'react'
import { EntryTextField } from '@/features/editor/EntryTextField'
import { mergeEvents } from '@/features/editor/mergeEvents'
import { useTextareaSelection } from '@/features/editor/useTextareaSelection'
import { HintPopover } from '@/features/live-hints/HintPopover'
import { LiveHintsControls } from '@/features/live-hints/LiveHintsControls'
import { useComposerHints } from '@/features/live-hints/useComposerHints'
import { ComposerRephrase, RephraseButton } from '@/features/writing-assist/rephrase/ComposerRephrase'
import { rephraseDecorations } from '@/features/writing-assist/rephrase/rephraseDecorations'
import { useComposerRephrase } from '@/features/writing-assist/rephrase/useComposerRephrase'

export interface ComposerEditorProps {
  language: string
  value: string
  onChange: (text: string) => void
  onSubmitShortcut: () => void
  readOnly: boolean
  focusOnMount: boolean
}

export function ComposerEditor({ language, value, onChange, onSubmitShortcut, readOnly, focusOnMount }: ComposerEditorProps) {
  const [composing, setComposing] = useState(false)
  const textarea = useRef<HTMLTextAreaElement | null>(null)
  const attach = useCallback(
    (node: HTMLTextAreaElement | null) => {
      textarea.current = node
      if (node && focusOnMount) node.focus()
    },
    [focusOnMount],
  )
  const selection = useTextareaSelection()
  const hints = useComposerHints({ value, language, readOnly, composing, textarea })
  const rephrase = useComposerRephrase({ value, language, readOnly, selection: selection.selection, textarea })
  const { open } = hints
  const composingEvents = { onCompositionStart: () => setComposing(true), onCompositionEnd: () => setComposing(false) }
  return (
    <EntryTextField
      id="entry-text"
      label="Your entry"
      value={value}
      onChange={(text) => {
        hints.close()
        rephrase.clearAnnouncement()
        onChange(text)
      }}
      onTextareaChange={selection.sync}
      onSubmitShortcut={onSubmitShortcut}
      readOnly={readOnly}
      textareaRef={attach}
      decorations={rephraseDecorations(hints.decorations, rephrase.open?.span ?? null)}
      textareaEvents={mergeEvents(selection.events, rephrase.events, hints.events, composingEvents)}
      overlay={
        <>
          {open && !rephrase.open && (
            <HintPopover
              hint={open}
              onAccept={() => hints.accept(open)}
              onDismiss={() => {
                hints.dismiss(open)
                textarea.current?.focus()
              }}
              onClose={hints.close}
              onEscape={hints.returnToText}
            />
          )}
          <ComposerRephrase rephrase={rephrase} selection={selection.selection} />
        </>
      }
      footer={
        <LiveHintsControls {...hints.controls} message={rephrase.announcement}>
          <RephraseButton rephrase={rephrase} />
        </LiveHintsControls>
      }
    />
  )
}
