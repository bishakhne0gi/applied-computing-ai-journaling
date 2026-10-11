import { useCallback, useRef, useState } from 'react'
import { BRACKET_HINT, EntryTextField } from '@/features/editor/EntryTextField'
import { mergeEvents } from '@/features/editor/mergeEvents'
import { useTextareaSelection } from '@/features/editor/useTextareaSelection'
import { HintPopover } from '@/features/live-hints/HintPopover'
import { useComposerHints } from '@/features/live-hints/useComposerHints'
import { useComposerAutocomplete } from '@/features/writing-assist/autocomplete/useComposerAutocomplete'
import { ComposerRephrase } from '@/features/writing-assist/rephrase/ComposerRephrase'
import { rephraseDecorations } from '@/features/writing-assist/rephrase/rephraseDecorations'
import { useComposerRephrase } from '@/features/writing-assist/rephrase/useComposerRephrase'

import { ComposerControls } from './ComposerControls'

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
  const auto = useComposerAutocomplete({ value, language, readOnly, composing, selection: selection.selection, suppressed: !!rephrase.open || !!hints.open })
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
      textareaEvents={mergeEvents(selection.events, auto.events, rephrase.events, hints.events, composingEvents)}
      ghost={auto.ghost}
      hint={auto.on ? `${BRACKET_HINT} Press Tab to accept a grey suggestion.` : undefined}
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
      footer={<ComposerControls hints={hints} rephrase={rephrase} auto={auto} />}
    />
  )
}
