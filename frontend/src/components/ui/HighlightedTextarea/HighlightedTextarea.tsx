import { useCallback, useLayoutEffect, useRef, type ComponentProps, type Ref } from 'react'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/utils/utils'
import { decorate, type Decoration } from './decorate'

export interface HighlightedTextareaProps extends ComponentProps<'textarea'> {
  value: string
  decorations: readonly Decoration[]
  // Suggested text drawn after the last character; the caller shows it only with the caret at the very end.
  ghost?: string
}

// Tint plus a spread-only shadow: no padding, border or font change, so the chip never moves a glyph.
export const CHIP_CLASS = 'rounded-sm bg-primary-soft shadow-chip'

// Both layers share box, border width, font (inherited, ss01 included), wrapping and an always-reserved scrollbar
// gutter, so every line breaks at the same glyph and the caret sits on the text it edits.
const layerClass = 'min-h-48 w-full overflow-y-scroll rounded-lg border p-4 text-base leading-relaxed wrap-break-word whitespace-pre-wrap'

function assignRef<T>(ref: Ref<T> | undefined, node: T | null): void {
  if (typeof ref === 'function') ref(node)
  else if (ref) ref.current = node
}

export function HighlightedTextarea({ value, decorations, ghost, className, onScroll, readOnly, ref, ...rest }: HighlightedTextareaProps) {
  const backdropRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const setTextarea = useCallback((node: HTMLTextAreaElement | null) => {
    textareaRef.current = node
    assignRef(ref, node)
  }, [ref])
  const syncScroll = useCallback(() => {
    if (backdropRef.current && textareaRef.current) backdropRef.current.scrollTop = textareaRef.current.scrollTop
  }, [])
  // A ghost that wraps past the end of a full, scrolled textarea would sit below the fold while Tab still inserts it:
  // pad the textarea by the overflow so it can scroll that far, and scroll to the end.
  useLayoutEffect(() => {
    const area = textareaRef.current
    const layer = backdropRef.current
    if (!area || !layer) return
    area.style.paddingBottom = ''
    const extra = ghost ? layer.scrollHeight - area.scrollHeight : 0
    if (extra <= 0) return
    area.style.paddingBottom = `calc(1rem + ${extra}px)`
    area.scrollTop = area.scrollHeight
    syncScroll()
  }, [ghost, value, syncScroll])
  // A new last line can scroll the textarea before the backdrop has that line to scroll to; re-sync after each render.
  useLayoutEffect(syncScroll, [value, syncScroll])
  return (
    <div className={cn('relative rounded-lg bg-bg', readOnly && 'bg-surface')}>
      <div ref={backdropRef} data-backdrop="" aria-hidden="true" translate="no" className={cn(layerClass, 'pointer-events-none absolute inset-0 border-transparent text-fg')}>
        {decorate(value, decorations).map((segment, index) =>
          segment.className ? (
            <mark key={index} data-decoration-id={segment.id} className={cn('bg-transparent text-fg', segment.className)}>
              {segment.text}
            </mark>
          ) : (
            <span key={index}>{segment.text}</span>
          ),
        )}
        {/* Only ever at the very end of the text: anywhere else it would push the following lines off the textarea's glyphs. */}
        {ghost ? (
          <span data-ghost="" className="text-muted">
            {ghost}
          </span>
        ) : null}
        {/* A trailing newline collapses in a div but not in a textarea; the space gives that last line its height. */}{' '}
      </div>
      <Textarea
        ref={setTextarea}
        value={value}
        readOnly={readOnly}
        onScroll={(event) => {
          syncScroll()
          onScroll?.(event)
        }}
        className={cn(layerClass, 'relative block resize-y bg-transparent text-transparent caret-fg selection:bg-primary/25 placeholder:text-muted read-only:bg-transparent', className)}
        {...rest}
      />
    </div>
  )
}
